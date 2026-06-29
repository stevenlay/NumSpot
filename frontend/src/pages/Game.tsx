import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { useDevStore } from '../store/devStore'
import NumberCard from '../components/game/NumberCard'
import Scoreboard from '../components/game/Scoreboard'
import GameShell from '../components/game/GameShell'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

export default function Game() {
  const navigate = useNavigate()
  const phase = useGameStore((s) => s.phase)
  const playerId = useGameStore((s) => s.playerId)
  const players = useGameStore((s) => s.players)
  const centerCard = useGameStore((s) => s.centerCard)
  const lastClaim = useGameStore((s) => s.lastClaim)
  const countdown = useGameStore((s) => s.countdown)
  const roomCode = useGameStore((s) => s.roomCode)
  const spectators = useGameStore((s) => s.spectators)
  const claim = useGameStore((s) => s.claim)
  const restartGame = useGameStore((s) => s.restartGame)
  const goHome = useGameStore((s) => s.goHome)
  const isHost = useGameStore((s) => s.isHost)
  const isSpectator = useGameStore((s) => s.isSpectator)
  const settings = useGameStore((s) => s.settings)
  const gameOverToast = useGameStore((s) => s.gameOverToast)
  const disconnected = useGameStore((s) => s.disconnected)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [claimSent, setClaimSent] = useState(false)

  const myPlayer = players.find((p) => p.id === playerId)
  const myCard = myPlayer?.card ?? []

  const showToast = lastClaim?.correct === true
  const claimantName = lastClaim ? (players.find((p) => p.id === lastClaim.playerId)?.name ?? 'Someone') : ''
  const toastText = lastClaim?.correct
    ? lastClaim.playerId === playerId ? '✓ Correct! +1' : `${claimantName} got it!`
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

  const handleClaim = (symbol: number) => {
    if (claimSent) return
    setClaimSent(true)
    claim(symbol)
    setTimeout(() => setClaimSent(false), 2000)
  }

  const highlightNum = lastClaim?.correct ? lastClaim.symbol : null
  const highlightAnswerEnabled = useDevStore((s) => s.highlightAnswer)
  const answerNum = (import.meta.env.DEV && highlightAnswerEnabled)
    ? myCard.find((n) => centerCard.includes(n)) ?? null
    : null

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
            <Scoreboard players={players} currentPlayerId={playerId} layout="vertical" className="w-full" />
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
              <div className="w-full flex items-center justify-center gap-2 border-b border-border bg-blue-50 text-blue-700 px-6 py-4 text-sm shrink-0">
                <span className="shrink-0">💡</span>
                <span>Find the one number shared between your card and the center card, then tap it to claim!</span>
              </div>
            )}
            <div className="w-full flex items-center justify-center gap-3 border-b border-border bg-muted px-6 py-2.5 shrink-0">
              <span className="text-2xl font-black tabular-nums text-foreground">
                {isSpectator
                  ? players.reduce((sum, p) => sum + (p.cards_left ?? 0), 0)
                  : (myPlayer?.cards_left ?? 0)}
              </span>
              <span className="text-sm font-semibold text-muted-foreground">
                {isSpectator ? 'cards left' : 'cards left in your deck'}
              </span>
            </div>
            <div className="md:hidden border-b border-border px-4 py-2 shrink-0">
              <Scoreboard players={players} currentPlayerId={playerId ?? ''} layout="horizontal" />
            </div>
          </>
        }
      >
        {phase === 'finished' && gameOverToast ? (
          <main className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto min-w-0">
            <div className="w-full max-w-md flex flex-col gap-5">
              <div className="text-center flex flex-col items-center gap-1">
                <span className="text-5xl">🏆</span>
                <h2 className="text-2xl font-extrabold mt-2">
                  {gameOverToast.winner
                    ? gameOverToast.winner.id === playerId ? 'You won!' : `${gameOverToast.winner.name} wins!`
                    : 'Game over!'}
                </h2>
              </div>
              <div className="flex flex-col gap-1.5">
                {[...gameOverToast.players]
                  .sort((a, b) => b.score - a.score)
                  .map((p, i) => (
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
                      <span>{p.score} pt{p.score !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
              </div>
              {isHost ? (
                <Button size="lg" className="w-full" onClick={restartGame}>Play Again</Button>
              ) : (
                <p className="text-center text-sm text-muted-foreground">Waiting for the host to start a new game…</p>
              )}
            </div>
          </main>
        ) : (
          <main className="flex-1 flex flex-col items-center p-6 overflow-y-auto min-w-0">
            <div className="w-full max-w-md flex flex-col gap-4">
              <div className="flex flex-col gap-10 pt-8">
                <div className="flex flex-col gap-1.5">
                  <NumberCard
                    key={centerCard.join(',')}
                    numbers={centerCard}
                    label="Center Card"
                    highlightNumber={highlightNum}
                    clickable={false}
                    className="w-full animate-card-in"
                  />
                  {lastClaim?.correct && (
                    <div className="flex flex-col gap-1.5">
                      <div className="h-2 w-full rounded-full bg-green-100 overflow-hidden">
                        <div
                          key={lastClaim.symbol}
                          className="h-full bg-green-500 rounded-full"
                          style={{ animation: `penalty-fill ${settings.correct_claim_lock_ms}ms linear forwards` }}
                        />
                      </div>
                      <p className="text-center text-sm font-medium text-green-600">Next round starting…</p>
                    </div>
                  )}
                </div>

                {isSpectator ? (
                  <div className="flex flex-col items-center gap-3 py-6 border border-dashed border-border">
                    <p className="text-center text-muted-foreground text-sm">You are spectating — watch the action above.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <NumberCard
                      numbers={myCard}
                      label="Your Card — tap the matching number!"
                      onClaim={handleClaim}
                      clickable={!claimSent && countdown === null && (lastClaim === null || (!lastClaim.correct && lastClaim.playerId !== playerId))}
                      highlightNumber={answerNum ?? highlightNum}
                      className="w-full"
                    />
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
