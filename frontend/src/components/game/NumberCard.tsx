import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface NumberCardProps {
  numbers: number[]
  onClaim?: (n: number) => void
  clickable?: boolean
  highlightNumber?: number | null
  label?: string
  className?: string
  showPile?: boolean
  pileKey?: string | number
}

export default function NumberCard({
  numbers,
  onClaim,
  clickable = false,
  highlightNumber,
  label,
  className,
  showPile = false,
  pileKey,
}: NumberCardProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {label && (
        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      )}
      <div className="relative w-full">
        {showPile && (
          <>
            <div className="absolute inset-0 bg-card border border-border" style={{ transform: 'rotate(3deg) translateY(2px)' }} />
            <div className="absolute inset-0 bg-card border border-border" style={{ transform: 'rotate(-2deg) translateY(1px)' }} />
          </>
        )}
        <Card
          key={pileKey}
          className={cn(
            'p-2 sm:p-4 w-full max-w-sm rounded-none relative',
            !clickable && 'bg-muted/40 opacity-60',
            pileKey !== undefined && 'animate-pile-land',
          )}
        >
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {numbers.map((n) => {
              const isHighlight = highlightNumber === n
              return (
                <button
                  key={n}
                  disabled={!clickable}
                  onClick={() => clickable && onClaim?.(n)}
                  className={cn(
                    'flex items-center justify-center rounded-none text-sm font-bold h-8 sm:h-12 w-full transition-all select-none',
                    clickable
                      ? 'cursor-pointer hover:bg-primary/10 hover:text-primary active:scale-95'
                      : 'cursor-default',
                    isHighlight
                      ? 'bg-green-400 text-white scale-110 shadow-md animate-flash'
                      : clickable
                        ? 'bg-muted text-foreground'
                        : 'bg-background border-2 border-border text-muted-foreground shadow-sm',
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
