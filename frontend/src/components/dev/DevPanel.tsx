import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDevStore } from '../../store/devStore'
import { useGameStore } from '../../store/gameStore'
import { spawnBots, removeAllBots, getBotCount, registerBotCountListener, type BotSpeed } from './BotPlayer'

export default function DevPanel() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { skipCountdown, highlightAnswer, botSpeed, setSkipCountdown, setHighlightAnswer, setBotSpeed } = useDevStore()
  const phase = useGameStore((s) => s.phase)
  const roomCode = useGameStore((s) => s.roomCode)
  const connect = useGameStore((s) => s.connect)
  const [activeBotCount, setActiveBotCount] = useState(() => getBotCount())

  // Handle navigation after quick-create (Home may not be mounted to do this itself)
  useEffect(() => {
    if (phase === 'lobby' && roomCode) navigate(`/lobby/${roomCode}`, { replace: true })
    else if (phase === 'playing' && roomCode) navigate(`/game/${roomCode}`, { replace: true })
  }, [phase, roomCode, navigate])

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
        <div className="bg-card border border-border p-4 shadow-lg w-60 flex flex-col gap-4">
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
