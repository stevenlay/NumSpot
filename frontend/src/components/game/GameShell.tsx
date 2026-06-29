import { useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { Button } from '@/components/ui/button'
import { Copy, Check, LogOut, MessageCircle } from 'lucide-react'
import ChatPanel from './ChatPanel'

interface GameShellProps {
  /** Edge-to-edge banner rendered above the header (e.g. disconnect alert). */
  banner?: React.ReactNode
  /** Extra items on the right side of the header, before the Leave button. */
  headerExtras?: React.ReactNode
  /** Content rendered in the left sidebar below the room code section. */
  sidebarContent: React.ReactNode
  /** Banner rendered between the sidebars, above the main content. */
  centerBanner?: React.ReactNode
  /** Main content area. */
  children: React.ReactNode
}

export default function GameShell({ banner, headerExtras, sidebarContent, centerBanner, children }: GameShellProps) {
  const roomCode = useGameStore((s) => s.roomCode)
  const goHome = useGameStore((s) => s.goHome)
  const chatMessages = useGameStore((s) => s.chatMessages)
  const [copied, setCopied] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [lastSeenCount, setLastSeenCount] = useState(0)

  const chatCount = chatMessages.filter((m) => m.kind === 'chat').length
  const unreadCount = chatOpen ? 0 : Math.max(0, chatCount - lastSeenCount)

  const copyCode = () => {
    const url = `${window.location.origin}/join/${roomCode}`
    navigator.clipboard.writeText(url).catch(() => { })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openChat = () => {
    setChatOpen(true)
    setLastSeenCount(chatCount)
  }

  const closeChat = () => {
    setChatOpen(false)
    setLastSeenCount(chatCount)
  }

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {banner}

      {/* Header */}
      <div className="w-full flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold"><span className="text-blue-500">NumSpot</span></h1>
          <button
            onClick={copyCode}
            className="md:hidden flex items-center gap-1.5 text-sm font-black font-mono tracking-widest text-foreground hover:text-muted-foreground transition-colors"
          >
            {roomCode}
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 opacity-50" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {headerExtras}
          <button
            onClick={openChat}
            className="lg:hidden relative flex items-center justify-center w-8 h-8 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Open chat"
          >
            <MessageCircle className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <Button variant="outline" size="sm" onClick={goHome} className="flex items-center gap-1.5 text-xs">
            <LogOut className="w-3.5 h-3.5" />
            Leave
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar */}
        <aside className="hidden md:flex md:w-80 shrink-0 border-r border-border p-4 overflow-y-auto flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Room Code</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-widest text-foreground font-mono">{roomCode}</span>
              <button
                onClick={copyCode}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title={copied ? 'Copied!' : 'Copy code'}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          {sidebarContent}
        </aside>

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {centerBanner}
          {children}
        </div>

        <ChatPanel mobileOpen={chatOpen} onMobileClose={closeChat} />
      </div>

    </div>
  )
}
