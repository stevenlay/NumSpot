package game

import (
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
	penalizedUntil time.Time
}

type Room struct {
	Code             string
	HostID           string
	Players          map[string]*Player
	Clients          map[string]Client
	State            GameState
	CenterCard       []int
	Deck             [][]int
	CreatedAt        time.Time
	claimLockedUntil time.Time
	countdownUntil   time.Time
	mu               sync.RWMutex
}

func NewRoom(code, hostID, hostName string) *Room {
	r := &Room{
		Code:      code,
		HostID:    hostID,
		Players:   make(map[string]*Player),
		Clients:   make(map[string]Client),
		State:     StateWaiting,
		CreatedAt: time.Now(),
	}
	r.Players[hostID] = &Player{ID: hostID, Name: hostName, Score: 0, Card: []int{}}
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
	r.Players[playerID] = &Player{ID: playerID, Name: name, Score: 0, Card: []int{}}
	return nil
}

// RemovePlayer removes a player. Returns true if the room is now empty.
func (r *Room) RemovePlayer(playerID string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.Players, playerID)
	delete(r.Clients, playerID)
	return len(r.Players) == 0
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

	r.CenterCard = deck[0]
	deck = deck[1:]

	for _, p := range r.Players {
		p.Card = deck[0]
		deck = deck[1:]
	}

	r.Deck = deck
	r.State = StatePlaying
	r.countdownUntil = time.Now().Add(countdownDuration)
	return nil
}

// ClaimResult holds the outcome of a claim attempt.
type ClaimResult struct {
	Correct    bool
	Rejected   bool // silently dropped — player is on cooldown
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
	if !ok || r.State != StatePlaying || r.CenterCard == nil {
		return ClaimResult{Correct: false}
	}

	now := time.Now()
	if now.Before(r.countdownUntil) || now.Before(r.claimLockedUntil) || now.Before(p.penalizedUntil) {
		return ClaimResult{Rejected: true}
	}

	// Convert display symbol to 0-based for FindMatch
	symIdx := FromDisplay(symbol)
	playerCard0 := fromDisplay(p.Card)
	centerCard0 := fromDisplay(r.CenterCard)

	match := FindMatch(playerCard0, centerCard0)
	if match != symIdx {
		p.penalizedUntil = now.Add(wrongClaimPenalty)
		return ClaimResult{Correct: false}
	}

	// Correct claim — lock the room for all players during the transition
	r.claimLockedUntil = now.Add(correctClaimLockDuration)
	p.Score++

	// Player inherits the center card; advance center from deck
	p.Card = r.CenterCard
	if len(r.Deck) > 0 {
		r.CenterCard = r.Deck[0]
		r.Deck = r.Deck[1:]
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

// fromDisplay converts a 1-indexed card to 0-indexed.
func fromDisplay(card []int) []int {
	out := make([]int, len(card))
	for i, v := range card {
		out[i] = v - 1
	}
	return out
}
