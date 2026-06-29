export type BotSpeed = 'instant' | 'fast' | 'medium' | 'slow'

const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
const WS_URL = import.meta.env.VITE_WS_URL || `${proto}://${window.location.host}/ws`

function claimDelay(speed: BotSpeed): number {
  switch (speed) {
    case 'instant': return 50 + Math.random() * 200
    case 'fast':    return 400 + Math.random() * 1200
    case 'medium':  return 1500 + Math.random() * 3000
    case 'slow':    return 4000 + Math.random() * 6000
  }
}

function findMatch(card: number[], center: number[]): number | null {
  const set = new Set(center)
  return card.find(n => set.has(n)) ?? null
}

interface PlayerData { id: string; card: number[] }

class BotPlayer {
  private ws: WebSocket | null = null
  private playerId = ''
  private myCard: number[] = []
  private centerCard: number[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    public readonly name: string,
    private roomCode: string,
    private speed: BotSpeed,
    private onStop: () => void,
  ) {}

  start() {
    this.ws = new WebSocket(WS_URL)
    this.ws.onopen = () => {
      this.ws!.send(JSON.stringify({ type: 'join_room', payload: { code: this.roomCode, name: this.name, dev: { allow_mid_game: true } } }))
    }
    this.ws.onmessage = (e) => {
      try { this.handle(JSON.parse(e.data as string)) } catch { /* ignore parse errors */ }
    }
    this.ws.onclose = () => {
      this.clearTimer()
      this.onStop()
    }
    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  stop() {
    this.clearTimer()
    const ws = this.ws
    this.ws = null
    ws?.close()
  }

  private clearTimer() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
  }

  private scheduleClaim() {
    this.clearTimer()
    const match = findMatch(this.myCard, this.centerCard)
    if (match === null) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.ws?.send(JSON.stringify({ type: 'claim', payload: { symbol: match } }))
      // Re-arm: if the claim was silently rejected (e.g. during claim lock), retry
      this.scheduleClaim()
    }, claimDelay(this.speed))
  }

  private handle(msg: { type: string; payload: Record<string, unknown> }) {
    switch (msg.type) {
      case 'room_joined': {
        this.playerId = msg.payload.player_id as string
        // Mid-game join: center_card present means we were added as a player to an active game
        const centerCard = msg.payload.center_card as number[] | undefined
        if (centerCard && centerCard.length > 0) {
          this.centerCard = centerCard
          const players = msg.payload.players as PlayerData[] | undefined
          const me = players?.find(p => p.id === this.playerId)
          if (me) this.myCard = me.card
          this.scheduleClaim()
        }
        break
      }
      case 'game_started': {
        this.centerCard = msg.payload.center_card as number[]
        const players = msg.payload.players as PlayerData[] | undefined
        const me = players?.find(p => p.id === this.playerId)
        if (me) this.myCard = me.card
        this.scheduleClaim()
        break
      }
      case 'claim_result': {
        if (!msg.payload.correct) return
        this.clearTimer()
        this.centerCard = msg.payload.center_card as number[]
        const players = msg.payload.players as PlayerData[] | undefined
        const me = players?.find(p => p.id === this.playerId)
        if (me) this.myCard = me.card
        this.scheduleClaim()
        break
      }
      case 'game_reset': {
        this.clearTimer()
        this.myCard = []
        this.centerCard = []
        break
      }
      case 'error': {
        // Server rejected us (room full, not found, etc.) — disconnect cleanly
        this.ws?.close()
        break
      }
    }
  }
}

// Module-level registry
let activeBots: BotPlayer[] = []
let countListener: ((n: number) => void) | null = null

function notifyCount() {
  countListener?.(activeBots.length)
}

export function registerBotCountListener(cb: (n: number) => void) {
  countListener = cb
}

export function getBotCount() {
  return activeBots.length
}

export function spawnBots(count: number, roomCode: string, speed: BotSpeed) {
  const offset = activeBots.length
  for (let i = 0; i < count; i++) {
    const bot = new BotPlayer(`Bot ${offset + i + 1}`, roomCode, speed, () => {
      activeBots = activeBots.filter(b => b !== bot)
      notifyCount()
    })
    activeBots.push(bot)
    bot.start()
  }
  notifyCount()
}

export function removeAllBots() {
  const bots = [...activeBots]
  activeBots = []
  bots.forEach(b => b.stop())
  notifyCount()
}
