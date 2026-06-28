package game

import (
	crand "crypto/rand"
	"encoding/hex"
	"errors"
	"math/rand"
	"sync"
	"time"
)

type GameState int

const (
	StateWaiting  GameState = iota
	StatePlaying
	StateFinished
)

// Client is an interface for the WebSocket client, defined here to avoid circular imports.
// The ws package will implement this.
type Client interface {
	GetID() string
	SendMsg(data []byte)
	Close()
}

type SpectatorEntry struct {
	ID     string
	Name   string
	client Client
}

const (
	wrongClaimPenalty        = 1500 * time.Millisecond
	correctClaimLockDuration = 2000 * time.Millisecond
	countdownDuration        = 4000 * time.Millisecond
)

type Player struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Score          int       `json:"score"`
	Card           []int     `json:"card"`
	Connected      bool      `json:"connected"`
	Token          string    `json:"-"`
	activeClientID string    // connection UUID of the currently active WS client
	penalizedUntil time.Time
}

type Room struct {
	Code             string
	HostID           string
	Players          map[string]*Player
	Clients          map[string]Client
	Spectators       map[string]*SpectatorEntry
	State            GameState
	CenterCard       []int
	Deck             [][]int
	CreatedAt        time.Time
	claimLockedUntil time.Time
	countdownUntil   time.Time
	mu               sync.RWMutex
}

func generateToken() string {
	b := make([]byte, 16)
	crand.Read(b) //nolint:errcheck — crypto/rand.Read never errors on supported platforms
	return hex.EncodeToString(b)
}

func NewRoom(code, hostID, hostName string) *Room {
	r := &Room{
		Code:       code,
		HostID:     hostID,
		Players:    make(map[string]*Player),
		Clients:    make(map[string]Client),
		Spectators: make(map[string]*SpectatorEntry),
		State:      StateWaiting,
		CreatedAt:  time.Now(),
	}
	r.Players[hostID] = &Player{
		ID:             hostID,
		Name:           hostName,
		Score:          0,
		Card:           []int{},
		Connected:      true,
		Token:          generateToken(),
		activeClientID: hostID, // for new connections, clientID == playerID
	}
	return r
}

func (r *Room) Lock()    { r.mu.Lock() }
func (r *Room) Unlock()  { r.mu.Unlock() }
func (r *Room) RLock()   { r.mu.RLock() }
func (r *Room) RUnlock() { r.mu.RUnlock() }

// AddPlayer adds a new player to the room. Returns error if room is not in waiting state or full.
func (r *Room) AddPlayer(playerID, name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.State != StateWaiting {
		return errors.New("game already started")
	}
	if len(r.Players) >= 8 {
		return errors.New("room is full")
	}
	r.Players[playerID] = &Player{
		ID:             playerID,
		Name:           name,
		Score:          0,
		Card:           []int{},
		Connected:      true,
		Token:          generateToken(),
		activeClientID: playerID, // for new connections, clientID == playerID
	}
	return nil
}

// RemovePlayer disconnects a player identified by their connection client ID.
// During waiting: fully removes (with host transfer) if this is their active connection.
// During playing/finished: marks disconnected if this is their active connection.
// Returns whether the room is now empty, and whether the player was actually disconnected
// (false means this was a stale unregister from a superseded connection).
func (r *Room) RemovePlayer(playerID, clientID string) (empty bool, playerDisconnected bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, exists := r.Players[playerID]
	if !exists {
		return r.isEmpty(), false
	}

	isActiveClient := p.activeClientID == clientID

	// Only remove from Clients map if the current tracked client is this one
	if activeClient, ok := r.Clients[playerID]; ok && activeClient.GetID() == clientID {
		delete(r.Clients, playerID)
	}

	if r.State == StateWaiting {
		if isActiveClient {
			delete(r.Players, playerID)
			if r.HostID == playerID {
				for id := range r.Players {
					r.HostID = id
					break
				}
			}
			return len(r.Players) == 0, true
		}
		return len(r.Players) == 0, false
	}

	// During game: only mark disconnected if this is the active connection
	if isActiveClient {
		p.Connected = false
		return r.isEmpty(), true
	}
	return r.isEmpty(), false
}

// RejoinPlayer reconnects a disconnected player using their rejoin token.
// If the player still has an active connection (race: client reconnected before server
// detected the drop), the old connection is closed before taking over.
func (r *Room) RejoinPlayer(token string, newClient Client) (*Player, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.State == StateWaiting {
		return nil, errors.New("game has not started")
	}

	var player *Player
	for _, p := range r.Players {
		if p.Token == token {
			player = p
			break
		}
	}
	if player == nil {
		return nil, errors.New("invalid rejoin token")
	}

	// Close the old connection if still present. This handles the race where the client
	// reconnects before the server has detected and cleaned up the old connection.
	if oldClient, ok := r.Clients[player.ID]; ok {
		go oldClient.Close() // async: avoids blocking the lock while closing the socket
	}

	player.Connected = true
	player.activeClientID = newClient.GetID()
	r.Clients[player.ID] = newClient
	return player, nil
}

