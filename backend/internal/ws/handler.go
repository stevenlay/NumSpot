package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/numspot/server/internal/game"
)

var validNameRe = regexp.MustCompile(`^[a-zA-Z0-9 '_\-.]+$`)

func validateName(name string) (string, string) {
	name = strings.TrimSpace(name)
	switch {
	case name == "":
		return "", "name is required"
	case len(name) < 2:
		return "", "name must be at least 2 characters"
	case len(name) > 24:
		return "", "name must be 24 characters or fewer"
	case !validNameRe.MatchString(name):
		return "", "name contains invalid characters"
	}
	return name, ""
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// Handler manages WebSocket connections and routes messages to game logic.
type Handler struct {
	manager *game.Manager
	// clientsByRoom: roomCode → (connectionID → *WSClient)
	clientsByRoom map[string]map[string]*WSClient
	mu            sync.RWMutex
}

func NewHandler(m *game.Manager) *Handler {
	return &Handler{
		manager:       m,
		clientsByRoom: make(map[string]map[string]*WSClient),
	}
}

// ServeWS upgrades an HTTP connection to WebSocket and starts pumps.
func (h *Handler) ServeWS(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("upgrade error: %v", err)
		return
	}

	id := uuid.New().String()
	client := &WSClient{
		ID:       id,
		PlayerID: id,
		Send:     make(chan []byte, 256),
		conn:     conn,
		handler:  h,
	}

	go client.writePump()
	client.readPump()
}

// registerClient adds a client to the internal clientsByRoom map (keyed by connection ID).
func (h *Handler) registerClient(roomCode string, c *WSClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clientsByRoom[roomCode] == nil {
		h.clientsByRoom[roomCode] = make(map[string]*WSClient)
	}
	h.clientsByRoom[roomCode][c.ID] = c
}

// unregister handles client disconnect.
func (h *Handler) unregister(c *WSClient) {
	close(c.Send)

	if c.RoomCode == "" {
		return
	}

	h.mu.Lock()
	if rm, ok := h.clientsByRoom[c.RoomCode]; ok {
		delete(rm, c.ID)
		if len(rm) == 0 {
			delete(h.clientsByRoom, c.RoomCode)
		}
	}
	h.mu.Unlock()

	room, ok := h.manager.GetRoom(c.RoomCode)
	if !ok {
		return
	}

	var empty bool
	if c.IsSpectator {
		empty = room.RemoveSpectator(c.ID)
		if !empty {
			h.broadcast(c.RoomCode, OutboundMessage{
				Type:    MsgSpectatorLeft,
				Payload: SpectatorLeftPayload{SpectatorID: c.ID},
			})
		}
	} else {
		var playerLeft bool
		var newHostID string
		empty, playerLeft, newHostID = room.RemovePlayer(c.PlayerID)
		if playerLeft && !empty {
			h.broadcast(c.RoomCode, OutboundMessage{
				Type:    MsgPlayerLeft,
				Payload: PlayerLeftPayload{PlayerID: c.PlayerID, NewHostID: newHostID},
			})
		}
	}

	if empty {
		h.manager.DeleteRoom(c.RoomCode)
	}
}

// handleMessage routes an inbound message to the appropriate handler.
func (h *Handler) handleMessage(c *WSClient, raw []byte) {
	var msg InboundMessage
	if err := json.Unmarshal(raw, &msg); err != nil {
		h.sendError(c, "invalid message format")
		return
	}

	switch msg.Type {
	case MsgCreateRoom:
		h.handleCreateRoom(c, msg.Payload)
	case MsgJoinRoom:
		h.handleJoinRoom(c, msg.Payload)
	case MsgStartGame:
		h.handleStartGame(c, msg.Payload)
	case MsgClaim:
		h.handleClaim(c, msg.Payload)
	case MsgChatSend:
		h.handleChat(c, msg.Payload)
	case MsgRestartGame:
		h.handleRestartGame(c)
	case MsgDevReset:
		h.handleDevReset(c)
	case MsgUpdateSettings:
		h.handleUpdateSettings(c, msg.Payload)
	case MsgJoinAsPlayer:
		h.handleJoinAsPlayer(c)
	default:
		h.sendError(c, "unknown message type")
	}
}

