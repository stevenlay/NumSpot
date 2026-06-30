import { create } from 'zustand'
import { useDevStore } from './devStore'
import type {
  GamePhase,
  Player,
  Spectator,
  WsMessage,
  RoomSettings,
  RoomJoinedPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  GameStartedPayload,
  ClaimResultPayload,
  GameOverPayload,
  GameResetPayload,
  SpectatorJoinedPayload,
  SpectatorLeftPayload,
  ChatMessagePayload,
  ChatEntry,
} from '../types/game'

const DEFAULT_SETTINGS: RoomSettings = {
  max_players: 8,
  deck_size: 57,
  wrong_claim_penalty_ms: 1500,
  correct_claim_lock_ms: 2000,
}

const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
const WS_URL = import.meta.env.VITE_WS_URL || `${proto}://${window.location.host}/ws`

export interface GameStore {
  phase: GamePhase
  playerId: string
  name: string
  roomCode: string
  isHost: boolean
  isSpectator: boolean
  players: Player[]
  spectators: Spectator[]
  settings: RoomSettings
  centerCard: number[]
  deckSize: number
  countdown: number | null
  lastClaim: { playerId: string; symbol: number; correct: boolean } | null
  roundStartedAt: number | null
  gameOverToast: { winner: Player | null; players: Player[] } | null
  connected: boolean
  disconnected: boolean
  error: string | null
  chatError: string | null
  chatMessages: ChatEntry[]
  _ws: WebSocket | null

  // Actions
  connect: (name: string, roomCode?: string) => void
  startGame: () => void
  restartGame: () => void
  claim: (symbol: number) => void
  sendChat: (text: string) => void
  mutePlayer: (playerId: string) => void
  updateSettings: (settings: RoomSettings) => void
  joinAsPlayer: () => void
  resetError: () => void
  dismissGameOverToast: () => void
  goHome: () => void
}

function addStatusEntry(
  set: (fn: (s: GameStore) => Partial<GameStore>) => void,
  text: string,
  extra?: Partial<ChatEntry>,
) {
  const entry: ChatEntry = {
    id: crypto.randomUUID(),
    kind: 'status',
    text,
    timestamp: Date.now(),
    ...extra,
  }
  set((s) => ({ chatMessages: [...s.chatMessages, entry] }))
}

