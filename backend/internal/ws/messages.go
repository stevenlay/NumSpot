package ws

import "github.com/numspot/server/internal/game"

// Inbound message types (client → server)
const (
	MsgCreateRoom     = "create_room"
	MsgJoinRoom       = "join_room"
	MsgStartGame      = "start_game"
	MsgClaim          = "claim"
	MsgChatSend       = "chat_send"
	MsgRestartGame    = "restart_game"
	MsgDevReset       = "dev_reset"
	MsgUpdateSettings = "update_settings"
	MsgJoinAsPlayer   = "join_as_player"
	MsgMutePlayer     = "mute_player"
)

// Outbound message types (server → client)
const (
	MsgRoomJoined      = "room_joined"
	MsgPlayerJoined    = "player_joined"
	MsgPlayerLeft      = "player_left"
	MsgGameStarted     = "game_started"
	MsgClaimResult     = "claim_result"
	MsgGameOver        = "game_over"
	MsgGameReset       = "game_reset"
	MsgSpectatorJoined = "spectator_joined"
	MsgSpectatorLeft   = "spectator_left"
	MsgChatMessage     = "chat_message"
	MsgError           = "error"
	MsgSettingsUpdated = "settings_updated"
	MsgJoinedAsPlayer  = "joined_as_player"
	MsgPlayerMuted     = "player_muted"
	MsgChatError       = "chat_error"
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

type SpectatorInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type RoomJoinedPayload struct {
	RoomCode    string           `json:"room_code"`
	PlayerID    string           `json:"player_id"`
	IsHost      bool             `json:"is_host"`
	IsSpectator bool             `json:"is_spectator"`
	Players     []*game.Player   `json:"players"`
	Settings    game.RoomSettings `json:"settings"`
	CurrentRound int             `json:"current_round"`
	// Populated for spectators joining an active game
	CenterCard []int           `json:"center_card,omitempty"`
	CardsLeft   int             `json:"cards_left,omitempty"`
	Spectators []SpectatorInfo `json:"spectators,omitempty"`
	// Populated when joining a lobby after a completed game
	LastWinnerID    string         `json:"last_winner_id,omitempty"`
	LastGamePlayers []*game.Player `json:"last_game_players,omitempty"`
}

type PlayerJoinedPayload struct {
	Player *game.Player `json:"player"`
}

type PlayerLeftPayload struct {
	PlayerID  string `json:"player_id"`
	NewHostID string `json:"new_host_id,omitempty"`
}

type GameStartedPayload struct {
	CenterCard   []int          `json:"center_card"`
	Players      []*game.Player `json:"players"`
	CardsLeft     int            `json:"cards_left"`
	CurrentRound int            `json:"current_round"`
	TotalRounds  int            `json:"total_rounds"`
}

type ClaimResultPayload struct {
	PlayerID   string         `json:"player_id"`
	Symbol     int            `json:"symbol"`
	Correct    bool           `json:"correct"`
	CenterCard []int          `json:"center_card"`
	Players    []*game.Player `json:"players"`
	CardsLeft   int            `json:"cards_left"`
}

type GameOverPayload struct {
	Players      []*game.Player `json:"players"`
	WinnerID     string         `json:"winner_id"`
	CurrentRound int            `json:"current_round"`
	TotalRounds  int            `json:"total_rounds"`
}

type GameResetPayload struct {
	Players      []*game.Player `json:"players"`
	HostID       string         `json:"host_id"`
	CurrentRound int            `json:"current_round"`
	TotalRounds  int            `json:"total_rounds"`
}

type SpectatorJoinedPayload struct {
	Spectator SpectatorInfo `json:"spectator"`
}

type SpectatorLeftPayload struct {
	SpectatorID string `json:"spectator_id"`
}

type JoinedAsPlayerPayload struct {
	Player *game.Player `json:"player"`
}

type ErrorPayload struct {
	Message string `json:"message"`
}

type ChatMessagePayload struct {
	SenderID          string `json:"sender_id"`
	SenderName        string `json:"sender_name"`
	SenderIsSpectator bool   `json:"sender_is_spectator,omitempty"`
	Text              string `json:"text"`
	Timestamp         int64  `json:"timestamp"` // Unix milliseconds
}

type PlayerMutedPayload struct {
	PlayerID string `json:"player_id"`
	Muted    bool   `json:"muted"`
}
