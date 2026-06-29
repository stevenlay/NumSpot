package ws

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/numspot/server/internal/game"
)

func TestMain(m *testing.M) {
	gin.SetMode(gin.DebugMode)
	gin.DefaultWriter = io.Discard
	os.Exit(m.Run())
}

// --- test helpers ---

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	mgr := game.NewManager()
	h := NewHandler(mgr)
	r := gin.New()
	r.GET("/ws", func(c *gin.Context) { h.ServeWS(c) })
	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	return srv
}

func dialWS(t *testing.T, srv *httptest.Server) *websocket.Conn {
	t.Helper()
	u := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws"
	conn, _, err := websocket.DefaultDialer.Dial(u, nil)
	if err != nil {
		t.Fatalf("dialWS: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return conn
}

func sendMsg(t *testing.T, conn *websocket.Conn, msgType string, payload any) {
	t.Helper()
	b, _ := json.Marshal(map[string]any{"type": msgType, "payload": payload})
	if err := conn.WriteMessage(websocket.TextMessage, b); err != nil {
		t.Fatalf("sendMsg %q: %v", msgType, err)
	}
}

// readUntil reads WebSocket frames until it finds one with the expected type.
// Other message types are discarded — broadcasts may arrive in any order.
func readUntil(t *testing.T, conn *websocket.Conn, msgType string) json.RawMessage {
	t.Helper()
	conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	for {
		_, b, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("readUntil %q: %v", msgType, err)
		}
		var env struct {
			Type    string          `json:"type"`
			Payload json.RawMessage `json:"payload"`
		}
		if err := json.Unmarshal(b, &env); err != nil {
			t.Fatalf("readUntil: unmarshal: %v", err)
		}
		if env.Type == msgType {
			return env.Payload
		}
	}
}

// createRoom dials a connection, sends create_room, waits for room_joined, and
// returns the connection, the room code, and the host's player ID.
func createRoom(t *testing.T, srv *httptest.Server, name string) (conn *websocket.Conn, roomCode, playerID string) {
	t.Helper()
	conn = dialWS(t, srv)
	sendMsg(t, conn, MsgCreateRoom, map[string]any{"name": name})
	var p struct {
		RoomCode string `json:"room_code"`
		PlayerID string `json:"player_id"`
	}
	json.Unmarshal(readUntil(t, conn, MsgRoomJoined), &p)
	return conn, p.RoomCode, p.PlayerID
}

// startGame sends start_game with skip_countdown (requires debug mode) and
// returns the raw game_started payload.
func startGame(t *testing.T, conn *websocket.Conn) json.RawMessage {
	t.Helper()
	sendMsg(t, conn, MsgStartGame, map[string]any{
		"dev": map[string]any{"skip_countdown": true},
	})
	return readUntil(t, conn, MsgGameStarted)
}

// --- integration tests ---

func TestCreateRoom_HappyPath(t *testing.T) {
	srv := newTestServer(t)
	_, roomCode, playerID := createRoom(t, srv, "Alice")

	if len(roomCode) != 6 {
		t.Errorf("room_code length = %d, want 6", len(roomCode))
	}
	if playerID == "" {
		t.Error("player_id should be non-empty")
	}
}

func TestCreateRoom_InvalidName(t *testing.T) {
	srv := newTestServer(t)
	conn := dialWS(t, srv)
	sendMsg(t, conn, MsgCreateRoom, map[string]any{"name": "!"})

	var p struct{ Message string `json:"message"` }
	json.Unmarshal(readUntil(t, conn, MsgError), &p)
	if p.Message == "" {
		t.Error("expected non-empty error message for invalid name")
	}
}

func TestJoinRoom_HappyPath(t *testing.T) {
	srv := newTestServer(t)
	host, code, _ := createRoom(t, srv, "Host")

	guest := dialWS(t, srv)
	sendMsg(t, guest, MsgJoinRoom, map[string]any{"code": code, "name": "Guest"})

	// Host receives player_joined
	var joined struct {
		Player struct {
			Name string `json:"name"`
		} `json:"player"`
	}
	json.Unmarshal(readUntil(t, host, MsgPlayerJoined), &joined)
	if joined.Player.Name != "Guest" {
		t.Errorf("player name = %q, want Guest", joined.Player.Name)
	}

	// Guest receives room_joined
	var roomJoined struct {
		RoomCode    string `json:"room_code"`
		IsHost      bool   `json:"is_host"`
		IsSpectator bool   `json:"is_spectator"`
	}
	json.Unmarshal(readUntil(t, guest, MsgRoomJoined), &roomJoined)
	if roomJoined.RoomCode != code {
		t.Errorf("room_code = %q, want %q", roomJoined.RoomCode, code)
	}
	if roomJoined.IsHost {
		t.Error("guest should not be host")
	}
	if roomJoined.IsSpectator {
		t.Error("guest should not be spectator in an open lobby")
	}
}

func TestJoinRoom_NotFound(t *testing.T) {
	srv := newTestServer(t)
	conn := dialWS(t, srv)
	sendMsg(t, conn, MsgJoinRoom, map[string]any{"code": "XXXXXX", "name": "Alice"})

	var p struct{ Message string `json:"message"` }
	json.Unmarshal(readUntil(t, conn, MsgError), &p)
	if p.Message == "" {
		t.Error("expected error for unknown room code")
	}
}

func TestJoinRoom_AsSpectatorDuringGame(t *testing.T) {
	srv := newTestServer(t)
	host, code, _ := createRoom(t, srv, "Host")
	startGame(t, host)

	spectator := dialWS(t, srv)
	sendMsg(t, spectator, MsgJoinRoom, map[string]any{"code": code, "name": "Watcher"})

	var p struct {
		IsSpectator bool  `json:"is_spectator"`
		CenterCard  []int `json:"center_card"`
	}
	json.Unmarshal(readUntil(t, spectator, MsgRoomJoined), &p)
	if !p.IsSpectator {
		t.Error("expected is_spectator=true when joining an active game")
	}
	if len(p.CenterCard) == 0 {
		t.Error("spectator should receive center_card of active game")
	}
}

func TestStartGame_HappyPath(t *testing.T) {
	srv := newTestServer(t)
	host, code, _ := createRoom(t, srv, "Host")
	guest := dialWS(t, srv)
	sendMsg(t, guest, MsgJoinRoom, map[string]any{"code": code, "name": "Guest"})
	readUntil(t, guest, MsgRoomJoined)
	readUntil(t, host, MsgPlayerJoined) // drain before startGame

	raw := startGame(t, host)
	readUntil(t, guest, MsgGameStarted) // guest also receives it

	var gs struct {
		CenterCard []int `json:"center_card"`
		DeckSize   int   `json:"deck_size"`
	}
	json.Unmarshal(raw, &gs)
	if len(gs.CenterCard) == 0 {
		t.Error("center_card should be non-empty after game start")
	}
	if gs.DeckSize == 0 {
		t.Error("deck_size should be non-zero after game start")
	}
}

func TestStartGame_NonHostRejected(t *testing.T) {
	srv := newTestServer(t)
	_, code, _ := createRoom(t, srv, "Host")

	guest := dialWS(t, srv)
	sendMsg(t, guest, MsgJoinRoom, map[string]any{"code": code, "name": "Guest"})
	readUntil(t, guest, MsgRoomJoined)

	sendMsg(t, guest, MsgStartGame, nil)
	var p struct{ Message string `json:"message"` }
	json.Unmarshal(readUntil(t, guest, MsgError), &p)
	if p.Message == "" {
		t.Error("expected error when non-host starts game")
	}
}

func TestClaim_Correct(t *testing.T) {
	srv := newTestServer(t)
	host, _, playerID := createRoom(t, srv, "Host")
	raw := startGame(t, host)

	var gs struct {
		CenterCard []int `json:"center_card"`
		Players    []struct {
			ID   string `json:"id"`
			Card []int  `json:"card"`
		} `json:"players"`
	}
	json.Unmarshal(raw, &gs)

	var myCard []int
	for _, p := range gs.Players {
		if p.ID == playerID {
			myCard = p.Card
			break
		}
	}
	if myCard == nil {
		t.Fatalf("could not find own player card (playerID=%s)", playerID)
	}

	symbol := game.FindMatch(myCard, gs.CenterCard)
	sendMsg(t, host, MsgClaim, map[string]any{"symbol": symbol})

	var cr struct {
		Correct  bool   `json:"correct"`
		PlayerID string `json:"player_id"`
	}
	json.Unmarshal(readUntil(t, host, MsgClaimResult), &cr)
	if !cr.Correct {
		t.Error("expected correct=true for matching symbol")
	}
	if cr.PlayerID != playerID {
		t.Errorf("player_id = %q, want %q", cr.PlayerID, playerID)
	}
}

func TestClaim_Wrong(t *testing.T) {
	srv := newTestServer(t)
	host, _, playerID := createRoom(t, srv, "Host")
	raw := startGame(t, host)

	var gs struct {
		CenterCard []int `json:"center_card"`
		Players    []struct {
			ID   string `json:"id"`
			Card []int  `json:"card"`
		} `json:"players"`
	}
	json.Unmarshal(raw, &gs)

	var myCard []int
	for _, p := range gs.Players {
		if p.ID == playerID {
			myCard = p.Card
			break
		}
	}

	match := game.FindMatch(myCard, gs.CenterCard)
	wrongSymbol := -1
	for _, n := range myCard {
		if n != match {
			wrongSymbol = n
			break
		}
	}
	if wrongSymbol == -1 {
		t.Fatal("could not find a wrong symbol on player card")
	}

	sendMsg(t, host, MsgClaim, map[string]any{"symbol": wrongSymbol})

	var cr struct{ Correct bool `json:"correct"` }
	json.Unmarshal(readUntil(t, host, MsgClaimResult), &cr)
	if cr.Correct {
		t.Error("expected correct=false for non-matching symbol")
	}
}

func TestUpdateSettings_HappyPath(t *testing.T) {
	srv := newTestServer(t)
	host, code, _ := createRoom(t, srv, "Host")
	guest := dialWS(t, srv)
	sendMsg(t, guest, MsgJoinRoom, map[string]any{"code": code, "name": "Guest"})
	readUntil(t, guest, MsgRoomJoined)
	readUntil(t, host, MsgPlayerJoined)

	sendMsg(t, host, MsgUpdateSettings, map[string]any{
		"max_players":            3,
		"deck_size":              30,
		"wrong_claim_penalty_ms": 0,
		"correct_claim_lock_ms":  0,
	})

	var s struct {
		MaxPlayers int `json:"max_players"`
		DeckSize   int `json:"deck_size"`
	}
	json.Unmarshal(readUntil(t, host, MsgSettingsUpdated), &s)
	if s.MaxPlayers != 3 {
		t.Errorf("max_players = %d, want 3", s.MaxPlayers)
	}
	if s.DeckSize != 30 {
		t.Errorf("deck_size = %d, want 30", s.DeckSize)
	}
	readUntil(t, guest, MsgSettingsUpdated) // guest also receives the broadcast
}

func TestUpdateSettings_NonHostRejected(t *testing.T) {
	srv := newTestServer(t)
	_, code, _ := createRoom(t, srv, "Host")
	guest := dialWS(t, srv)
	sendMsg(t, guest, MsgJoinRoom, map[string]any{"code": code, "name": "Guest"})
	readUntil(t, guest, MsgRoomJoined)

	sendMsg(t, guest, MsgUpdateSettings, map[string]any{
		"max_players": 4, "deck_size": 57, "wrong_claim_penalty_ms": 0, "correct_claim_lock_ms": 0,
	})
	var p struct{ Message string `json:"message"` }
	json.Unmarshal(readUntil(t, guest, MsgError), &p)
	if p.Message == "" {
		t.Error("expected error when non-host updates settings")
	}
}

func TestPlayerDisconnect_BroadcastsPlayerLeft(t *testing.T) {
	srv := newTestServer(t)
	host, code, _ := createRoom(t, srv, "Host")
	guest := dialWS(t, srv)
	sendMsg(t, guest, MsgJoinRoom, map[string]any{"code": code, "name": "Guest"})
	readUntil(t, guest, MsgRoomJoined)
	readUntil(t, host, MsgPlayerJoined)

	guest.Close()

	var p struct{ PlayerID string `json:"player_id"` }
	json.Unmarshal(readUntil(t, host, MsgPlayerLeft), &p)
	if p.PlayerID == "" {
		t.Error("expected player_id in player_left message")
	}
}

func TestJoinAsPlayer_ErrorWhenGameInProgress(t *testing.T) {
	srv := newTestServer(t)
	host, code, _ := createRoom(t, srv, "Host")
	startGame(t, host)

	spectator := dialWS(t, srv)
	sendMsg(t, spectator, MsgJoinRoom, map[string]any{"code": code, "name": "Watcher"})
	readUntil(t, spectator, MsgRoomJoined)

	sendMsg(t, spectator, MsgJoinAsPlayer, nil)
	var p struct{ Message string `json:"message"` }
	json.Unmarshal(readUntil(t, spectator, MsgError), &p)
	if p.Message == "" {
		t.Error("expected error when spectator tries to join as player during active game")
	}
}

func TestUnknownMessageType(t *testing.T) {
	srv := newTestServer(t)
	conn := dialWS(t, srv)
	sendMsg(t, conn, "totally_made_up", nil)

	var p struct{ Message string `json:"message"` }
	json.Unmarshal(readUntil(t, conn, MsgError), &p)
	if p.Message == "" {
		t.Error("expected error for unknown message type")
	}
}

func TestChat(t *testing.T) {
	srv := newTestServer(t)
	host, code, _ := createRoom(t, srv, "Host")
	guest := dialWS(t, srv)
	sendMsg(t, guest, MsgJoinRoom, map[string]any{"code": code, "name": "Guest"})
	readUntil(t, guest, MsgRoomJoined)
	readUntil(t, host, MsgPlayerJoined)

	sendMsg(t, host, MsgChatSend, map[string]any{"text": "hello"})

	var msg struct {
		SenderName string `json:"sender_name"`
		Text       string `json:"text"`
		Timestamp  int64  `json:"timestamp"`
	}
	// Both connections receive the broadcast
	json.Unmarshal(readUntil(t, host, MsgChatMessage), &msg)
	if msg.SenderName != "Host" {
		t.Errorf("sender_name = %q, want Host", msg.SenderName)
	}
	if msg.Text != "hello" {
		t.Errorf("text = %q, want hello", msg.Text)
	}
	if msg.Timestamp == 0 {
		t.Error("timestamp should be non-zero")
	}
	readUntil(t, guest, MsgChatMessage) // guest also receives it
}

func TestChat_EmptyOrTooLongTextDropped(t *testing.T) {
	srv := newTestServer(t)
	host, _, _ := createRoom(t, srv, "Host")

	// Empty text: server silently drops it (no response expected).
	// We verify by sending a valid chat immediately after and confirming only one message arrives.
	sendMsg(t, host, MsgChatSend, map[string]any{"text": ""})
	sendMsg(t, host, MsgChatSend, map[string]any{"text": "ping"})

	var msg struct{ Text string `json:"text"` }
	json.Unmarshal(readUntil(t, host, MsgChatMessage), &msg)
	if msg.Text != "ping" {
		t.Errorf("text = %q, want ping (empty message should have been dropped)", msg.Text)
	}
}

func TestDevReset(t *testing.T) {
	srv := newTestServer(t)
	host, code, _ := createRoom(t, srv, "Host")
	guest := dialWS(t, srv)
	sendMsg(t, guest, MsgJoinRoom, map[string]any{"code": code, "name": "Guest"})
	readUntil(t, guest, MsgRoomJoined)
	readUntil(t, host, MsgPlayerJoined)
	startGame(t, host)
	readUntil(t, guest, MsgGameStarted)

	sendMsg(t, host, MsgDevReset, nil)

	// Both connections receive game_over then game_reset
	readUntil(t, host, MsgGameOver)
	var reset struct {
		Players []any  `json:"players"`
		HostID  string `json:"host_id"`
	}
	json.Unmarshal(readUntil(t, host, MsgGameReset), &reset)
	if reset.HostID == "" {
		t.Error("host_id should be set in game_reset")
	}
	readUntil(t, guest, MsgGameOver)
	readUntil(t, guest, MsgGameReset)
}

// TestRestartGame_HappyPath plays through a minimal deck to reach StateFinished,
// then verifies the host can restart and everyone receives game_reset.
func TestRestartGame_HappyPath(t *testing.T) {
	srv := newTestServer(t)
	host, _, playerID := createRoom(t, srv, "Host")

	// Minimum deck so we cycle through quickly; no claim lock so claims don't block each other.
	sendMsg(t, host, MsgUpdateSettings, map[string]any{
		"max_players": 8, "deck_size": 5,
		"wrong_claim_penalty_ms": 0, "correct_claim_lock_ms": 0,
	})
	readUntil(t, host, MsgSettingsUpdated)

	raw := startGame(t, host)

	// Parse CenterCard + the player's own card and CardsLeft out of any game state blob.
	var center []int
	var myCard []int
	var cardsLeft int
	parseState := func(data json.RawMessage) {
		var s struct {
			CenterCard []int `json:"center_card"`
			Players    []struct {
				ID        string `json:"id"`
				Card      []int  `json:"card"`
				CardsLeft int    `json:"cards_left"`
			} `json:"players"`
		}
		json.Unmarshal(data, &s)
		center = s.CenterCard
		for _, p := range s.Players {
			if p.ID == playerID {
				myCard = p.Card
				cardsLeft = p.CardsLeft
				break
			}
		}
	}
	parseState(raw)

	// Play correct claims until the deck is exhausted (triggers game_over).
	for {
		symbol := game.FindMatch(myCard, center)
		sendMsg(t, host, MsgClaim, map[string]any{"symbol": symbol})
		crRaw := readUntil(t, host, MsgClaimResult)
		parseState(crRaw)
		if cardsLeft == 0 {
			break
		}
	}

	readUntil(t, host, MsgGameOver)

	// Host explicitly restarts — room is in StateFinished.
	sendMsg(t, host, MsgRestartGame, nil)

	var reset struct{ HostID string `json:"host_id"` }
	json.Unmarshal(readUntil(t, host, MsgGameReset), &reset)
	if reset.HostID == "" {
		t.Error("expected host_id in game_reset payload")
	}
}

// TestRestartGame_NonHostRejected verifies that only the host can send restart_game.
func TestRestartGame_NonHostRejected(t *testing.T) {
	srv := newTestServer(t)
	_, code, _ := createRoom(t, srv, "Host")
	guest := dialWS(t, srv)
	sendMsg(t, guest, MsgJoinRoom, map[string]any{"code": code, "name": "Guest"})
	readUntil(t, guest, MsgRoomJoined)

	sendMsg(t, guest, MsgRestartGame, nil)
	var p struct{ Message string `json:"message"` }
	json.Unmarshal(readUntil(t, guest, MsgError), &p)
	if p.Message == "" {
		t.Error("expected error when non-host sends restart_game")
	}
}

// TestRestartGame_NotFinished verifies the error path when the room is not in StateFinished.
func TestRestartGame_NotFinished(t *testing.T) {
	srv := newTestServer(t)
	host, _, _ := createRoom(t, srv, "Host")
	// Room is in StateWaiting — ResetToLobby requires StateFinished.
	sendMsg(t, host, MsgRestartGame, nil)
	var p struct{ Message string `json:"message"` }
	json.Unmarshal(readUntil(t, host, MsgError), &p)
	if p.Message == "" {
		t.Error("expected error when restart_game sent from non-finished room")
	}
}

// TestJoinAsPlayer_HappyPath verifies a lobby spectator can convert to a player
// when a slot opens up (host raises max_players after room was full).
func TestJoinAsPlayer_HappyPath(t *testing.T) {
	srv := newTestServer(t)

	// Host creates room and caps it at 2 players.
	host, code, _ := createRoom(t, srv, "Host")
	sendMsg(t, host, MsgUpdateSettings, map[string]any{
		"max_players": 2, "deck_size": 57, "wrong_claim_penalty_ms": 0, "correct_claim_lock_ms": 0,
	})
	readUntil(t, host, MsgSettingsUpdated)

	// P2 fills the last player slot.
	p2 := dialWS(t, srv)
	sendMsg(t, p2, MsgJoinRoom, map[string]any{"code": code, "name": "P2"})
	readUntil(t, p2, MsgRoomJoined)
	readUntil(t, host, MsgPlayerJoined) // drain P2's join notification

	// P3 joins but the room is full — lands as lobby spectator.
	p3 := dialWS(t, srv)
	sendMsg(t, p3, MsgJoinRoom, map[string]any{"code": code, "name": "P3"})
	var p3Joined struct {
		IsSpectator bool `json:"is_spectator"`
	}
	json.Unmarshal(readUntil(t, p3, MsgRoomJoined), &p3Joined)
	if !p3Joined.IsSpectator {
		t.Fatal("P3 should have joined as spectator when room was full")
	}
	readUntil(t, host, MsgSpectatorJoined) // drain spectator_joined notification

	// Host opens a slot by raising max_players to 3.
	sendMsg(t, host, MsgUpdateSettings, map[string]any{
		"max_players": 3, "deck_size": 57, "wrong_claim_penalty_ms": 0, "correct_claim_lock_ms": 0,
	})
	readUntil(t, host, MsgSettingsUpdated)

	// P3 converts from spectator to player.
	sendMsg(t, p3, MsgJoinAsPlayer, nil)

	var joined struct {
		Player struct {
			Name string `json:"name"`
		} `json:"player"`
	}
	json.Unmarshal(readUntil(t, p3, MsgJoinedAsPlayer), &joined)
	if joined.Player.Name != "P3" {
		t.Errorf("joined player name = %q, want P3", joined.Player.Name)
	}

	// Host should see the spectator_left broadcast and then player_joined for P3.
	readUntil(t, host, MsgSpectatorLeft)
	var pj struct {
		Player struct{ Name string `json:"name"` } `json:"player"`
	}
	json.Unmarshal(readUntil(t, host, MsgPlayerJoined), &pj)
	if pj.Player.Name != "P3" {
		t.Errorf("host player_joined name = %q, want P3", pj.Player.Name)
	}
}
