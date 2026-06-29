import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, Check } from 'lucide-react'

export default function Lobby() {
  const roomCode = useGameStore((s) => s.roomCode)
  const players = useGameStore((s) => s.players)
  const isHost = useGameStore((s) => s.isHost)
  const phase = useGameStore((s) => s.phase)
  const startGame = useGameStore((s) => s.startGame)
  const goHome = useGameStore((s) => s.goHome)
  const disconnected = useGameStore((s) => s.disconnected)
  const error = useGameStore((s) => s.error)
  const resetError = useGameStore((s) => s.resetError)
  const [copied, setCopied] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (error) setStarting(false)
  }, [error])

  if (phase === 'playing' || phase === 'finished') return <Navigate to="/game" replace />

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-extrabold tracking-tight">
            <span className="text-blue-500">Game Lobby</span>
          </CardTitle>
          <CardDescription>
            {isHost ? 'Share the room code with friends' : 'Waiting for the host to start the game…'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {disconnected ? (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between">
                <span>Connection lost.</span>
                <button
                  onClick={goHome}
                  className="underline font-semibold ml-2 shrink-0"
                >
                  Return Home
                </button>
              </AlertDescription>
            </Alert>
          ) : error && (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <button onClick={resetError} className="underline font-semibold ml-2 shrink-0">
                  Dismiss
                </button>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col items-center gap-3">
            <div className="border-2 border-border rounded-xl px-8 py-3">
              <span className="text-3xl font-black tracking-[0.3em] text-foreground font-mono">{roomCode}</span>
            </div>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'copied!' : 'copy code'}
            </button>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Players ({players.length}/8)
            </h2>
            <ul className="flex flex-col gap-2">
              {players.map((p) => (
                <li key={p.id} className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-foreground">{p.name}</span>
                </li>
              ))}
            </ul>
          </div>

          {isHost ? (
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => { setStarting(true); startGame() }}
                disabled={starting || disconnected}
                size="lg"
                className="w-full"
              >
                {starting ? 'Starting…' : 'Start Game'}
              </Button>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="justify-center">
          <Button variant="ghost" size="sm" onClick={goHome} className="text-muted-foreground">
            Leave room
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
