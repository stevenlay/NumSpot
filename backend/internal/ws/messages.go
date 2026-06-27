package ws

import "github.com/numspot/server/internal/game"

// Inbound message types (client → server)
const (
	MsgCreateRoom = "create_room"
	MsgJoinRoom   = "join_room"
	MsgStartGame  = "start_game"
	MsgClaim      = "claim"
)

// Outbound message types (server → client)
const (
	MsgRoomJoined   = "room_joined"
	MsgPlayerJoined = "player_joined"
	MsgPlayerLeft   = "player_left"
	MsgGameStarted  = "game_started"
	MsgClaimResult  = "claim_result"
	MsgGameOver     = "game_over"
	MsgError        = "error"
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

type ClaimPayload struct {
	Symbol int `json:"symbol"`
}

// Outbound payload structs

type RoomJoinedPayload struct {
	RoomCode string          `json:"room_code"`
	PlayerID string          `json:"player_id"`
	IsHost   bool            `json:"is_host"`
	Players  []*game.Player  `json:"players"`
}

type PlayerJoinedPayload struct {
	Player *game.Player `json:"player"`
}

type PlayerLeftPayload struct {
	PlayerID string `json:"player_id"`
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

type ErrorPayload struct {
	Message string `json:"message"`
}
