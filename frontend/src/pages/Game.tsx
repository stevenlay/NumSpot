import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { useDevStore } from '../store/devStore'
import NumberCard from '../components/game/NumberCard'
import Scoreboard from '../components/game/Scoreboard'
import ScoreProgressBar from '../components/game/ScoreProgressBar'
import GameShell from '../components/game/GameShell'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { initAudio, playCorrect, playWrong } from '../lib/sounds'

const MATCH_HOLD_FRACTION = 0.45
const FLY_DURATION_FRACTION = 0.35
const MATCH_HOLD_MIN_MS = 200
const FLY_DURATION_MIN_MS = 250

function FlyingCenterCard({ numbers, startRect, endRect, durationMs }: {
  numbers: number[]
  startRect: DOMRect
  endRect: DOMRect
  durationMs: number
}) {
  const [moved, setMoved] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMoved(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const rect = moved ? endRect : startRect

  return (
    <div
      className="fixed z-50 pointer-events-none transition-all ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        transitionProperty: 'left, top, width, height',
        transitionDuration: `${durationMs}ms`,
      }}
    >
      <NumberCard numbers={numbers} clickable={false} className="w-full h-full" />
    </div>
  )
}

export default function Game() {
  const navigate = useNavigate()
  const phase = useGameStore((s) => s.phase)
  const playerId = useGameStore((s) => s.playerId)
  const players = useGameStore((s) => s.players)
  const centerCard = useGameStore((s) => s.centerCard)
  const lastClaim = useGameStore((s) => s.lastClaim)
  const claimingPlayerCard = useGameStore((s) => s.claimingPlayerCard)
  const countdown = useGameStore((s) => s.countdown)
  const cardsLeft = useGameStore((s) => s.cardsLeft)
  const roomCode = useGameStore((s) => s.roomCode)
  const spectators = useGameStore((s) => s.spectators)
  const claim = useGameStore((s) => s.claim)
  const restartGame = useGameStore((s) => s.restartGame)
  const goHome = useGameStore((s) => s.goHome)
  const mutePlayer = useGameStore((s) => s.mutePlayer)
  const isHost = useGameStore((s) => s.isHost)
  const isSpectator = useGameStore((s) => s.isSpectator)
  const settings = useGameStore((s) => s.settings)
  const gameOverToast = useGameStore((s) => s.gameOverToast)
  const currentRound = useGameStore((s) => s.currentRound)
  const totalRounds = useGameStore((s) => s.totalRounds)
  const disconnected = useGameStore((s) => s.disconnected)
  const roundStartedAt = useGameStore((s) => s.roundStartedAt)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [claimSent, setClaimSent] = useState(false)
  const [displayedCenterCard, setDisplayedCenterCard] = useState<number[]>(centerCard)

  const myStreak = useGameStore((s) => s.streaks[s.playerId] ?? 0)
  const [hintNum, setHintNum] = useState<number | null>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastClaimRef = useRef<typeof lastClaim>(null)

  const [claimPhase, setClaimPhase] = useState<'idle' | 'highlight' | 'flying'>('idle')
  const [centerHidden, setCenterHidden] = useState(false)
  const [flight, setFlight] = useState<{ numbers: number[]; startRect: DOMRect; endRect: DOMRect; durationMs: number } | null>(null)
  const flightClaimRef = useRef<typeof lastClaim>(null)
  const centerCardRef = useRef<HTMLDivElement>(null)
  const ownCardRef = useRef<HTMLDivElement>(null)

  const myPlayer = players.find((p) => p.id === playerId)
  const myCard = myPlayer?.card ?? []

  const showToast = lastClaim?.correct === true
  const claimantName = lastClaim ? (players.find((p) => p.id === lastClaim.playerId)?.name ?? 'Someone') : ''
  const streakLabel = myStreak >= 2 ? (myStreak >= 3 ? ` · 🔥 ${myStreak}x` : ` · ${myStreak}x`) : ''
  const toastText = lastClaim?.correct
    ? lastClaim.playerId === playerId ? `✓ Correct! +1${streakLabel}` : `${claimantName} got it!`
    : null

  useEffect(() => {
    return () => { if (toastRef.current) clearTimeout(toastRef.current) }
  }, [])

  useEffect(() => {
    if (phase === 'home') {
      navigate('/', { replace: true })
    } else if (phase === 'lobby' && roomCode) {
      navigate(`/lobby/${roomCode}`, { replace: true })
    }
  }, [phase, roomCode, navigate])

  useEffect(() => {
    if (lastClaim === null) setClaimSent(false)
  }, [lastClaim])

  // Only reveal the new center card once the cooldown ends — this is also the
  // moment the flying card (if any) has fully landed, so clear it in the same
  // tick to avoid an earlier, separate swap.
  useEffect(() => {
    if (!lastClaim?.correct) {
      setDisplayedCenterCard(centerCard)
      setCenterHidden(false)
      setFlight(null)
      setClaimPhase('idle')
    }
  }, [centerCard, lastClaim])

  // On a correct claim: hold the highlight on both cards for a beat, then — if it
  // was this player's claim — fly the center card down onto their own card. It
  // stays landed there until the cooldown ends and the real state (new center
  // card, new hand) is revealed above.
  useEffect(() => {
    if (!lastClaim?.correct || lastClaim === flightClaimRef.current) return
    flightClaimRef.current = lastClaim
    const claimed = lastClaim
    setClaimPhase('highlight')
    setFlight(null)

    if (settings.correct_claim_lock_ms <= 0) {
      setCenterHidden(true)
      return
    }

    const holdMs = Math.max(MATCH_HOLD_MIN_MS, settings.correct_claim_lock_ms * MATCH_HOLD_FRACTION)
    const flyMs = Math.max(FLY_DURATION_MIN_MS, settings.correct_claim_lock_ms * FLY_DURATION_FRACTION)

    const flyTimer = setTimeout(() => {
      setClaimPhase('flying')
      setCenterHidden(true)
      if (claimed.playerId === playerId) {
        const startEl = centerCardRef.current
        const endEl = ownCardRef.current
        if (startEl && endEl) {
          setFlight({
            numbers: displayedCenterCard,
            startRect: startEl.getBoundingClientRect(),
            endRect: endEl.getBoundingClientRect(),
            durationMs: flyMs,
          })
        }
      }
    }, holdMs)

    return () => clearTimeout(flyTimer)
  }, [lastClaim, settings.correct_claim_lock_ms]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sounds
  useEffect(() => {
    if (!lastClaim || lastClaim === lastClaimRef.current) return
    lastClaimRef.current = lastClaim
    if (lastClaim.correct) {
      playCorrect(lastClaim.playerId === playerId)
    } else if (lastClaim.playerId === playerId) {
      playWrong()
    }
  }, [lastClaim, playerId])

  // Progressive hint — fires 6 s after each new card is dealt
  // Progressive hint — fires after hint_delay_ms (0 = disabled)
  useEffect(() => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    setHintNum(null)
    if (roundStartedAt === null || countdown !== null || settings.hint_delay_ms === 0) return
    const answer = myCard.find((n) => centerCard.includes(n)) ?? null
    if (!answer) return
    hintTimerRef.current = setTimeout(() => setHintNum(answer), settings.hint_delay_ms)
    return () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current) }
  }, [roundStartedAt, settings.hint_delay_ms]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClaim = (symbol: number) => {
    if (claimSent) return
    initAudio()
    setClaimSent(true)
    claim(symbol)
    setTimeout(() => setClaimSent(false), 2000)
  }

  const highlightNum = lastClaim?.correct && claimPhase === 'highlight' ? lastClaim.symbol : null
  const highlightAnswerEnabled = useDevStore((s) => s.highlightAnswer)
  const answerNum = (import.meta.env.DEV && highlightAnswerEnabled)
    ? myCard.find((n) => displayedCenterCard.includes(n)) ?? null
    : null

  const myPenalty = lastClaim !== null && !lastClaim.correct && lastClaim.playerId === playerId
  const hintToShow = !myPenalty && !isSpectator ? hintNum : null

  return (
    <>
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/80 backdrop-blur-sm">
          <span key={countdown} className="text-8xl font-black text-blue-500 animate-card-in">
            {countdown === 0 ? 'Go!' : countdown}
          </span>
          {countdown > 0 && (
            <div className="flex items-center gap-3 bg-blue-50 border-2 border-blue-200 text-blue-700 px-6 py-4 text-base font-medium max-w-sm text-center shadow-sm">
              <span className="shrink-0 text-2xl">💡</span>
              <span>Find the one number shared between your card and the center card, then tap it to claim!</span>
            </div>
          )}
        </div>
      )}

      {flight && (
        <FlyingCenterCard
          numbers={flight.numbers}
          startRect={flight.startRect}
          endRect={flight.endRect}
          durationMs={flight.durationMs}
        />
      )}

      {showToast && toastText && (
        <div
          className={cn(
            'fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg font-bold text-white text-sm',
            lastClaim?.correct ? 'bg-green-500' : 'bg-red-500'
          )}
          style={{ animation: `toast-out ${lastClaim?.correct ? `${settings.correct_claim_lock_ms}ms` : `${settings.wrong_claim_penalty_ms}ms`} ease-in forwards` }}
        >
          {toastText}
        </div>
      )}

      <GameShell
        centerFooter={phase !== 'finished' && playerId && (
          <ScoreProgressBar players={players} currentPlayerId={playerId} />
        )}
        banner={disconnected && (
          <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
            <AlertDescription className="flex items-center justify-between max-w-md mx-auto w-full">
              <span>Connection lost — you were removed from the game.</span>
              <button onClick={goHome} className="underline font-semibold ml-2 shrink-0">Return Home</button>
            </AlertDescription>
          </Alert>
        )}
        headerExtras={
          <>
            {isSpectator && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">Spectating</span>
            )}
            {spectators.length > 0 && (
              <span className="md:hidden text-xs text-muted-foreground">{spectators.length} spectating</span>
            )}
          </>
        }
        sidebarContent={
          <>
            <Scoreboard players={players} currentPlayerId={playerId} layout="vertical" className="w-full" isHost={isHost} onMute={mutePlayer} />
            {spectators.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-4">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Spectating</h2>
                {spectators.map((s) => (
                  <div key={s.id} className="px-3 py-2 rounded-lg text-sm bg-muted/50 text-muted-foreground truncate">
                    {s.name}
                  </div>
                ))}
              </div>
            )}
          </>
        }
        centerBanner={
          <>
            {!isSpectator && (
              <div className="hidden sm:flex w-full items-center justify-center gap-2 border-b border-border bg-blue-50 text-blue-700 px-6 py-4 text-sm shrink-0">
                <span className="shrink-0">💡</span>
                <span>Find the one number shared between your card and the center card, then tap it to claim!</span>
              </div>
            )}
            <div className="w-full flex items-center justify-center gap-2 border-b border-border bg-muted px-4 py-1.5 sm:py-2.5 shrink-0">
              <span className="text-xl sm:text-2xl font-black tabular-nums text-foreground">
                {cardsLeft}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground">
                cards left
              </span>
              {totalRounds > 1 && (
                <>
                  <span className="text-muted-foreground/40 text-xs">·</span>
                  <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Round {currentRound} of {totalRounds}</span>
                </>
              )}
            </div>
            <div className="md:hidden border-b border-border px-3 py-1.5 shrink-0 overflow-x-auto">
              <Scoreboard players={players} currentPlayerId={playerId ?? ''} layout="horizontal" />
            </div>
          </>
        }
      >
        {phase === 'finished' && gameOverToast ? (
          <main className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto min-w-0">
            {(() => {
              const isFinalRound = gameOverToast.currentRound >= gameOverToast.totalRounds
              const scoreOf = (p: { score: number; session_score: number }) => isFinalRound ? p.session_score + p.score : p.score
              const sorted = [...gameOverToast.players].sort((a, b) => scoreOf(b) - scoreOf(a))
              const heading = isFinalRound
                ? (gameOverToast.winner ? (gameOverToast.winner.id === playerId ? 'You won!' : `${gameOverToast.winner.name} wins!`) : 'Game over!')
                : (gameOverToast.winner ? (gameOverToast.winner.id === playerId ? 'You won this round!' : `${gameOverToast.winner.name} wins this round!`) : 'Round over!')
              return (
                <div className="w-full max-w-md flex flex-col gap-5">
                  <div className="text-center flex flex-col items-center gap-1">
                    <span className="text-5xl">{isFinalRound ? '🏆' : '✓'}</span>
                    {gameOverToast.totalRounds > 1 && (
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">
                        {isFinalRound ? `All ${gameOverToast.totalRounds} rounds complete` : `Round ${gameOverToast.currentRound} of ${gameOverToast.totalRounds}`}
                      </span>
                    )}
                    <h2 className="text-2xl font-extrabold mt-1">{heading}</h2>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {sorted.map((p, i) => {
                      const pts = scoreOf(p)
                      return (
                        <div
                          key={p.id}
                          className={cn(
                            'flex justify-between items-center px-4 py-2 rounded-lg font-semibold',
                            i === 0 && 'bg-yellow-100 text-yellow-900 text-base',
                            i === 1 && 'bg-slate-100 text-slate-700 text-sm',
                            i === 2 && 'bg-orange-100 text-orange-800 text-sm',
                            i >= 3 && 'text-muted-foreground text-sm',
                          )}
                        >
                          <span>{i + 1}. {p.name}{p.id === playerId ? ' (you)' : ''}</span>
                          <span>{pts} pt{pts !== 1 ? 's' : ''}</span>
                        </div>
                      )
                    })}
                  </div>
                  {isFinalRound ? (
                    isHost ? (
                      <Button size="lg" className="w-full" onClick={restartGame}>New Game</Button>
                    ) : (
                      <p className="text-center text-sm text-muted-foreground">Waiting for the host to start a new game…</p>
                    )
                  ) : (
                    <p className="text-center text-sm text-muted-foreground">Next round starting soon…</p>
                  )}
                </div>
              )
            })()}
          </main>
        ) : (
          <main className="flex-1 flex flex-col items-center p-3 sm:p-6 overflow-y-auto min-w-0">
            <div className="w-full max-w-md flex flex-col gap-4">
              <div className="flex flex-col gap-4 sm:gap-10 pt-2 sm:pt-8">
                <div className="flex flex-col gap-1.5">
                  <div className={cn('flex flex-col gap-1.5', !lastClaim?.correct && 'invisible')}>
                    <div className="h-2 w-full rounded-full bg-green-100 overflow-hidden">
                      <div
                        key={lastClaim?.symbol}
                        className="h-full bg-green-500 rounded-full"
                        style={lastClaim?.correct ? { animation: `penalty-fill ${settings.correct_claim_lock_ms}ms linear forwards` } : undefined}
                      />
                    </div>
                    <p className="text-center text-sm font-medium text-green-600">Dealing next card…</p>
                  </div>
                  <NumberCard
                    key={displayedCenterCard.join(',')}
                    cardRef={centerCardRef}
                    numbers={centerHidden ? [] : displayedCenterCard}
                    label="Center Card"
                    faceDown={countdown !== null}
                    highlightNumber={highlightNum}
                    clickable={false}
                    pileDepth={Math.ceil((cardsLeft / settings.deck_size) * 3)}

                    className="w-full"
                  />
                </div>

                {isSpectator ? (
                  <div className="flex flex-col items-center gap-3 py-6 border border-dashed border-border">
                    <p className="text-center text-muted-foreground text-sm">You are spectating — watch the action above.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-center">
                      Your Card — tap the matching number!
                    </span>
                    <div className="relative">
                      <NumberCard
                        cardRef={ownCardRef}
                        numbers={claimingPlayerCard ?? myCard}
                        onClaim={handleClaim}
                        clickable={!claimSent && countdown === null && (lastClaim === null || (!lastClaim.correct && lastClaim.playerId !== playerId))}
                        highlightNumber={answerNum ?? highlightNum}
                        hintNumber={hintToShow}
                        className="w-full"
                      />
                    </div>
                    {lastClaim !== null && !lastClaim.correct && lastClaim.playerId === playerId && (
                      <div className="flex flex-col gap-1.5">
                        <div className="h-2 w-full rounded-full bg-red-100 overflow-hidden">
                          <div
                            key={lastClaim.symbol}
                            className="h-full bg-red-500 rounded-full"
                            style={{ animation: `penalty-fill ${settings.wrong_claim_penalty_ms}ms linear forwards` }}
                          />
                        </div>
                        <p className="text-center text-sm font-medium text-red-500">Wrong guess, please wait</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </main>
        )}
      </GameShell>
    </>
  )
}
