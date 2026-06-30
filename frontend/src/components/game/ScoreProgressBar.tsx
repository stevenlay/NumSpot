import { cn } from '@/lib/utils'
import type { Player } from '../../types/game'

interface Props {
  players: Player[]
  currentPlayerId: string
}

const medals = ['🥇', '🥈', '🥉']

export default function ScoreProgressBar({ players, currentPlayerId }: Props) {
  const totalScore = (p: Player) => p.session_score + p.score
  const sorted = [...players].sort((a, b) => totalScore(b) - totalScore(a))
  const maxScore = Math.max(...sorted.map(totalScore), 1)

  const myRank = sorted.findIndex((p) => p.id === currentPlayerId)
  const inTop3 = myRank < 3

  const entries = [
    ...sorted.slice(0, 3).map((p, i) => ({ p, rank: i })),
    ...(!inTop3 && myRank >= 0 ? [{ p: sorted[myRank], rank: myRank }] : []),
  ]

  return (
    <div className="shrink-0 bg-muted/20 px-4 py-3 flex flex-col gap-2">
      {entries.map(({ p, rank }) => {
        const score = totalScore(p)
        const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
        const isYou = p.id === currentPlayerId
        const isLeader = rank === 0 && score > 0

        return (
          <div key={p.id}>
            <div className="flex items-center gap-2.5 text-xs">
              <span className="w-5 text-center shrink-0 text-sm leading-none">
                {rank < 3 ? medals[rank] : `${rank + 1}.`}
              </span>
              <span
                className={cn(
                  'w-20 truncate shrink-0 font-medium',
                  isYou ? 'text-primary font-semibold' : 'text-foreground',
                )}
              >
                {p.name}{isYou ? ' (you)' : ''}
              </span>
              <div className="flex-1 h-2 rounded-full bg-muted relative">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-500 ease-out relative',
                    isLeader ? 'bg-yellow-400' : isYou ? 'bg-primary' : 'bg-muted-foreground/40',
                  )}
                  style={{ width: `${pct}%` }}
                >
                  {score > 0 && (
                    <span className="absolute -right-3 top-1/2 -translate-y-1/2 text-sm leading-none select-none pointer-events-none">
                      🌭
                    </span>
                  )}
                </div>
              </div>
              <span className="w-10 text-right shrink-0 font-bold tabular-nums text-foreground">
                {score}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