func (h *Handler) handleCreateRoom(c *WSClient, payload map[string]interface{}) {
	rawName, _ := payload["name"].(string)
	name, errMsg := validateName(rawName)
	if errMsg != "" {
		h.sendError(c, errMsg)
		return
	}

	room, err := h.manager.CreateRoom(c.ID, name)
	if err != nil {
		h.sendError(c, err.Error())
		return
	}

	c.Name = name
	c.RoomCode = room.Code
	room.RegisterClient(c.ID, c)
	h.registerClient(room.Code, c)

	h.sendTo(c, OutboundMessage{
		Type: MsgRoomJoined,
		Payload: RoomJoinedPayload{
			RoomCode: room.Code,
			PlayerID: c.ID,
			IsHost:   true,
			Players:  room.PlayerList(),
			Settings: room.Settings,
		},
	})
}

func (h *Handler) handleJoinRoom(c *WSClient, payload map[string]interface{}) {
	code, _ := payload["code"].(string)
	if code == "" {
		h.sendError(c, "code and name are required")
		return
	}
	rawName, _ := payload["name"].(string)
	name, errMsg := validateName(rawName)
	if errMsg != "" {
		h.sendError(c, errMsg)
		return
	}

	room, ok := h.manager.GetRoom(code)
	if !ok {
		h.sendError(c, "room not found")
		return
	}

	room.RLock()
	state := room.State
	centerCard := make([]int, len(room.CenterCard))
	copy(centerCard, room.CenterCard)
	deckSize := room.TotalCardsLeft()
	room.RUnlock()

	if state != game.StateWaiting {
		// Dev: allow mid-game join as a player (bots only)
		if gin.IsDebugging() {
			if dev, ok := payload["dev"].(map[string]interface{}); ok {
				if allowMidGame, _ := dev["allow_mid_game"].(bool); allowMidGame {
					if err := room.AddPlayerMidGame(c.ID, name); err != nil {
						h.sendError(c, err.Error())
						return
					}

					c.Name = name
					c.RoomCode = code
					room.RegisterClient(c.ID, c)
					h.registerClient(code, c)

					room.RLock()
					centerCard := make([]int, len(room.CenterCard))
					copy(centerCard, room.CenterCard)
					deckSize := room.TotalCardsLeft()
					newPlayer := room.Players[c.ID]
					room.RUnlock()

					h.broadcastExcept(code, c.ID, OutboundMessage{
						Type:    MsgPlayerJoined,
						Payload: PlayerJoinedPayload{Player: newPlayer},
					})
					room.RLock()
					settings := room.Settings
					room.RUnlock()
					h.sendTo(c, OutboundMessage{
						Type: MsgRoomJoined,
						Payload: RoomJoinedPayload{
							RoomCode:   code,
							PlayerID:   c.ID,
							IsHost:     false,
							Players:    room.PlayerList(),
							Settings:   settings,
							CenterCard: centerCard,
							DeckSize:   deckSize,
						},
					})
					return
				}
			}
		}

		// Game already started — add as spectator
		c.Name = name
		c.RoomCode = code
		c.IsSpectator = true
		room.AddSpectator(c.ID, name, c)
		h.registerClient(code, c)

		spectatorInfo := SpectatorInfo{ID: c.ID, Name: name}
		h.broadcastExcept(code, c.ID, OutboundMessage{
			Type:    MsgSpectatorJoined,
			Payload: SpectatorJoinedPayload{Spectator: spectatorInfo},
		})

		entries := room.SpectatorList()
		spectators := make([]SpectatorInfo, len(entries))
		for i, s := range entries {
			spectators[i] = SpectatorInfo{ID: s.ID, Name: s.Name}
		}

		room.RLock()
		spectatorSettings := room.Settings
		room.RUnlock()
		h.sendTo(c, OutboundMessage{
			Type: MsgRoomJoined,
			Payload: RoomJoinedPayload{
				RoomCode:    code,
				PlayerID:    c.ID,
				IsHost:      false,
				IsSpectator: true,
				Players:     room.PlayerList(),
				Settings:    spectatorSettings,
				CenterCard:  centerCard,
				DeckSize:    deckSize,
				Spectators:  spectators,
			},
		})
		return
	}

	if err := room.AddPlayer(c.ID, name); err != nil {
		// Room full in lobby — join as spectator instead of rejecting.
		c.Name = name
		c.RoomCode = code
		c.IsSpectator = true
		room.AddSpectator(c.ID, name, c)
		h.registerClient(code, c)

		h.broadcastExcept(code, c.ID, OutboundMessage{
			Type:    MsgSpectatorJoined,
			Payload: SpectatorJoinedPayload{Spectator: SpectatorInfo{ID: c.ID, Name: name}},
		})

		entries := room.SpectatorList()
		spectators := make([]SpectatorInfo, len(entries))
		for i, s := range entries {
			spectators[i] = SpectatorInfo{ID: s.ID, Name: s.Name}
		}

		room.RLock()
		lobbySettings := room.Settings
		lastWinnerID := room.LastWinnerID
		lastGamePlayers := room.LastGamePlayers
		room.RUnlock()
		h.sendTo(c, OutboundMessage{
			Type: MsgRoomJoined,
			Payload: RoomJoinedPayload{
				RoomCode:        code,
				PlayerID:        c.ID,
				IsHost:          false,
				IsSpectator:     true,
				Players:         room.PlayerList(),
				Settings:        lobbySettings,
				Spectators:      spectators,
				LastWinnerID:    lastWinnerID,
				LastGamePlayers: lastGamePlayers,
			},
		})
		return
	}

	c.Name = name
	c.RoomCode = code
	room.RegisterClient(c.ID, c)
	h.registerClient(code, c)

	room.RLock()
	newPlayer := room.Players[c.ID]
	room.RUnlock()

	h.broadcastExcept(code, c.ID, OutboundMessage{
		Type:    MsgPlayerJoined,
		Payload: PlayerJoinedPayload{Player: newPlayer},
	})

	room.RLock()
	lastWinnerID := room.LastWinnerID
	lastGamePlayers := room.LastGamePlayers
	room.RUnlock()

	room.RLock()
	joinerSettings := room.Settings
	room.RUnlock()
	h.sendTo(c, OutboundMessage{
		Type: MsgRoomJoined,
		Payload: RoomJoinedPayload{
			RoomCode:        code,
			PlayerID:        c.ID,
			IsHost:          false,
			Players:         room.PlayerList(),
			Settings:        joinerSettings,
			LastWinnerID:    lastWinnerID,
			LastGamePlayers: lastGamePlayers,
		},
	})
}

