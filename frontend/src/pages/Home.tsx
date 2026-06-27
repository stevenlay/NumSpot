import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export default function Home() {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [roomCode, setRoomCode] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; roomCode?: string }>({})
  const connect = useGameStore((s) => s.connect)
  const error = useGameStore((s) => s.error)
  const resetError = useGameStore((s) => s.resetError)
  const navigate = useNavigate()
  const phase = useGameStore((s) => s.phase)

  useEffect(() => {
    if (phase === 'lobby') {
      navigate('/lobby', { replace: true })
    }
  }, [phase, navigate])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    resetError()
    const errors: { name?: string; roomCode?: string } = {}
    const trimmedName = name.trim()
    if (!trimmedName) errors.name = 'Please enter your name.'
    else if (trimmedName.length < 2) errors.name = 'Name must be at least 2 characters.'
    else if (trimmedName.length > 24) errors.name = 'Name must be 24 characters or fewer.'
    else if (!/^[a-zA-Z0-9 '_\-.]+$/.test(trimmedName)) errors.name = "Name can only contain letters, numbers, spaces, and - _ ' ."
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
            <span className="text-blue-500">NumSpot</span>
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

            <Tabs value={mode} onValueChange={(v) => { resetError(); setMode(v as 'create' | 'join') }}>
              <TabsList className="w-full">
                <TabsTrigger value="create" className="flex-1">Create Room</TabsTrigger>
                <TabsTrigger value="join" className="flex-1">Join Room</TabsTrigger>
              </TabsList>

              <TabsContent value="join" className="mt-3">
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
              </TabsContent>
            </Tabs>

            <Button type="submit" size="lg" className="w-full bg-blue-700 hover:bg-blue-800 text-white">
              {mode === 'create' ? 'Create & Enter Lobby' : 'Enter Room'}
            </Button>
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
