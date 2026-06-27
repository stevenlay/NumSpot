import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Player } from '../../types/game'

interface ScoreboardProps {
  players: Player[]
  currentPlayerId: string
  className?: string
}

export default function Scoreboard({ players, currentPlayerId, className }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  const maxScore = sorted[0]?.score ?? 0

  return (
    <div className={cn('w-full', className)}>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Scores</h2>
      <div className="flex flex-wrap gap-2 justify-center">
        {sorted.map((p, i) => {
          const isLeader = p.score === maxScore && maxScore > 0
          const isYou = p.id === currentPlayerId
          return (
            <Badge
              key={p.id}
              variant={isLeader ? 'default' : 'secondary'}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium h-auto',
                isLeader && 'bg-yellow-50 border border-yellow-300 text-yellow-800 hover:bg-yellow-50',
                isYou && 'ring-2 ring-primary ring-offset-1',
              )}
            >
              <span className="text-lg">{i === 0 && isLeader ? '🏆' : '•'}</span>
              <span>{p.name}{isYou ? ' (you)' : ''}</span>
              <span className="font-bold">{p.score}</span>
            </Badge>
          )
        })}
      </div>
    </div>
  )
}
