import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import NumberCard from '../components/game/NumberCard'
import Scoreboard from '../components/game/Scoreboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export default function Game() {
  const navigate = useNavigate()
  const phase = useGameStore((s) => s.phase)
  const playerId = useGameStore((s) => s.playerId)
  const players = useGameStore((s) => s.players)
  const centerCard = useGameStore((s) => s.centerCard)
  const lastClaim = useGameStore((s) => s.lastClaim)
  const winner = useGameStore((s) => s.winner)
  const claim = useGameStore((s) => s.claim)
  const goHome = useGameStore((s) => s.goHome)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
                {winner.id === playerId ? 'You win!' : `${winner.name} wins!`}
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
              Play Again
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showToast && toastText && (
        <div
          className={cn(
            'fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg font-bold text-white text-sm',
            lastClaim?.correct ? 'bg-green-500' : 'bg-red-500'
          )}
          style={{ animation: `toast-out ${lastClaim?.correct ? '3s' : '1.5s'} ease-in forwards` }}
        >
          {toastText}
        </div>
      )}

      <div className="flex flex-col items-center gap-4 p-4 max-w-lg mx-auto w-full">
        <div className="w-full flex items-center justify-between pt-2">
          <h1 className="text-xl font-extrabold"><span className="text-blue-500">NumSpot</span></h1>
          <Button variant="ghost" size="sm" onClick={goHome} className="text-muted-foreground text-xs">
            Leave
          </Button>
        </div>

        <div className="w-full flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-2.5 text-xs">
          <span className="shrink-0">💡</span>
          <span>Find the one number shared between your card and the center card, then tap it to claim!</span>
        </div>

        <Scoreboard players={players} currentPlayerId={playerId} className="w-full" />

        <NumberCard
          key={centerCard.join(',')}
          numbers={centerCard}
          label="Center Card"
          highlightNumber={highlightNum}
          clickable={false}
          className="w-full animate-card-in"
        />

        <NumberCard
          numbers={myCard}
          label="Your Card — tap the matching number!"
          onClaim={claim}
          clickable={lastClaim === null}
          highlightNumber={highlightNum}
          className="w-full"
        />

      </div>
    </div>
  )
}
