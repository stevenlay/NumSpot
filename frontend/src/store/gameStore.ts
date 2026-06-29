import { create } from 'zustand'
import type {
  GamePhase,
  Player,
  Spectator,
  WsMessage,
  RoomJoinedPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  GameStartedPayload,
  ClaimResultPayload,
  GameOverPayload,
  SpectatorJoinedPayload,
  SpectatorLeftPayload,
} from '../types/game'

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
  centerCard: number[]
  deckSize: number
  countdown: number | null
  lastClaim: { playerId: string; symbol: number; correct: boolean } | null
  winner: Player | null
  connected: boolean
  disconnected: boolean
  error: string | null
  _ws: WebSocket | null

  // Actions
  connect: (name: string, roomCode?: string) => void
  startGame: () => void
  claim: (symbol: number) => void
  resetError: () => void
  goHome: () => void
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
        set({
          phase: 'playing',
          playerId: p.player_id,
          roomCode: p.room_code,
          isHost: false,
          isSpectator: true,
          players: p.players,
          spectators: p.spectators ?? [],
          centerCard: p.center_card ?? [],
          deckSize: p.deck_size ?? 0,
          disconnected: false,
        })
      } else {
        set({
          phase: 'lobby',
          playerId: p.player_id,
          roomCode: p.room_code,
          isHost: p.is_host,
          isSpectator: false,
          players: p.players,
          disconnected: false,
        })
      }
      break
    }
    case 'player_joined': {
      const p = msg.payload as PlayerJoinedPayload
      set((s) => ({ players: [...s.players, p.player] }))
      break
    }
    case 'player_left': {
      const p = msg.payload as PlayerLeftPayload
      const { playerId } = get()
      set((s) => ({
        players: s.players.filter((pl) => pl.id !== p.player_id),
        isHost: p.new_host_id === playerId ? true : s.isHost,
      }))
      break
    }
    case 'game_started': {
      const p = msg.payload as GameStartedPayload
      set({ phase: 'playing', centerCard: p.center_card, players: p.players, deckSize: p.deck_size, countdown: 3 })
      setTimeout(() => set({ countdown: 2 }), 1000)
      setTimeout(() => set({ countdown: 1 }), 2000)
      setTimeout(() => set({ countdown: 0 }), 3000)
      setTimeout(() => set({ countdown: null }), 4000)
      break
    }
    case 'claim_result': {
      const p = msg.payload as ClaimResultPayload
      set({ lastClaim: { playerId: p.player_id, symbol: p.symbol, correct: p.correct } })
      setTimeout(() => set({
        lastClaim: null,
        centerCard: p.center_card ?? get().centerCard,
        players: p.players ?? get().players,
        deckSize: p.correct ? p.deck_size : get().deckSize,
      }), p.correct ? 2000 : 1500)
      break
    }
    case 'game_over': {
      const p = msg.payload as GameOverPayload
      const winner = p.players.find((pl) => pl.id === p.winner_id) ?? null
      set({ phase: 'finished', players: p.players, winner })
      break
    }
    case 'spectator_joined': {
      const p = msg.payload as SpectatorJoinedPayload
      set((s) => ({ spectators: [...s.spectators, p.spectator] }))
      break
    }
    case 'spectator_left': {
      const p = msg.payload as SpectatorLeftPayload
      set((s) => ({ spectators: s.spectators.filter((sp) => sp.id !== p.spectator_id) }))
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
    if (phase === 'lobby' || phase === 'playing') {
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
  centerCard: [],
  deckSize: 0,
  countdown: null,
  lastClaim: null,
  winner: null,
  connected: false,
  disconnected: false,
  error: null,
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
    ws.send(JSON.stringify({ type: 'start_game', payload: {} }))
  },

  claim: (symbol: number) => {
    const ws = get()._ws
    if (!ws) return
    ws.send(JSON.stringify({ type: 'claim', payload: { symbol } }))
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
      centerCard: [],
      deckSize: 0,
      countdown: null,
      lastClaim: null,
      winner: null,
      connected: false,
      disconnected: false,
      error: null,
      _ws: null,
    })
    if (ws) ws.close()
  },
}))