func (h *Handler) handleStartGame(c *WSClient, payload map[string]interface{}) {
	if c.RoomCode == "" {
		h.sendError(c, "not in a room")
		return
	}

	room, ok := h.manager.GetRoom(c.RoomCode)
	if !ok {
		h.sendError(c, "room not found")
		return
	}

	room.RLock()
	isHost := room.HostID == c.PlayerID
	room.RUnlock()

	if !isHost {
		h.sendError(c, "only host can start the game")
		return
	}

	var opts game.StartGameOptions
	if gin.IsDebugging() {
		if dev, ok := payload["dev"].(map[string]interface{}); ok {
			if v, ok := dev["skip_countdown"].(bool); ok {
				opts.SkipCountdown = v
			}
		}
	}

	if err := room.StartGame(opts); err != nil {
		h.sendError(c, err.Error())
		return
	}

	room.RLock()
	centerCard := make([]int, len(room.CenterCard))
	copy(centerCard, room.CenterCard)
	deckSize := room.TotalCardsLeft()
	room.RUnlock()

	players := room.PlayerList()

	h.broadcast(c.RoomCode, OutboundMessage{
		Type: MsgGameStarted,
		Payload: GameStartedPayload{
			CenterCard: centerCard,
			Players:    players,
			DeckSize:   deckSize,
		},
	})
}

