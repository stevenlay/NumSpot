export interface Player {
  id: string
  name: string
  score: number
  session_score: number
  card: number[]
  muted?: boolean
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

export interface RoomSettings {
  max_players: number
  deck_size: number
  wrong_claim_penalty_ms: number
  correct_claim_lock_ms: number
  rounds: number
  hint_delay_ms: number
}

export interface RoomJoinedPayload {
  room_code: string
  player_id: string
  is_host: boolean
  is_spectator: boolean
  players: Player[]
  settings: RoomSettings
  current_round?: number
  center_card?: number[]
  cards_left?: number
  spectators?: Spectator[]
  last_winner_id?: string
  last_game_players?: Player[]
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
  cards_left: number
  current_round: number
  total_rounds: number
}

export interface ClaimResultPayload {
  player_id: string
  symbol: number
  correct: boolean
  center_card: number[]
  players: Player[]
  cards_left: number
}

export interface GameOverPayload {
  players: Player[]
  winner_id: string
  current_round: number
  total_rounds: number
}

export interface GameResetPayload {
  players: Player[]
  host_id: string
  current_round: number
  total_rounds: number
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

export interface ChatMessagePayload {
  sender_id: string
  sender_name: string
  sender_is_spectator?: boolean
  text: string
  timestamp: number
}

export interface ChatEntry {
  id: string
  kind: 'status' | 'chat'
  text: string
  senderName?: string
  senderId?: string
  senderIsSpectator?: boolean
  timestamp: number
  claimElapsedMs?: number
  claimMissed?: boolean
}
