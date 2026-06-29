import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDevStore } from '../../store/devStore'
import { useGameStore } from '../../store/gameStore'
import { spawnBots, removeAllBots, getBotCount, registerBotCountListener, type BotSpeed } from './BotPlayer'

const MAX_DECK = 57
const MIN_DECK = 1
const DEFAULT_DECK = 57
const DEFAULT_WRONG_MS = 1500
const DEFAULT_CORRECT_MS = 2000

export default function DevPanel() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { skipCountdown, deckSize, highlightAnswer, botSpeed, wrongClaimPenaltyMs, correctClaimLockMs, setSkipCountdown, setDeckSize, setHighlightAnswer, setBotSpeed, setWrongClaimPenaltyMs, setCorrectClaimLockMs } = useDevStore()
  const phase = useGameStore((s) => s.phase)
  const roomCode = useGameStore((s) => s.roomCode)
  const connect = useGameStore((s) => s.connect)
  const [activeBotCount, setActiveBotCount] = useState(() => getBotCount())

  // Handle navigation after quick-create (Home may not be mounted to do this itself)
  useEffect(() => {
    if (phase === 'lobby') navigate('/lobby', { replace: true })
    else if (phase === 'playing') navigate('/game', { replace: true })
  }, [phase, navigate])

  useEffect(() => {
    registerBotCountListener(setActiveBotCount)
    return () => registerBotCountListener(() => {})
  }, [])

  const quickCreateRoom = () => {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
    connect(`Dev_${suffix}`)
  }

  const simulateGameOver = () => {
    useGameStore.getState()._ws?.send(JSON.stringify({ type: 'dev_reset', payload: {} }))
  }

  const inRoom = phase === 'lobby' || phase === 'playing'

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2">
      {open && (
        <div className="bg-card border border-border rounded-xl p-4 shadow-lg w-60 flex flex-col gap-4">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Dev Tools</span>

          {/* Quick actions */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</span>
            <button
              onClick={quickCreateRoom}
              disabled={inRoom}
              className="text-left text-xs px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ⚡ Quick Create Room
            </button>
            <button
              onClick={simulateGameOver}
              disabled={!inRoom}
              className="text-left text-xs px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              🏁 Simulate Game Over
            </button>
          </div>

          <div className="border-t border-border" />

          {/* Bot players */}
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Bot Players</span>

            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-muted-foreground">Speed</span>
              <div className="grid grid-cols-4 gap-1">
                {(['instant', 'fast', 'medium', 'slow'] as BotSpeed[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setBotSpeed(s)}
                    className={`text-[10px] px-1 py-1 rounded capitalize transition-colors ${
                      botSpeed === s
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-1.5">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => spawnBots(n, roomCode, botSpeed)}
                  disabled={!inRoom}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  +{n}
                </button>
              ))}
            </div>

            {activeBotCount > 0 && (
              <button
                onClick={removeAllBots}
                className="text-left text-xs px-3 py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
              >
                Remove {activeBotCount} bot{activeBotCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Game settings */}
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Game Settings</span>

            <label className="flex items-center justify-between gap-2 text-sm cursor-pointer select-none">
              <span>Skip countdown</span>
              <input
                type="checkbox"
                checked={skipCountdown}
                onChange={(e) => setSkipCountdown(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-2 text-sm cursor-pointer select-none">
              <span>Highlight answer</span>
              <input
                type="checkbox"
                checked={highlightAnswer}
                onChange={(e) => setHighlightAnswer(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </label>

            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span>Deck size</span>
                <span className="flex items-center gap-1.5">
                  <span className={deckSize !== DEFAULT_DECK ? 'text-primary font-medium tabular-nums' : 'text-muted-foreground tabular-nums'}>{deckSize}</span>
                  {deckSize !== DEFAULT_DECK && (
                    <button onClick={() => setDeckSize(DEFAULT_DECK)} className="text-[10px] text-muted-foreground hover:text-foreground underline">↩ {DEFAULT_DECK}</button>
                  )}
                </span>
              </div>
              <input
                type="range"
                min={MIN_DECK}
                max={MAX_DECK}
                value={deckSize}
                onChange={(e) => setDeckSize(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{MIN_DECK}</span>
                <span>{MAX_DECK}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span>Wrong claim cooldown</span>
                <span className="flex items-center gap-1.5">
                  <span className={wrongClaimPenaltyMs !== DEFAULT_WRONG_MS ? 'text-primary font-medium tabular-nums' : 'text-muted-foreground tabular-nums'}>{wrongClaimPenaltyMs}ms</span>
                  {wrongClaimPenaltyMs !== DEFAULT_WRONG_MS && (
                    <button onClick={() => setWrongClaimPenaltyMs(DEFAULT_WRONG_MS)} className="text-[10px] text-muted-foreground hover:text-foreground underline">↩ {DEFAULT_WRONG_MS}ms</button>
                  )}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={5000}
                step={100}
                value={wrongClaimPenaltyMs}
                onChange={(e) => setWrongClaimPenaltyMs(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0ms</span>
                <span>5000ms</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span>Correct claim lock</span>
                <span className="flex items-center gap-1.5">
                  <span className={correctClaimLockMs !== DEFAULT_CORRECT_MS ? 'text-primary font-medium tabular-nums' : 'text-muted-foreground tabular-nums'}>{correctClaimLockMs}ms</span>
                  {correctClaimLockMs !== DEFAULT_CORRECT_MS && (
                    <button onClick={() => setCorrectClaimLockMs(DEFAULT_CORRECT_MS)} className="text-[10px] text-muted-foreground hover:text-foreground underline">↩ {DEFAULT_CORRECT_MS}ms</button>
                  )}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={5000}
                step={100}
                value={correctClaimLockMs}
                onChange={(e) => setCorrectClaimLockMs(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0ms</span>
                <span>5000ms</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        title="Dev tools"
        className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center text-base text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shadow"
      >
        ⚙
      </button>
    </div>
  )
}