func (h *Handler) handleClaim(c *WSClient, payload map[string]interface{}) {
	if c.RoomCode == "" {
		h.sendError(c, "not in a room")
		return
	}

	symbolF, _ := payload["symbol"].(float64)
	symbol := int(symbolF)
	if symbol == 0 {
		h.sendError(c, "symbol is required")
		return
	}

	room, ok := h.manager.GetRoom(c.RoomCode)
	if !ok {
		h.sendError(c, "room not found")
		return
	}

	result := room.Claim(c.PlayerID, symbol)
	if result.Rejected {
		return
	}

	h.broadcast(c.RoomCode, OutboundMessage{
		Type: MsgClaimResult,
		Payload: ClaimResultPayload{
			PlayerID:   c.PlayerID,
			Symbol:     symbol,
			Correct:    result.Correct,
			CenterCard: result.CenterCard,
			Players:    result.Players,
			DeckSize:   result.DeckSize,
		},
	})

	if result.GameOver {
		h.broadcast(c.RoomCode, OutboundMessage{
			Type: MsgGameOver,
			Payload: GameOverPayload{
				Players:  result.Players,
				WinnerID: result.WinnerID,
			},
		})
		// Store result now so new joiners see the scoreboard while host decides to restart.
		room.SetLastGameResult(result.WinnerID, result.Players)
	}
}

func (h *Handler) handleJoinAsPlayer(c *WSClient) {
	if c.RoomCode == "" || !c.IsSpectator {
		return
	}

	room, ok := h.manager.GetRoom(c.RoomCode)
	if !ok {
		return
	}

	room.RLock()
	state := room.State
	room.RUnlock()

	if state != game.StateWaiting {
		h.sendError(c, "game is already in progress")
		return
	}

	// Remove from spectators first so AddPlayer's count check sees the right number.
	room.RemoveSpectator(c.ID)

	if err := room.AddPlayer(c.ID, c.Name); err != nil {
		// Room is full — put them back as a spectator and report the error.
		room.AddSpectator(c.ID, c.Name, c)
		h.sendError(c, err.Error())
		return
	}

	room.RegisterClient(c.ID, c)
	c.IsSpectator = false

	room.RLock()
	newPlayer := room.Players[c.ID]
	room.RUnlock()

	h.broadcast(c.RoomCode, OutboundMessage{
		Type:    MsgSpectatorLeft,
		Payload: SpectatorLeftPayload{SpectatorID: c.ID},
	})
	h.broadcastExcept(c.RoomCode, c.ID, OutboundMessage{
		Type:    MsgPlayerJoined,
		Payload: PlayerJoinedPayload{Player: newPlayer},
	})
	h.sendTo(c, OutboundMessage{
		Type:    MsgJoinedAsPlayer,
		Payload: JoinedAsPlayerPayload{Player: newPlayer},
	})
}

func (h *Handler) handleUpdateSettings(c *WSClient, payload map[string]interface{}) {
	if c.RoomCode == "" {
		h.sendError(c, "not in a room")
		return
	}
	room, ok := h.manager.GetRoom(c.RoomCode)
	if !ok {
		h.sendError(c, "room not found")
		return
	}

	room.RLock()
	isHost := room.HostID == c.PlayerID
	state := room.State
	room.RUnlock()

	if !isHost {
		h.sendError(c, "only host can change settings")
		return
	}
	if state != game.StateWaiting {
		h.sendError(c, "cannot change settings during game")
		return
	}

	maxPlayers, _ := payload["max_players"].(float64)
	deckSize, _ := payload["deck_size"].(float64)
	wrongMs, _ := payload["wrong_claim_penalty_ms"].(float64)
	correctMs, _ := payload["correct_claim_lock_ms"].(float64)

	clamped := room.UpdateSettings(game.RoomSettings{
		MaxPlayers:          int(maxPlayers),
		DeckSize:            int(deckSize),
		WrongClaimPenaltyMs: int(wrongMs),
		CorrectClaimLockMs:  int(correctMs),
	})

	h.broadcast(c.RoomCode, OutboundMessage{
		Type:    MsgSettingsUpdated,
		Payload: clamped,
	})
}

