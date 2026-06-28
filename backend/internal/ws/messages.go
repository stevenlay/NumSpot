package ws

import "github.com/numspot/server/internal/game"

// Inbound message types (client → server)
const (
	MsgCreateRoom = "create_room"
	MsgJoinRoom   = "join_room"
	MsgRejoinRoom = "rejoin_room"
	MsgStartGame  = "start_game"
	MsgClaim      = "claim"
)

// Outbound message types (server → client)
const (
	MsgRoomJoined     = "room_joined"
	MsgRejoinedRoom   = "rejoined_room"
	MsgPlayerJoined   = "player_joined"
	MsgPlayerLeft     = "player_left"
	MsgPlayerRejoined = "player_rejoined"
	MsgGameStarted    = "game_started"
	MsgClaimResult    = "claim_result"
	MsgGameOver       = "game_over"
	MsgSpectatorJoined = "spectator_joined"
	MsgSpectatorLeft   = "spectator_left"
	MsgError          = "error"
)

// InboundMessage is the top-level wrapper for all client messages.
type InboundMessage struct {
	Type    string                 `json:"type"`
	Payload map[string]interface{} `json:"payload"`
}

// OutboundMessage is the top-level wrapper for all server messages.
type OutboundMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// Inbound payload helpers

type CreateRoomPayload struct {
	Name string `json:"name"`
}

type JoinRoomPayload struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type RejoinRoomPayload struct {
	Code  string `json:"code"`
	Token string `json:"token"`
}

type ClaimPayload struct {
	Symbol int `json:"symbol"`
}

// Outbound payload structs

type SpectatorInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type RoomJoinedPayload struct {
	RoomCode    string         `json:"room_code"`
	PlayerID    string         `json:"player_id"`
	IsHost      bool           `json:"is_host"`
	IsSpectator bool           `json:"is_spectator"`
	Players     []*game.Player `json:"players"`
	Token       string         `json:"token,omitempty"`
	// Populated for spectators joining an active game
	CenterCard []int          `json:"center_card,omitempty"`
	DeckSize   int            `json:"deck_size,omitempty"`
	Spectators []SpectatorInfo `json:"spectators,omitempty"`
}

// RejoinedRoomPayload is sent to a player who reconnects to an in-progress game.
type RejoinedRoomPayload struct {
	RoomCode   string          `json:"room_code"`
	PlayerID   string          `json:"player_id"`
	IsHost     bool            `json:"is_host"`
	Token      string          `json:"token"`
	Players    []*game.Player  `json:"players"`
	CenterCard []int           `json:"center_card"`
	DeckSize   int             `json:"deck_size"`
	Spectators []SpectatorInfo `json:"spectators,omitempty"`
}

type PlayerJoinedPayload struct {
	Player *game.Player `json:"player"`
}

type PlayerLeftPayload struct {
	PlayerID string `json:"player_id"`
}

type PlayerRejoinedPayload struct {
	Player *game.Player `json:"player"`
}

type GameStartedPayload struct {
	CenterCard []int          `json:"center_card"`
	Players    []*game.Player `json:"players"`
	DeckSize   int            `json:"deck_size"`
}

type ClaimResultPayload struct {
	PlayerID   string         `json:"player_id"`
	Symbol     int            `json:"symbol"`
	Correct    bool           `json:"correct"`
	CenterCard []int          `json:"center_card"`
	Players    []*game.Player `json:"players"`
	DeckSize   int            `json:"deck_size"`
}

type GameOverPayload struct {
	Players  []*game.Player `json:"players"`
	WinnerID string         `json:"winner_id"`
}

type SpectatorJoinedPayload struct {
	Spectator SpectatorInfo `json:"spectator"`
}

type SpectatorLeftPayload struct {
	SpectatorID string `json:"spectator_id"`
}

type ErrorPayload struct {
	Message string `json:"message"`
}
