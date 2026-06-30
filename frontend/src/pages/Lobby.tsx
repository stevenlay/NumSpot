import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import type { RoomSettings } from '../types/game'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, Check, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import GameShell from '../components/game/GameShell'

const DEFAULT_SETTINGS: RoomSettings = {
  max_players: 8,
  deck_size: 57,
  wrong_claim_penalty_ms: 1500,
  correct_claim_lock_ms: 2000,
  rounds: 1,
}

const WRONG_CLAIM_PRESETS = [
  { label: 'Off', ms: 0 },
  { label: 'Short', ms: 750 },
  { label: 'Normal', ms: 1500 },
  { label: 'Long', ms: 3000 },
] as const

const CORRECT_CLAIM_PRESETS = [
  { label: 'Off', ms: 0 },
  { label: 'Short', ms: 1000 },
  { label: 'Normal', ms: 2000 },
  { label: 'Long', ms: 4000 },
] as const

const DECK_SIZE_PRESETS = [
  { label: '13', cards: 13 },
  { label: '31', cards: 31 },
  { label: '57', cards: 57 },
] as const

export default function Lobby() {
  const roomCode = useGameStore((s) => s.roomCode)
  const players = useGameStore((s) => s.players)
  const isHost = useGameStore((s) => s.isHost)
  const isSpectator = useGameStore((s) => s.isSpectator)
  const phase = useGameStore((s) => s.phase)
  const playerId = useGameStore((s) => s.playerId)
  const settings = useGameStore((s) => s.settings)
  const spectators = useGameStore((s) => s.spectators)
  const startGame = useGameStore((s) => s.startGame)
  const updateSettings = useGameStore((s) => s.updateSettings)
  const joinAsPlayer = useGameStore((s) => s.joinAsPlayer)
  const mutePlayer = useGameStore((s) => s.mutePlayer)
  const goHome = useGameStore((s) => s.goHome)
  const disconnected = useGameStore((s) => s.disconnected)
  const error = useGameStore((s) => s.error)
  const resetError = useGameStore((s) => s.resetError)
  const gameOverToast = useGameStore((s) => s.gameOverToast)
  const [copied, setCopied] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (error) setStarting(false)
  }, [error])

  if (phase === 'playing') return <Navigate to={`/game/${roomCode}`} replace />

  const copyCode = () => {
    const url = `${window.location.origin}/join/${roomCode}`
    navigator.clipboard.writeText(url).catch(() => { })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <GameShell
      centerBanner={
        !isSpectator && (
          <div className="w-full flex items-center justify-center gap-2 border-b border-border bg-blue-50 text-blue-700 px-6 py-4 text-sm shrink-0">
            <span className="shrink-0">💡</span>
            <span>Find the one number shared between your card and the center card, then tap it to claim!</span>
          </div>
        )
      }
      sidebarContent={
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Players ({players.length}/{settings.max_players})
          </span>
          {(() => {
            const showScores = players.some((p) => p.session_score > 0)
            return players.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium truncate text-foreground flex-1">
                  {p.name}{p.id === playerId ? ' (you)' : ''}
                </span>
                {p.muted && !isHost && <MicOff className="w-3 h-3 shrink-0 text-red-400" />}
                {showScores && (
                  <span className="font-bold text-xs text-primary shrink-0">{p.session_score}</span>
                )}
                {isHost && p.id !== playerId && (
                  <button
                    onClick={() => mutePlayer(p.id)}
                    title={p.muted ? 'Unmute' : 'Mute'}
                    className={cn(
                      'p-0.5 rounded transition-colors',
                      p.muted ? 'text-red-500 hover:text-red-700' : 'text-muted-foreground/40 hover:text-muted-foreground'
                    )}
                  >
                    <MicOff className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          })()}
          {spectators.length > 0 && (
            <>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">
                Spectating ({spectators.length})
              </span>
              {spectators.map((s) => (
                <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center font-bold text-xs shrink-0">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate">
                    {s.name}{s.id === playerId ? ' (you)' : ''}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      }
    >
      <main className="flex-1 flex flex-col p-6 overflow-y-auto min-w-0 items-center">
        <div className="w-full max-w-xl flex flex-col gap-5">

        {/* Alerts */}
        {disconnected && (
          <Alert variant="destructive" className="w-full">
            <AlertDescription className="flex items-center justify-between">
              <span>Connection lost.</span>
              <button onClick={goHome} className="underline font-semibold ml-2 shrink-0">Return Home</button>
            </AlertDescription>
          </Alert>
        )}
        {!disconnected && error && (
          <Alert variant="destructive" className="w-full">
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <button onClick={resetError} className="underline font-semibold ml-2 shrink-0">Dismiss</button>
            </AlertDescription>
          </Alert>
        )}

        {/* Game over results */}
        {gameOverToast && (() => {
          const isFinalRound = gameOverToast.currentRound >= gameOverToast.totalRounds
          const scoreOf = (p: { score: number; session_score: number }) => isFinalRound ? p.session_score + p.score : p.score
          const sorted = [...gameOverToast.players].sort((a, b) => scoreOf(b) - scoreOf(a))
          const top3 = sorted.slice(0, 3)
          const selfRank = sorted.findIndex(p => p.id === playerId)
          const heading = isFinalRound
            ? (gameOverToast.winner ? (gameOverToast.winner.id === playerId ? 'You won the session!' : `${gameOverToast.winner.name} wins the session!`) : 'Session over!')
            : (gameOverToast.winner ? (gameOverToast.winner.id === playerId ? 'You won this round!' : `${gameOverToast.winner.name} wins this round!`) : 'Round over!')
          return (
            <div className="w-full border border-border bg-card shadow-md px-8 py-6 flex flex-col gap-2">
              <div className="flex items-center justify-center gap-2 text-center">
                <span className="text-2xl">{isFinalRound ? '🏆' : '✓'}</span>
                <div className="flex flex-col items-center">
                  {gameOverToast.totalRounds > 1 && (
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {isFinalRound ? `All ${gameOverToast.totalRounds} rounds complete` : `Round ${gameOverToast.currentRound} of ${gameOverToast.totalRounds}`}
                    </span>
                  )}
                  <span className="text-xl font-extrabold text-foreground">{heading}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <>
                  {top3.map((p, i) => (
                    <div key={p.id} className={cn(
                      'flex justify-between items-center px-4 py-1.5 rounded-lg font-semibold',
                      i === 0 && 'bg-yellow-100 text-yellow-900 text-base',
                      i === 1 && 'bg-slate-100 text-slate-700 text-sm',
                      i === 2 && 'bg-orange-100 text-orange-800 text-sm',
                    )}>
                      <span>{i + 1}. {p.name}{p.id === playerId ? ' (you)' : ''}</span>
                      <span>{scoreOf(p)} pts</span>
                    </div>
                  ))}
                  {selfRank >= 3 && (
                    <>
                      <div className="text-center text-xs text-muted-foreground opacity-50 leading-none">···</div>
                      <div className="flex justify-between items-center text-sm px-4 py-1.5 rounded-lg text-muted-foreground">
                        <span>{selfRank + 1}. {sorted[selfRank].name} (you)</span>
                        <span>{scoreOf(sorted[selfRank])} pts</span>
                      </div>
                    </>
                  )}
                </>
              </div>
            </div>
          )
        })()}

        {/* Mobile: room code + players */}
        <div className="md:hidden w-full flex flex-col gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Room Code</span>
            <span className="text-3xl font-black tracking-[0.3em] font-mono">{roomCode}</span>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy code'}
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Players ({players.length}/{settings.max_players})
            </span>
            {(() => {
              const showScores = players.some((p) => p.session_score > 0)
              return players.map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-foreground text-sm flex-1">
                    {p.name}{p.id === playerId ? ' (you)' : ''}
                  </span>
                  {p.muted && !isHost && <MicOff className="w-3.5 h-3.5 shrink-0 text-red-400" />}
                  {showScores && (
                    <span className="font-bold text-sm text-primary shrink-0">{p.session_score}</span>
                  )}
                  {isHost && p.id !== playerId && (
                    <button
                      onClick={() => mutePlayer(p.id)}
                      title={p.muted ? 'Unmute' : 'Mute'}
                      className={cn(
                        'p-1 rounded transition-colors',
                        p.muted ? 'text-red-500 hover:text-red-700' : 'text-muted-foreground/40 hover:text-muted-foreground'
                      )}
                    >
                      <MicOff className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            })()}
            {spectators.length > 0 && (
              <>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">
                  Spectating ({spectators.length})
                </span>
                {spectators.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-2.5">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center font-bold text-xs shrink-0 text-muted-foreground">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-muted-foreground text-sm">
                      {s.name}{s.id === playerId ? ' (you)' : ''}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="w-full border border-border bg-card p-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</span>
            {!isHost && <span className="text-[10px] text-muted-foreground">Host only</span>}
          </div>

          {/* Max players */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm">Max players</span>
              <span className={cn('text-sm tabular-nums', settings.max_players !== DEFAULT_SETTINGS.max_players ? 'text-primary font-medium' : 'text-muted-foreground')}>{settings.max_players}</span>
            </div>
            {isHost && (
              <div className="flex gap-1">
                {[2, 3, 4, 5, 6, 7, 8].map((n) => {
                  const tooFew = n < players.length
                  return (
                    <button
                      key={n}
                      onClick={() => !tooFew && updateSettings({ ...settings, max_players: n })}
                      disabled={tooFew}
                      className={cn(
                        'flex-1 text-sm py-2.5 rounded transition-colors',
                        tooFew
                          ? 'bg-muted text-muted-foreground/40 cursor-not-allowed'
                          : settings.max_players === n
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      )}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Deck size */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm">Deck size</span>
              <span className={cn('text-sm tabular-nums', settings.deck_size !== DEFAULT_SETTINGS.deck_size ? 'text-primary font-medium' : 'text-muted-foreground')}>
                {settings.deck_size} cards
              </span>
            </div>
            {isHost && (
              <div className="flex gap-1">
                {DECK_SIZE_PRESETS.map((p) => (
                  <button
                    key={p.cards}
                    onClick={() => updateSettings({ ...settings, deck_size: p.cards })}
                    className={cn(
                      'flex-1 text-sm py-2.5 rounded transition-colors',
                      settings.deck_size === p.cards
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Wrong claim penalty */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm">Wrong claim penalty</span>
              <span className={cn('text-sm', settings.wrong_claim_penalty_ms !== DEFAULT_SETTINGS.wrong_claim_penalty_ms ? 'text-primary font-medium' : 'text-muted-foreground')}>
                {WRONG_CLAIM_PRESETS.find((p) => p.ms === settings.wrong_claim_penalty_ms)?.label ?? `${settings.wrong_claim_penalty_ms}ms`}
              </span>
            </div>
            {isHost && (
              <div className="flex gap-1">
                {WRONG_CLAIM_PRESETS.map((p) => (
                  <button
                    key={p.ms}
                    onClick={() => updateSettings({ ...settings, wrong_claim_penalty_ms: p.ms })}
                    className={cn(
                      'flex-1 text-sm py-2.5 rounded transition-colors',
                      settings.wrong_claim_penalty_ms === p.ms
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Correct claim lock */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm">Correct claim lock</span>
              <span className={cn('text-sm', settings.correct_claim_lock_ms !== DEFAULT_SETTINGS.correct_claim_lock_ms ? 'text-primary font-medium' : 'text-muted-foreground')}>
                {CORRECT_CLAIM_PRESETS.find((p) => p.ms === settings.correct_claim_lock_ms)?.label ?? `${settings.correct_claim_lock_ms}ms`}
              </span>
            </div>
            {isHost && (
              <div className="flex gap-1">
                {CORRECT_CLAIM_PRESETS.map((p) => (
                  <button
                    key={p.ms}
                    onClick={() => updateSettings({ ...settings, correct_claim_lock_ms: p.ms })}
                    className={cn(
                      'flex-1 text-sm py-2.5 rounded transition-colors',
                      settings.correct_claim_lock_ms === p.ms
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Rounds */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm">Rounds</span>
              <span className={cn('text-sm tabular-nums', settings.rounds !== DEFAULT_SETTINGS.rounds ? 'text-primary font-medium' : 'text-muted-foreground')}>
                {settings.rounds}
              </span>
            </div>
            {isHost && (
              <div className="flex gap-1">
                {[1, 3, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => updateSettings({ ...settings, rounds: n })}
                    className={cn(
                      'flex-1 text-sm py-2.5 rounded transition-colors',
                      settings.rounds === n
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Start game / spectator join */}
        <div className="w-full flex flex-col items-center gap-3">
          {isSpectator ? (
            <>
              <p className="text-sm text-muted-foreground text-center">
                You're spectating. Join as a player when a slot opens.
              </p>
              <Button
                onClick={joinAsPlayer}
                disabled={players.length >= settings.max_players || disconnected}
                size="lg"
                className="w-full"
              >
                Join as Player
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground text-center">
                {isHost ? 'Ready when you are.' : 'Waiting for the host to start…'}
              </p>
              <Button
                onClick={() => { if (isHost) { setStarting(true); startGame() } }}
                disabled={!isHost || starting || disconnected}
                size="lg"
                className="w-full"
              >
                {starting ? 'Starting…' : 'Start Game'}
              </Button>
            </>
          )}
        </div>
        </div>
      </main>
    </GameShell>
  )
}
