import { create } from 'zustand'
import type {
  GamePhase,
  Player,
  WsMessage,
  RoomJoinedPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  GameStartedPayload,
  ClaimResultPayload,
  GameOverPayload,
} from '../types/game'

const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
const WS_URL = import.meta.env.VITE_WS_URL || `${proto}://${window.location.host}/ws`

interface GameStore {
  phase: GamePhase
  playerId: string
  roomCode: string
  isHost: boolean
  players: Player[]
  centerCard: number[]
  deckSize: number
  lastClaim: { playerId: string; symbol: number; correct: boolean } | null
  winner: Player | null
  connected: boolean
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
      set({
        phase: 'lobby',
        playerId: p.player_id,
        roomCode: p.room_code,
        isHost: p.is_host,
        players: p.players,
      })
      break
    }
    case 'player_joined': {
      const p = msg.payload as PlayerJoinedPayload
      set((s) => ({ players: [...s.players, p.player] }))
      break
    }
    case 'player_left': {
      const p = msg.payload as PlayerLeftPayload
      set((s) => ({ players: s.players.filter((pl) => pl.id !== p.player_id) }))
      break
    }
    case 'game_started': {
      const p = msg.payload as GameStartedPayload
      set({ phase: 'playing', centerCard: p.center_card, players: p.players, deckSize: p.deck_size })
      break
    }
    case 'claim_result': {
      const p = msg.payload as ClaimResultPayload
      set({ lastClaim: { playerId: p.player_id, symbol: p.symbol, correct: p.correct } })
      setTimeout(() => set({
        lastClaim: null,
        centerCard: p.center_card ?? get().centerCard,
        players: p.players ?? get().players,
        deckSize: p.deck_size ?? get().deckSize,
      }), p.correct ? 3000 : 1500)
      break
    }
    case 'game_over': {
      const p = msg.payload as GameOverPayload
      const winner = p.players.find((pl) => pl.id === p.winner_id) ?? null
      set({ phase: 'finished', players: p.players, winner })
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

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'home',
  playerId: '',
  roomCode: '',
  isHost: false,
  players: [],
  centerCard: [],
  deckSize: 0,
  lastClaim: null,
  winner: null,
  connected: false,
  error: null,
  _ws: null,

  connect: (name: string, roomCode?: string) => {
    const existing = get()._ws
    if (existing) {
      existing.close()
    }

    set({ error: null })

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

    ws.onclose = () => {
      set({ connected: false, _ws: null })
    }

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
    if (ws) ws.close()
    set({
      phase: 'home',
      playerId: '',
      roomCode: '',
      isHost: false,
      players: [],
      centerCard: [],
      deckSize: 0,
      lastClaim: null,
      winner: null,
      connected: false,
      error: null,
      _ws: null,
    })
  },
}))