func (h *Handler) handleDevReset(c *WSClient) {
	if c.RoomCode == "" {
		return
	}
	room, ok := h.manager.GetRoom(c.RoomCode)
	if !ok {
		return
	}

	room.RLock()
	hostID := room.HostID
	players := room.PlayerList()
	room.RUnlock()

	// Find winner by current score
	winnerID := ""
	maxScore := -1
	for _, p := range players {
		if p.Score > maxScore {
			maxScore = p.Score
			winnerID = p.ID
		}
	}

	h.broadcast(c.RoomCode, OutboundMessage{
		Type:    MsgGameOver,
		Payload: GameOverPayload{Players: players, WinnerID: winnerID},
	})

	room.ForceResetToLobby()
	h.broadcast(c.RoomCode, OutboundMessage{
		Type: MsgGameReset,
		Payload: GameResetPayload{
			Players: room.PlayerList(),
			HostID:  hostID,
		},
	})
}

func (h *Handler) handleRestartGame(c *WSClient) {
	if c.RoomCode == "" {
		h.sendError(c, "not in a room")
		return
	}

	room, ok := h.manager.GetRoom(c.RoomCode)
	if !ok {
		h.sendError(c, "room not found")
		return
	}

	room.RLock()
	isHost := room.HostID == c.PlayerID
	hostID := room.HostID
	room.RUnlock()

	if !isHost {
		h.sendError(c, "only host can restart the game")
		return
	}

	if err := room.ResetToLobby(); err != nil {
		h.sendError(c, err.Error())
		return
	}

	h.broadcast(c.RoomCode, OutboundMessage{
		Type: MsgGameReset,
		Payload: GameResetPayload{
			Players: room.PlayerList(),
			HostID:  hostID,
		},
	})
}

func (h *Handler) handleChat(c *WSClient, payload map[string]interface{}) {
	if c.RoomCode == "" {
		return
	}
	text, _ := payload["text"].(string)
	text = strings.TrimSpace(text)
	if text == "" || len(text) > 200 {
		return
	}
	h.broadcast(c.RoomCode, OutboundMessage{
		Type: MsgChatMessage,
		Payload: ChatMessagePayload{
			SenderID:          c.PlayerID,
			SenderName:        c.Name,
			SenderIsSpectator: c.IsSpectator,
			Text:              text,
			Timestamp:         time.Now().UnixMilli(),
		},
	})
}

// broadcast sends a message to all clients in a room.
func (h *Handler) broadcast(roomCode string, msg interface{}) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("broadcast marshal error: %v", err)
		return
	}

	h.mu.RLock()
	clients := h.clientsByRoom[roomCode]
	h.mu.RUnlock()

	for _, c := range clients {
		c.SendMsg(data)
	}
}

// broadcastExcept sends to all clients in a room except the given connection ID.
func (h *Handler) broadcastExcept(roomCode, excludeID string, msg interface{}) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	h.mu.RLock()
	clients := h.clientsByRoom[roomCode]
	h.mu.RUnlock()

	for id, c := range clients {
		if id != excludeID {
			c.SendMsg(data)
		}
	}
}

// sendTo sends a message to a single client.
func (h *Handler) sendTo(c *WSClient, msg interface{}) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	c.SendMsg(data)
}

// sendError sends an error message to a single client.
func (h *Handler) sendError(c *WSClient, message string) {
	h.sendTo(c, OutboundMessage{
		Type:    MsgError,
		Payload: ErrorPayload{Message: message},
	})
}
