import { Navigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'

export default function Lobby() {
  const roomCode = useGameStore((s) => s.roomCode)
  const players = useGameStore((s) => s.players)
  const isHost = useGameStore((s) => s.isHost)
  const phase = useGameStore((s) => s.phase)
  const startGame = useGameStore((s) => s.startGame)
  const goHome = useGameStore((s) => s.goHome)

  if (phase === 'playing' || phase === 'finished') return <Navigate to="/game" replace />

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).catch(() => {})
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-extrabold text-primary">Game Lobby</CardTitle>
          <CardDescription>Share the room code with friends</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Room Code</span>
            <Button
              variant="outline"
              onClick={copyCode}
              title="Click to copy"
              className="text-4xl font-black tracking-[0.3em] text-primary border-2 border-primary/30 rounded-xl px-6 h-auto py-3"
            >
              {roomCode}
            </Button>
            <span className="text-xs text-muted-foreground">Click to copy</span>
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
              <Button onClick={startGame} disabled={players.length < 2} size="lg" className="w-full">
                {players.length < 2 ? 'Waiting for more players…' : 'Start Game'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">Need at least 2 players to start</p>
            </div>
          ) : (
            <div className="text-center text-muted-foreground text-sm bg-muted/50 rounded-lg py-4">
              Waiting for the host to start the game…
            </div>
          )}
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
