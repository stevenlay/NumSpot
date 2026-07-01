import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Total symbols in the projective plane (p=7): p²+p+1 = 57.
// Card numbers are always drawn from [1..57] regardless of how many cards are in play.
const TOTAL_SYMBOLS = 57
const COLOR_LOW = Math.floor(TOTAL_SYMBOLS / 3)       // 19
const COLOR_MID = Math.floor((2 * TOTAL_SYMBOLS) / 3) // 38

interface NumberCardProps {
  numbers: number[]
  onClaim?: (n: number) => void
  clickable?: boolean
  highlightNumber?: number | null
  hintNumber?: number | null
  label?: string
  className?: string
  pileDepth?: number
  faceDown?: boolean
  cardRef?: React.Ref<HTMLDivElement>
}

function tierColors(n: number, clickable: boolean): string {
  if (n <= COLOR_LOW) return `bg-blue-100 text-blue-800${clickable ? ' hover:bg-blue-200' : ''}`
  if (n <= COLOR_MID) return `bg-amber-100 text-amber-800${clickable ? ' hover:bg-amber-200' : ''}`
  return `bg-violet-100 text-violet-800${clickable ? ' hover:bg-violet-200' : ''}`
}

export default function NumberCard({
  numbers,
  onClaim,
  clickable = false,
  highlightNumber,
  hintNumber,
  label,
  className,
  pileDepth = 0,
  faceDown = false,
  cardRef,
}: NumberCardProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {label && (
        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      )}
      <div ref={cardRef} className={cn('relative w-full max-w-sm', pileDepth > 0 && 'mb-2')}>
        {pileDepth >= 3 && <div className="absolute inset-0 bg-muted border border-border" style={{ transform: 'translateY(9px)' }} />}
        {pileDepth >= 2 && <div className="absolute inset-0 bg-muted/60 border border-border" style={{ transform: 'translateY(6px)' }} />}
        {pileDepth >= 1 && <div className="absolute inset-0 bg-card border border-border" style={{ transform: 'translateY(3px)' }} />}
        <Card
          className={cn(
            'p-2 sm:p-4 w-full rounded-none relative',
            faceDown && '!bg-muted',
          )}
        >
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 min-h-[70px] sm:min-h-[104px]">
            {numbers.map((n) => {
              const isHighlight = !faceDown && highlightNumber === n
              const isHint = !faceDown && hintNumber === n
              return (
                <button
                  key={n}
                  disabled={!clickable || faceDown}
                  onClick={() => clickable && !faceDown && onClaim?.(n)}
                  className={cn(
                    'flex items-center justify-center rounded-none text-sm font-bold h-8 sm:h-12 w-full transition-all select-none focus:outline-none',
                    faceDown
                      ? 'cursor-default bg-muted text-transparent'
                      : clickable
                        ? cn('cursor-pointer active:scale-95', tierColors(n, true))
                        : tierColors(n, false),
                    !faceDown && isHighlight && 'bg-green-400 text-white scale-110 shadow-md animate-flash',
                    !faceDown && isHint && !isHighlight && 'animate-hint-pulse',
                  )}
                >
                  {n}
                </button>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
