import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import ChatPanel from '../components/game/ChatPanel'

export default function Lobby() {
  const roomCode = useGameStore((s) => s.roomCode)
  const players = useGameStore((s) => s.players)
  const isHost = useGameStore((s) => s.isHost)
  const phase = useGameStore((s) => s.phase)
  const playerId = useGameStore((s) => s.playerId)
  const startGame = useGameStore((s) => s.startGame)
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

  if (phase === 'playing') return <Navigate to="/game" replace />

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }


  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="w-full flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold"><span className="text-blue-500">NumSpot</span></h1>
          <span className="md:hidden text-sm font-black tracking-widest text-foreground">{roomCode}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={goHome} className="text-muted-foreground text-xs">
          Leave
        </Button>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left sidebar */}
        <aside className="hidden md:flex md:w-56 shrink-0 border-r border-border p-4 overflow-y-auto flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Room Code</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-widest text-foreground font-mono">{roomCode}</span>
              <button
                onClick={copyCode}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title={copied ? 'Copied!' : 'Copy code'}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Players ({players.length}/8)
            </span>
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium truncate text-foreground">
                  {p.name}{p.id === playerId ? ' (you)' : ''}
                </span>
              </div>
            ))}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto min-w-0 gap-5">

          {/* Alerts */}
          {disconnected && (
            <Alert variant="destructive" className="w-full max-w-sm">
              <AlertDescription className="flex items-center justify-between">
                <span>Connection lost.</span>
                <button onClick={goHome} className="underline font-semibold ml-2 shrink-0">Return Home</button>
              </AlertDescription>
            </Alert>
          )}
          {!disconnected && error && (
            <Alert variant="destructive" className="w-full max-w-sm">
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <button onClick={resetError} className="underline font-semibold ml-2 shrink-0">Dismiss</button>
              </AlertDescription>
            </Alert>
          )}

          {/* Game over results */}
          {gameOverToast && (
            <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-md px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center">
                <span className="font-bold text-foreground">
                  🏆 {gameOverToast.winner
                    ? gameOverToast.winner.id === playerId ? 'You won!' : `${gameOverToast.winner.name} wins!`
                    : 'Game over!'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {(() => {
                  const sorted = [...gameOverToast.players].sort((a, b) => b.score - a.score)
                  const top3 = sorted.slice(0, 3)
                  const selfRank = sorted.findIndex(p => p.id === playerId)
                  return (
                    <>
                      {top3.map((p, i) => (
                        <div key={p.id} className={cn(
                          'flex justify-between items-center text-sm px-3 py-1.5 rounded-lg font-semibold',
                          i === 0 && 'bg-yellow-100 text-yellow-900',
                          i === 1 && 'bg-slate-100 text-slate-700',
                          i === 2 && 'bg-orange-100 text-orange-800',
                        )}>
                          <span>{i + 1}. {p.name}{p.id === playerId ? ' (you)' : ''}</span>
                          <span>{p.score} pts</span>
                        </div>
                      ))}
                      {selfRank >= 3 && (
                        <>
                          <div className="text-center text-xs text-muted-foreground opacity-50 leading-none">···</div>
                          <div className="flex justify-between items-center text-sm px-3 py-1.5 rounded-lg text-muted-foreground">
                            <span>{selfRank + 1}. {sorted[selfRank].name} (you)</span>
                            <span>{sorted[selfRank].score} pts</span>
                          </div>
                        </>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Mobile: room code + players */}
          <div className="md:hidden w-full max-w-sm flex flex-col gap-4">
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
                Players ({players.length}/8)
              </span>
              {players.map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-foreground text-sm">
                    {p.name}{p.id === playerId ? ' (you)' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Start game */}
          <div className="w-full max-w-sm flex flex-col items-center gap-3">
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
          </div>
        </main>

        {/* Right sidebar — chat */}
        <ChatPanel />
      </div>
    </div>
  )
}
