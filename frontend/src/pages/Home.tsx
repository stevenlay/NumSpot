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
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; roomCode?: string }>({})
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
    const errors: { name?: string; roomCode?: string } = {}
    if (!name.trim()) errors.name = 'Please enter your name.'
    if (mode === 'join' && !roomCode.trim()) errors.roomCode = 'Please enter a room code.'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    if (mode === 'join') {
      connect(name.trim(), roomCode.trim().toUpperCase())
    } else {
      connect(name.trim())
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-extrabold tracking-tight">
            <span className="text-foreground">Num</span><span className="text-blue-500">Spot</span>
          </CardTitle>
          <CardDescription>spot the number. win the round.</CardDescription>
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
                onChange={(e) => { setName(e.target.value); setFieldErrors((fe) => ({ ...fe, name: undefined })) }}
                placeholder="Enter your name"
                maxLength={24}
                aria-invalid={!!fieldErrors.name}
                className={cn(fieldErrors.name && 'border-destructive focus-visible:ring-destructive')}
              />
              {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
            </div>

            {mode === 'join' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="roomCode">Room Code</Label>
                <Input
                  id="roomCode"
                  type="text"
                  value={roomCode}
                  onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); setFieldErrors((fe) => ({ ...fe, roomCode: undefined })) }}
                  placeholder="e.g. ABC123"
                  maxLength={6}
                  className={cn('uppercase tracking-widest', fieldErrors.roomCode && 'border-destructive focus-visible:ring-destructive')}
                  aria-invalid={!!fieldErrors.roomCode}
                />
                {fieldErrors.roomCode && <p className="text-sm text-destructive">{fieldErrors.roomCode}</p>}
              </div>
            )}

            <div className="flex bg-muted rounded-lg p-1 gap-1">
              {(['create', 'join'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { resetError(); setMode(mode === m ? null : m) }}
                  className={cn(
                    'flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                    mode === m
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {m === 'create' ? 'Create Room' : 'Join Room'}
                </button>
              ))}
            </div>

            {mode && (
              <Button type="submit" size="lg" className="w-full bg-blue-700 hover:bg-blue-800 text-white">
                {mode === 'create' ? 'Create & Enter Lobby' : 'Enter Room'}
              </Button>
            )}
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-xs text-muted-foreground text-center">
            Find the matching number between your card and the center card.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
