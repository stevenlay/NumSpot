import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import NumberCard from '../components/game/NumberCard'
import Scoreboard from '../components/game/Scoreboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

export default function Game() {
  const navigate = useNavigate()
  const phase = useGameStore((s) => s.phase)
  const playerId = useGameStore((s) => s.playerId)
  const players = useGameStore((s) => s.players)
  const centerCard = useGameStore((s) => s.centerCard)
  const lastClaim = useGameStore((s) => s.lastClaim)
  const winner = useGameStore((s) => s.winner)
  const deckSize = useGameStore((s) => s.deckSize)
  const countdown = useGameStore((s) => s.countdown)
  const roomCode = useGameStore((s) => s.roomCode)
  const claim = useGameStore((s) => s.claim)
  const goHome = useGameStore((s) => s.goHome)
  const isSpectator = useGameStore((s) => s.isSpectator)
  const disconnected = useGameStore((s) => s.disconnected)
  const rejoin = useGameStore((s) => s.rejoin)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [claimSent, setClaimSent] = useState(false)

  const myPlayer = players.find((p) => p.id === playerId)
  const myCard = myPlayer?.card ?? []

  const showToast = lastClaim !== null
  const claimantName = lastClaim ? (players.find((p) => p.id === lastClaim.playerId)?.name ?? 'Someone') : ''
  const toastText = lastClaim
    ? lastClaim.correct
      ? lastClaim.playerId === playerId
        ? '✓ Correct! +1'
        : `${claimantName} got it!`
      : lastClaim.playerId === playerId
        ? '✗ Wrong number!'
        : `${claimantName} missed!`
    : null

  useEffect(() => {
    return () => {
      if (toastRef.current) clearTimeout(toastRef.current)
    }
  }, [])

  useEffect(() => {
    if (phase === 'home') {
      navigate('/', { replace: true })
    }
  }, [phase, navigate])

  useEffect(() => {
    if (lastClaim !== null) {
      const delay = lastClaim.correct ? 2000 : 1500
      const timer = setTimeout(() => setClaimSent(false), delay)
      return () => clearTimeout(timer)
    }
  }, [lastClaim])

  const handleClaim = (symbol: number) => {
    if (claimSent) return
    setClaimSent(true)
    claim(symbol)
    // Safety reset for rejected claims (no server response sent back)
    setTimeout(() => setClaimSent(false), 2000)
  }

  const highlightNum = lastClaim?.correct ? lastClaim.symbol : null

  if (phase === 'finished') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md shadow-lg text-center">
          <CardHeader>
            <div className="text-5xl mb-2">🎉</div>
            <CardTitle className="text-3xl font-extrabold text-primary">Game Over!</CardTitle>
            {winner && (
              <p className="text-xl font-semibold text-foreground">
                {isSpectator
                  ? `${winner.name} wins!`
                  : winner.id === playerId
                    ? 'You win!'
                    : `${winner.name} wins!`}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 text-left">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Final Scores</h2>
              {[...players]
                .sort((a, b) => b.score - a.score)
                .map((p, i) => (
                  <div
                    key={p.id}
                    className={cn(
                      'flex justify-between items-center px-4 py-3 rounded-lg',
                      i === 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-muted/50'
                    )}
                  >
                    <span className="font-medium text-foreground">
                      {i === 0 ? '🏆 ' : `${i + 1}. `}
                      {p.name}
                      {p.id === playerId ? ' (you)' : ''}
                    </span>
                    <span className="font-bold text-primary">{p.score} pts</span>
                  </div>
                ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={goHome} size="lg" className="w-full">
              {isSpectator ? 'Back to Home' : 'Play Again'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/80 backdrop-blur-sm">
          <span
            key={countdown}
            className="text-8xl font-black text-blue-500 animate-card-in"
          >
            {countdown === 0 ? 'Go!' : countdown}
          </span>
          {countdown > 0 && (
            <div className="flex items-center gap-3 bg-blue-50 border-2 border-blue-200 text-blue-700 rounded-xl px-6 py-4 text-base font-medium max-w-sm text-center shadow-sm">
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
          style={{ animation: `toast-out ${lastClaim?.correct ? '2s' : '1.5s'} ease-in forwards` }}
        >
          {toastText}
        </div>
      )}

      {disconnected && (
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
          <AlertDescription className="flex items-center justify-between max-w-md mx-auto w-full">
            <span>Connection lost.</span>
            <button onClick={rejoin} className="underline font-semibold ml-2">
              Reconnect
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="w-full flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold"><span className="text-blue-500">NumSpot</span></h1>
          <span className="md:hidden text-sm font-black tracking-widest text-foreground">{roomCode}</span>
        </div>
        <div className="flex items-center gap-3">
          {isSpectator && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">Spectating</span>
          )}
          <span className="text-xs text-muted-foreground">{deckSize} cards left</span>
          <Button variant="ghost" size="sm" onClick={goHome} className="text-muted-foreground text-xs">
            Leave
          </Button>
        </div>
      </div>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar — hidden on small screens */}
        <aside className="hidden md:flex md:w-56 shrink-0 border-r border-border p-4 overflow-y-auto flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Room Code</span>
            <span className="text-2xl font-black tracking-widest text-foreground">{roomCode}</span>
          </div>
          <Scoreboard players={players} currentPlayerId={playerId} layout="vertical" className="w-full" />
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col items-center p-6 overflow-y-auto">
          <div className="w-full max-w-md flex flex-col gap-4">
            {!isSpectator && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-2.5 text-xs">
                <span className="shrink-0">💡</span>
                <span>Find the one number shared between your card and the center card, then tap it to claim!</span>
              </div>
            )}

            <div className="flex flex-col gap-10 pt-16">
              <NumberCard
                key={centerCard.join(',')}
                numbers={centerCard}
                label="Center Card"
                highlightNumber={highlightNum}
                clickable={false}
                className="w-full animate-card-in"
              />

              {isSpectator ? (
                <div className="text-center text-muted-foreground text-sm py-6 border border-dashed border-border rounded-xl">
                  You are spectating — watch the action above.
                </div>
              ) : (
                <NumberCard
                  numbers={myCard}
                  label="Your Card — tap the matching number!"
                  onClaim={handleClaim}
                  clickable={!claimSent && countdown === null && (lastClaim === null || (!lastClaim.correct && lastClaim.playerId !== playerId))}
                  highlightNumber={highlightNum}
                  className="w-full"
                />
              )}
            </div>
          </div>
        </main>

      </div>
    </div>
  )
}