function handleMessage(
  msg: WsMessage,
  set: (partial: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
) {
  switch (msg.type) {
    case 'room_joined': {
      const p = msg.payload as RoomJoinedPayload
      if (p.is_spectator) {
        const inGame = (p.center_card ?? []).length > 0
        set({
          phase: inGame ? 'playing' : 'lobby',
          playerId: p.player_id,
          roomCode: p.room_code,
          isHost: false,
          isSpectator: true,
          players: p.players,
          spectators: p.spectators ?? [],
          settings: p.settings ?? DEFAULT_SETTINGS,
          centerCard: p.center_card ?? [],
          deckSize: p.deck_size ?? 0,
          disconnected: false,
        })
      } else {
        const gameOverToast = p.last_winner_id && p.last_game_players
          ? { winner: p.last_game_players.find((pl) => pl.id === p.last_winner_id) ?? null, players: p.last_game_players }
          : null
        set({
          phase: 'lobby',
          playerId: p.player_id,
          roomCode: p.room_code,
          isHost: p.is_host,
          isSpectator: false,
          players: p.players,
          settings: p.settings ?? DEFAULT_SETTINGS,
          disconnected: false,
          gameOverToast,
        })
      }
      break
    }
    case 'player_joined': {
      const p = msg.payload as PlayerJoinedPayload
      set((s) => ({ players: [...s.players, p.player] }))
      addStatusEntry(set, `${p.player.name} joined`)
      break
    }
    case 'player_left': {
      const p = msg.payload as PlayerLeftPayload
      const { playerId } = get()
      const leavingPlayer = get().players.find((pl) => pl.id === p.player_id)
      set((s) => ({
        players: s.players.filter((pl) => pl.id !== p.player_id),
        isHost: p.new_host_id === playerId ? true : s.isHost,
      }))
      if (leavingPlayer) addStatusEntry(set, `${leavingPlayer.name} left`)
      break
    }
    case 'game_started': {
      const p = msg.payload as GameStartedPayload
      addStatusEntry(set, 'Game started!')
      const skipCountdown = import.meta.env.DEV && useDevStore.getState().skipCountdown
      if (skipCountdown) {
        set({ phase: 'playing', centerCard: p.center_card, players: p.players, deckSize: p.deck_size, countdown: null, roundStartedAt: Date.now() })
      } else {
        set({ phase: 'playing', centerCard: p.center_card, players: p.players, deckSize: p.deck_size, countdown: 3 })
        setTimeout(() => set({ countdown: 2 }), 1000)
        setTimeout(() => set({ countdown: 1 }), 2000)
        setTimeout(() => set({ countdown: 0 }), 3000)
        setTimeout(() => set({ countdown: null, roundStartedAt: Date.now() }), 4000)
      }
      break
    }
    case 'claim_result': {
      const p = msg.payload as ClaimResultPayload
      set({ lastClaim: { playerId: p.player_id, symbol: p.symbol, correct: p.correct } })
      const playerName = get().players.find((pl) => pl.id === p.player_id)?.name ?? 'Someone'
      if (p.correct) {
        const claimElapsedMs = Date.now() - (get().roundStartedAt ?? Date.now())
        addStatusEntry(set, `${playerName} got it! +1`, { claimElapsedMs })
        // Update scores immediately, but keep existing cards until cooldown ends
        if (p.players) {
          const scoreMap = new Map(p.players.map(pl => [pl.id, pl.score]))
          set((s) => ({ players: s.players.map(pl => ({ ...pl, score: scoreMap.get(pl.id) ?? pl.score })) }))
        }
      } else {
        const isSelf = get().playerId === p.player_id
        addStatusEntry(set, isSelf ? 'You missed!' : `${playerName} missed!`, { claimMissed: true })
      }
      const { settings } = get()
      const clearDelay = p.correct
        ? settings.correct_claim_lock_ms
        : settings.wrong_claim_penalty_ms
      setTimeout(() => set({
        lastClaim: null,
        centerCard: p.center_card ?? get().centerCard,
        players: p.players ?? get().players,
        deckSize: p.correct ? p.deck_size : get().deckSize,
        ...(p.correct ? { roundStartedAt: Date.now() } : {}),
      }), clearDelay)
      break
    }
    case 'game_over': {
      const p = msg.payload as GameOverPayload
      const { playerId } = get()
      const winner = p.players.find((pl) => pl.id === p.winner_id) ?? null
      set({ phase: 'finished', gameOverToast: { winner, players: p.players } })
      const sorted = [...p.players].sort((a, b) => b.score - a.score)
      addStatusEntry(set, winner ? `Game over! ${winner.id === playerId ? 'You win!' : `${winner.name} wins!`}` : 'Game over!')
      const top3 = sorted.slice(0, 3)
      top3.forEach((pl, i) => addStatusEntry(set, `${i + 1}. ${pl.name}${pl.id === playerId ? ' (you)' : ''} — ${pl.score} pt${pl.score !== 1 ? 's' : ''}`))
      const selfRank = sorted.findIndex(pl => pl.id === playerId)
      if (selfRank >= 3) {
        const self = sorted[selfRank]
        addStatusEntry(set, `${selfRank + 1}. You — ${self.score} pt${self.score !== 1 ? 's' : ''}`)
      }
      break
    }
    case 'game_reset': {
      const p = msg.payload as GameResetPayload
      const { playerId } = get()
      set({
        phase: 'lobby',
        players: p.players,
        isHost: p.host_id === playerId,
        centerCard: [],
        deckSize: 0,
        lastClaim: null,
        roundStartedAt: null,
        countdown: null,
      })
      break
    }
    case 'spectator_joined': {
      const p = msg.payload as SpectatorJoinedPayload
      set((s) => ({ spectators: [...s.spectators, p.spectator] }))
      addStatusEntry(set, `${p.spectator.name} spectating`)
      break
    }
    case 'spectator_left': {
      const p = msg.payload as SpectatorLeftPayload
      set((s) => ({ spectators: s.spectators.filter((sp) => sp.id !== p.spectator_id) }))
      break
    }
    case 'chat_message': {
      const p = msg.payload as ChatMessagePayload
      const entry: ChatEntry = {
        id: crypto.randomUUID(),
        kind: 'chat',
        text: p.text,
        senderName: p.sender_name,
        senderId: p.sender_id,
        senderIsSpectator: p.sender_is_spectator,
        timestamp: p.timestamp,
      }
      set((s) => ({ chatMessages: [...s.chatMessages, entry] }))
      break
    }
    case 'player_muted': {
      const p = msg.payload as { player_id: string; muted: boolean }
      set((s) => ({
        players: s.players.map((pl) =>
          pl.id === p.player_id ? { ...pl, muted: p.muted } : pl
        ),
      }))
      break
    }
    case 'joined_as_player': {
      const p = msg.payload as { player: Player }
      set((s) => ({
        isSpectator: false,
        players: [...s.players, p.player],
      }))
      break
    }
    case 'settings_updated': {
      set({ settings: msg.payload as RoomSettings })
      break
    }
    case 'chat_error': {
      const p = msg.payload as { message: string }
      set({ chatError: p.message })
      setTimeout(() => set({ chatError: null }), 4000)
      break
    }
    case 'error': {
      const p = msg.payload as { message: string }
      set({ error: p.message })
      break
    }
    default:
      break
  }
}

function makeOnClose(
  set: (partial: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
) {
  return () => {
    const { phase } = get()
    if (phase === 'lobby' || phase === 'playing' || phase === 'finished') {
      set({ connected: false, _ws: null, disconnected: true })
    } else {
      set({ connected: false, _ws: null })
    }
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'home',
  playerId: '',
  name: '',
  roomCode: '',
  isHost: false,
  isSpectator: false,
  players: [],
  spectators: [],
  settings: DEFAULT_SETTINGS,
  centerCard: [],
  deckSize: 0,
  countdown: null,
  lastClaim: null,
  roundStartedAt: null,
  gameOverToast: null,
  connected: false,
  disconnected: false,
  error: null,
  chatError: null,
  chatMessages: [],
  _ws: null,

  connect: (name: string, roomCode?: string) => {
    const existing = get()._ws
    if (existing) {
      existing.onclose = null // suppress disconnect handler for intentional close
      existing.close()
    }

    set({ error: null, name, disconnected: false })

    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      set({ connected: true })
      if (roomCode) {
        ws.send(JSON.stringify({
          type: 'join_room',
          payload: { code: roomCode, name },
        }))
      } else {
        ws.send(JSON.stringify({
          type: 'create_room',
          payload: { name },
        }))
      }
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WsMessage
        handleMessage(msg, set, get)
      } catch {
        console.error('Failed to parse ws message', event.data)
      }
    }

    ws.onclose = makeOnClose(set, get)

    ws.onerror = () => {
      set({ error: 'Connection error. Please try again.', connected: false })
    }

    set({ _ws: ws })
  },

  startGame: () => {
    const ws = get()._ws
    if (!ws) return
    const dev = import.meta.env.DEV ? useDevStore.getState() : null
    ws.send(JSON.stringify({
      type: 'start_game',
      payload: dev ? { dev: { skip_countdown: dev.skipCountdown } } : {},
    }))
  },

  restartGame: () => {
    const ws = get()._ws
    if (!ws) return
    ws.send(JSON.stringify({ type: 'restart_game', payload: {} }))
  },

  claim: (symbol: number) => {
    const ws = get()._ws
    if (!ws) return
    ws.send(JSON.stringify({ type: 'claim', payload: { symbol } }))
  },

  sendChat: (text: string) => {
    const ws = get()._ws
    if (!ws) return
    ws.send(JSON.stringify({ type: 'chat_send', payload: { text } }))
  },

  mutePlayer: (playerId: string) => {
    const ws = get()._ws
    if (!ws) return
    ws.send(JSON.stringify({ type: 'mute_player', payload: { player_id: playerId } }))
  },

  joinAsPlayer: () => {
    const ws = get()._ws
    if (!ws) return
    ws.send(JSON.stringify({ type: 'join_as_player', payload: {} }))
  },

  updateSettings: (settings: RoomSettings) => {
    const ws = get()._ws
    if (!ws) return
    set({ settings })
    ws.send(JSON.stringify({ type: 'update_settings', payload: settings }))
  },

  resetError: () => set({ error: null }),

  goHome: () => {
    const ws = get()._ws
    // Reset state first so onclose sees phase='home' and skips the disconnected flag
    set({
      phase: 'home',
      playerId: '',
      name: '',
      roomCode: '',
      isHost: false,
      isSpectator: false,
      players: [],
      spectators: [],
      settings: DEFAULT_SETTINGS,
      centerCard: [],
      deckSize: 0,
      countdown: null,
      lastClaim: null,
      roundStartedAt: null,
      gameOverToast: null,
      connected: false,
      disconnected: false,
      error: null,
      chatError: null,
      chatMessages: [],
      _ws: null,
    })
    if (ws) ws.close()
  },

  dismissGameOverToast: () => set({ gameOverToast: null }),
}))