// isEmpty reports whether the room has no active presence. Must be called with lock held.
func (r *Room) isEmpty() bool {
	for _, p := range r.Players {
		if p.Connected {
			return false
		}
	}
	return len(r.Spectators) == 0
}

// AddSpectator registers a spectating client (game already in progress).
func (r *Room) AddSpectator(clientID, name string, client Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Spectators[clientID] = &SpectatorEntry{ID: clientID, Name: name, client: client}
}

// SpectatorList returns a snapshot of all spectators.
func (r *Room) SpectatorList() []*SpectatorEntry {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]*SpectatorEntry, 0, len(r.Spectators))
	for _, s := range r.Spectators {
		list = append(list, s)
	}
	return list
}

// RemoveSpectator removes a spectating client.
// Returns true if the room should be deleted.
func (r *Room) RemoveSpectator(clientID string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.Spectators, clientID)
	return r.isEmpty()
}

// RegisterClient associates a WebSocket client with a player.
func (r *Room) RegisterClient(playerID string, c Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Clients[playerID] = c
}

// PlayerList returns a snapshot of all players (for JSON broadcasting).
func (r *Room) PlayerList() []*Player {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]*Player, 0, len(r.Players))
	for _, p := range r.Players {
		list = append(list, p)
	}
	return list
}

// StartGame initializes and shuffles the deck, deals cards. Returns error if not ready.
func (r *Room) StartGame() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.State != StateWaiting {
		return errors.New("game already started")
	}
	if len(r.Players) < 1 {
		return errors.New("need at least 1 player")
	}

	// Generate deck
	cards := GenerateCards(7)
	deck := make([][]int, len(cards))
	copy(deck, cards)

	// Shuffle
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	rng.Shuffle(len(deck), func(i, j int) { deck[i], deck[j] = deck[j], deck[i] })

	// Convert to display (1-indexed)
	for i, card := range deck {
		deck[i] = ToDisplay(card)
	}

	// Deal one card to each player, one to center
	// Need len(Players)+1 cards minimum
	if len(deck) < len(r.Players)+1 {
		return errors.New("not enough cards")
	}

	last := len(deck) - 1
	r.CenterCard = deck[last]
	deck = deck[:last]

	for _, p := range r.Players {
		last = len(deck) - 1
		p.Card = deck[last]
		deck = deck[:last]
	}

	r.Deck = deck
	r.State = StatePlaying
	r.countdownUntil = time.Now().Add(countdownDuration)
	return nil
}

// ClaimResult holds the outcome of a claim attempt.
type ClaimResult struct {
	Correct    bool
	Rejected   bool // silently dropped — player is on cooldown or not a participant
	GameOver   bool
	CenterCard []int
	Players    []*Player
	WinnerID   string
	DeckSize   int
}

// Claim processes a player's claim of a symbol (1-indexed display number).
// Returns ClaimResult.
func (r *Room) Claim(playerID string, symbol int) ClaimResult {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, ok := r.Players[playerID]
	if !ok {
		return ClaimResult{Rejected: true} // spectator or unknown player
	}
	if r.State != StatePlaying || r.CenterCard == nil {
		return ClaimResult{Correct: false}
	}

	now := time.Now()
	if now.Before(r.countdownUntil) || now.Before(r.claimLockedUntil) || now.Before(p.penalizedUntil) {
		return ClaimResult{Rejected: true}
	}

	match := FindMatch(p.Card, r.CenterCard)
	if match != symbol {
		p.penalizedUntil = now.Add(wrongClaimPenalty)
		return ClaimResult{Correct: false}
	}

	// Correct claim — lock the room for all players during the transition
	r.claimLockedUntil = now.Add(correctClaimLockDuration)
	p.Score++

	// Player's card becomes the new center; player draws a fresh card from deck
	r.CenterCard = p.Card
	if len(r.Deck) > 0 {
		last := len(r.Deck) - 1
		p.Card = r.Deck[last]
		r.Deck = r.Deck[:last]
	} else {
		r.State = StateFinished
	}

	gameOver := r.State == StateFinished
	winnerID := ""
	if gameOver {
		winnerID = r.findWinner()
	}

	players := make([]*Player, 0, len(r.Players))
	for _, pl := range r.Players {
		players = append(players, pl)
	}

	return ClaimResult{
		Correct:    true,
		GameOver:   gameOver,
		CenterCard: r.CenterCard,
		Players:    players,
		WinnerID:   winnerID,
		DeckSize:   len(r.Deck),
	}
}

// findWinner returns the player ID with the highest score. Must be called with lock held.
func (r *Room) findWinner() string {
	var winnerID string
	maxScore := -1
	for id, p := range r.Players {
		if p.Score > maxScore {
			maxScore = p.Score
			winnerID = id
		}
	}
	return winnerID
}
