export interface Player {
  id: string
  name: string
  score: number
  card: number[]
}

export interface Spectator {
  id: string
  name: string
}

export type GamePhase = 'home' | 'lobby' | 'playing' | 'finished'

export interface LastClaim {
  playerId: string
  symbol: number
  correct: boolean
}

export interface GameState {
  phase: GamePhase
  playerId: string
  roomCode: string
  isHost: boolean
  isSpectator: boolean
  players: Player[]
  centerCard: number[]
  lastClaim: LastClaim | null
  winner: Player | null
}

// WebSocket message types
export interface WsMessage {
  type: string
  payload: unknown
}

export interface RoomJoinedPayload {
  room_code: string
  player_id: string
  is_host: boolean
  is_spectator: boolean
  players: Player[]
  center_card?: number[]
  deck_size?: number
  spectators?: Spectator[]
}

export interface PlayerJoinedPayload {
  player: Player
}

export interface PlayerLeftPayload {
  player_id: string
  new_host_id?: string
}

export interface GameStartedPayload {
  center_card: number[]
  players: Player[]
  deck_size: number
}

export interface ClaimResultPayload {
  player_id: string
  symbol: number
  correct: boolean
  center_card: number[]
  players: Player[]
  deck_size: number
}

export interface GameOverPayload {
  players: Player[]
  winner_id: string
}

export interface SpectatorJoinedPayload {
  spectator: Spectator
}

export interface SpectatorLeftPayload {
  spectator_id: string
}

export interface ErrorPayload {
  message: string
}
