import { useRef, useState, useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ChatEntry } from '../../types/game'

export default function ChatPanel() {
  const chatMessages = useGameStore((s) => s.chatMessages)
  const sendChat = useGameStore((s) => s.sendChat)
  const playerId = useGameStore((s) => s.playerId)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  function handleSend() {
    const text = input.trim()
    if (!text) return
    sendChat(text)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSend()
  }

  return (
    <aside className="hidden lg:flex lg:w-96 shrink-0 border-l border-border flex-col overflow-hidden">
      <div className="px-4 py-4 border-b border-border shrink-0 flex items-center">
        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Chat</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0">
        {chatMessages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No messages yet</p>
        )}
        {chatMessages.map((entry: ChatEntry) =>
          entry.kind === 'status' ? (
            <div
              key={entry.id}
              className="text-[11px] text-center py-0.5 rounded-md px-2"
              style={
                entry.claimElapsedMs !== undefined
                  ? {
                      color: 'rgb(21 128 61)',
                      backgroundColor: `rgba(34, 197, 94, ${Math.max(0.08, 0.35 * Math.exp(-entry.claimElapsedMs / 8000))})`,
                    }
                  : entry.claimMissed
                    ? { color: 'rgb(185 28 28)', backgroundColor: 'rgba(239, 68, 68, 0.15)' }
                    : { color: 'var(--muted-foreground)', opacity: 0.6 }
              }
            >
              {entry.text}{entry.claimElapsedMs !== undefined && (
                <span className="opacity-60 ml-1">· {(entry.claimElapsedMs / 1000).toFixed(2)}s</span>
              )}
            </div>
          ) : (
            <div
              key={entry.id}
              className={cn(
                'flex flex-col gap-0.5',
                entry.senderId === playerId ? 'items-end' : 'items-start'
              )}
            >
              <span className="text-[10px] text-muted-foreground px-1">
                {entry.senderId === playerId
                  ? `You${entry.senderIsSpectator ? ' (spectating)' : ''}`
                  : `${entry.senderName}${entry.senderIsSpectator ? ' (spectating)' : ''}`}
              </span>
              <div
                className={cn(
                  'px-3 py-1.5 rounded-xl text-sm break-words max-w-[85%]',
                  entry.senderId === playerId
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                )}
              >
                {entry.text}
              </div>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-border shrink-0 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Say something..."
          maxLength={200}
          className="flex-1 text-sm bg-muted/50 border border-border rounded-lg px-3 py-1.5 outline-none focus:border-primary transition-colors"
        />
        <Button size="sm" onClick={handleSend} disabled={!input.trim()}>
          Send
        </Button>
      </div>
    </aside>
  )
}
