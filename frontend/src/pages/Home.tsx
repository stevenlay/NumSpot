import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

export default function Home() {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'create' | 'join' | null>(null)
  const [roomCode, setRoomCode] = useState('')
  const connect = useGameStore((s) => s.connect)
  const error = useGameStore((s) => s.error)
  const resetError = useGameStore((s) => s.resetError)
  const navigate = useNavigate()
  const phase = useGameStore((s) => s.phase)

  if (phase === 'lobby') {
    navigate('/lobby', { replace: true })
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    resetError()
    if (!name.trim()) return
    if (mode === 'join') {
      if (!roomCode.trim()) return
      connect(name.trim(), roomCode.trim().toUpperCase())
    } else {
      connect(name.trim())
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-extrabold text-primary tracking-tight">NumSpot</CardTitle>
          <CardDescription>The multiplayer number spotting game</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                maxLength={24}
                required
              />
            </div>

            {mode === 'join' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="roomCode">Room Code</Label>
                <Input
                  id="roomCode"
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABC123"
                  maxLength={6}
                  className="uppercase tracking-widest"
                  required
                />
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant={mode === 'create' ? 'default' : 'secondary'}
                className="flex-1"
                onClick={() => {
                  resetError()
                  setMode(mode === 'create' ? null : 'create')
                }}
              >
                Create Room
              </Button>
              <Button
                type="button"
                variant={mode === 'join' ? 'default' : 'secondary'}
                className={cn('flex-1', mode === 'join' && 'bg-purple-600 hover:bg-purple-700 text-white')}
                onClick={() => {
                  resetError()
                  setMode(mode === 'join' ? null : 'join')
                }}
              >
                Join Room
              </Button>
            </div>

            {mode && (
              <Button type="submit" size="lg" className="w-full">
                {mode === 'create' ? 'Create & Enter Lobby' : 'Join Room'}
              </Button>
            )}
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-xs text-muted-foreground text-center">
            Find the matching number between your card and the center card — first to claim it wins the round!
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
