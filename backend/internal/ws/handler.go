package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/numspot/server/internal/game"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// Handler manages WebSocket connections and routes messages to game logic.
type Handler struct {
	manager *game.Manager
	// clientsByRoom: roomCode → (playerID → *WSClient)
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

	client := &WSClient{
		ID:      uuid.New().String(),
		Send:    make(chan []byte, 256),
		conn:    conn,
		handler: h,
	}

	go client.writePump()
	client.readPump()
}

// registerClient adds a client to the internal clientsByRoom map.
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

	empty := room.RemovePlayer(c.ID)
	if empty {
		h.manager.DeleteRoom(c.RoomCode)
		return
	}

	h.broadcast(c.RoomCode, OutboundMessage{
		Type:    MsgPlayerLeft,
		Payload: PlayerLeftPayload{PlayerID: c.ID},
	})
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
		h.handleStartGame(c)
	case MsgClaim:
		h.handleClaim(c, msg.Payload)
	default:
		h.sendError(c, "unknown message type")
	}
}

func (h *Handler) handleCreateRoom(c *WSClient, payload map[string]interface{}) {
	name, _ := payload["name"].(string)
	if name == "" {
		h.sendError(c, "name is required")
		return
	}

	room, err := h.manager.CreateRoom(c.ID, name)
	if err != nil {
		h.sendError(c, err.Error())
		return
	}

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
		},
	})
}

func (h *Handler) handleJoinRoom(c *WSClient, payload map[string]interface{}) {
	code, _ := payload["code"].(string)
	name, _ := payload["name"].(string)
	if code == "" || name == "" {
		h.sendError(c, "code and name are required")
		return
	}

	room, ok := h.manager.GetRoom(code)
	if !ok {
		h.sendError(c, "room not found")
		return
	}

	if err := room.AddPlayer(c.ID, name); err != nil {
		h.sendError(c, err.Error())
		return
	}

	c.RoomCode = code
	room.RegisterClient(c.ID, c)
	h.registerClient(code, c)

	// Get new player info
	room.RLock()
	newPlayer := room.Players[c.ID]
	room.RUnlock()

	// Notify existing clients of new player
	h.broadcastExcept(code, c.ID, OutboundMessage{
		Type:    MsgPlayerJoined,
		Payload: PlayerJoinedPayload{Player: newPlayer},
	})

	// Send room_joined to the joining client
	h.sendTo(c, OutboundMessage{
		Type: MsgRoomJoined,
		Payload: RoomJoinedPayload{
			RoomCode: code,
			PlayerID: c.ID,
			IsHost:   false,
			Players:  room.PlayerList(),
		},
	})
}

func (h *Handler) handleStartGame(c *WSClient) {
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
	isHost := room.HostID == c.ID
	room.RUnlock()

	if !isHost {
		h.sendError(c, "only host can start the game")
		return
	}

	if err := room.StartGame(); err != nil {
		h.sendError(c, err.Error())
		return
	}

	room.RLock()
	centerCard := make([]int, len(room.CenterCard))
	copy(centerCard, room.CenterCard)
	room.RUnlock()

	players := room.PlayerList()

	h.broadcast(c.RoomCode, OutboundMessage{
		Type: MsgGameStarted,
		Payload: GameStartedPayload{
			CenterCard: centerCard,
			Players:    players,
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

	result := room.Claim(c.ID, symbol)

	h.broadcast(c.RoomCode, OutboundMessage{
		Type: MsgClaimResult,
		Payload: ClaimResultPayload{
			PlayerID:   c.ID,
			Symbol:     symbol,
			Correct:    result.Correct,
			CenterCard: result.CenterCard,
			Players:    result.Players,
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
	}
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

// broadcastExcept sends to all clients in a room except the given player ID.
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

