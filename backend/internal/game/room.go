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
	Close()
}

type SpectatorEntry struct {
	ID     string
	Name   string
	client Client
}

const (
	countdownDuration = 4000 * time.Millisecond
)

// RoomSettings holds configurable game settings that the host can change in the lobby.
type RoomSettings struct {
	MaxPlayers          int `json:"max_players"`
	DeckSize            int `json:"deck_size"`
	WrongClaimPenaltyMs int `json:"wrong_claim_penalty_ms"`
	CorrectClaimLockMs  int `json:"correct_claim_lock_ms"`
}

func defaultRoomSettings() RoomSettings {
	return RoomSettings{
		MaxPlayers:          8,
		DeckSize:            57,
		WrongClaimPenaltyMs: 1500,
		CorrectClaimLockMs:  2000,
	}
}

type Player struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Score        int    `json:"score"`
	SessionScore int    `json:"session_score"`
	Card         []int  `json:"card"`
	CardsLeft    int    `json:"cards_left"`

	deck          [][]int
	penalizedUntil time.Time
}

type Room struct {
	Code             string
	HostID           string
	Settings         RoomSettings
	Players          map[string]*Player
	Clients          map[string]Client
	Spectators       map[string]*SpectatorEntry
	State            GameState
	CenterCard       []int
	Deck             [][]int
	CreatedAt        time.Time
	claimLockedUntil time.Time
	countdownUntil   time.Time
	wrongClaimDelay   time.Duration
	correctClaimDelay time.Duration
	LastWinnerID     string
	LastGamePlayers  []*Player
	mu               sync.RWMutex
}

func NewRoom(code, hostID, hostName string) *Room {
	r := &Room{
		Code:       code,
		HostID:     hostID,
		Settings:   defaultRoomSettings(),
		Players:    make(map[string]*Player),
		Clients:    make(map[string]Client),
		Spectators: make(map[string]*SpectatorEntry),
		State:      StateWaiting,
		CreatedAt:  time.Now(),
	}
	r.Players[hostID] = &Player{
		ID:   hostID,
		Name: hostName,
	}
	return r
}

func (r *Room) Lock()    { r.mu.Lock() }
func (r *Room) Unlock()  { r.mu.Unlock() }
func (r *Room) RLock()   { r.mu.RLock() }
func (r *Room) RUnlock() { r.mu.RUnlock() }

// TotalCardsLeft returns the sum of all players' remaining private deck sizes.
// Caller must hold at least a read lock.
func (r *Room) TotalCardsLeft() int {
	total := 0
	for _, p := range r.Players {
		total += p.CardsLeft
	}
	return total
}

// AddPlayer adds a new player to the room. Returns error if room is not in waiting state or full.
func (r *Room) AddPlayer(playerID, name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.State != StateWaiting {
		return errors.New("game already started")
	}
	if len(r.Players) >= r.Settings.MaxPlayers {
		return errors.New("room is full")
	}
	r.Players[playerID] = &Player{
		ID:   playerID,
		Name: name,
	}
	return nil
}

// UpdateSettings validates, clamps, and stores new settings. Returns the clamped settings.
// Must be called only when State == StateWaiting; caller is responsible for that check.
func (r *Room) UpdateSettings(s RoomSettings) RoomSettings {
	if s.MaxPlayers < 2 {
		s.MaxPlayers = 2
	}
	if s.MaxPlayers > 8 {
		s.MaxPlayers = 8
	}
	if s.DeckSize < 5 {
		s.DeckSize = 5
	}
	if s.DeckSize > 57 {
		s.DeckSize = 57
	}
	if s.WrongClaimPenaltyMs < 0 {
		s.WrongClaimPenaltyMs = 0
	}
	if s.WrongClaimPenaltyMs > 10000 {
		s.WrongClaimPenaltyMs = 10000
	}
	if s.CorrectClaimLockMs < 0 {
		s.CorrectClaimLockMs = 0
	}
	if s.CorrectClaimLockMs > 10000 {
		s.CorrectClaimLockMs = 10000
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Settings = s
	return s
}

// RemovePlayer fully removes a player from the room.
// Returns whether the room is now empty, whether the player existed (and was removed),
// and the new host ID if the host was transferred (empty string if no transfer occurred).
func (r *Room) RemovePlayer(playerID string) (empty bool, playerLeft bool, newHostID string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.Players[playerID]; !exists {
		return r.isEmpty(), false, ""
	}

	delete(r.Players, playerID)
	delete(r.Clients, playerID)

	if r.HostID == playerID {
		for id := range r.Players {
			r.HostID = id
			newHostID = id
			break
		}
	}

	return r.isEmpty(), true, newHostID
}

// isEmpty reports whether the room has no active presence. Must be called with lock held.
func (r *Room) isEmpty() bool {
	return len(r.Players) == 0 && len(r.Spectators) == 0
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

// StartGameOptions holds dev-only overrides for game start.
type StartGameOptions struct {
	SkipCountdown bool
}

// AddPlayerMidGame adds a player to an in-progress game and deals them a card from the deck.
func (r *Room) AddPlayerMidGame(playerID, name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.State != StatePlaying {
		return errors.New("game not in progress")
	}
	if len(r.Players) >= r.Settings.MaxPlayers {
		return errors.New("room is full")
	}
	// Mid-game joins are no longer supported once per-player decks are distributed.
	return errors.New("no cards left in deck")
}

// StartGame initializes and shuffles the deck, deals cards. Returns error if not ready.
func (r *Room) StartGame(opts StartGameOptions) error {
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

	// Truncate deck to the configured size (enforce minimum for dealing)
	if r.Settings.DeckSize < len(deck) {
		size := r.Settings.DeckSize
		min := len(r.Players) + 1
		if size < min {
			size = min
		}
		deck = deck[:size]
	}

	// Convert to display (1-indexed)
	for i, card := range deck {
		deck[i] = ToDisplay(card)
	}

	// Deal center card and distribute remaining cards evenly to per-player decks
	numPlayers := len(r.Players)
	if len(deck) < numPlayers+1 {
		return errors.New("not enough cards")
	}

	last := len(deck) - 1
	r.CenterCard = deck[last]
	deck = deck[:last]

	// Distribute remaining cards evenly; leftover cards are discarded
	cardsPerPlayer := len(deck) / numPlayers
	playerList := make([]*Player, 0, numPlayers)
	for _, p := range r.Players {
		playerList = append(playerList, p)
	}
	for i, p := range playerList {
		alloc := deck[i*cardsPerPlayer : (i+1)*cardsPerPlayer]
		p.Card = alloc[0]
		if len(alloc) > 1 {
			p.deck = make([][]int, len(alloc)-1)
			copy(p.deck, alloc[1:])
		} else {
			p.deck = nil
		}
		p.CardsLeft = len(p.deck) + 1
	}

	r.Deck = nil
	r.State = StatePlaying
	r.wrongClaimDelay = time.Duration(r.Settings.WrongClaimPenaltyMs) * time.Millisecond
	r.correctClaimDelay = time.Duration(r.Settings.CorrectClaimLockMs) * time.Millisecond
	if !opts.SkipCountdown {
		r.countdownUntil = time.Now().Add(countdownDuration)
	}
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
		p.penalizedUntil = now.Add(r.wrongClaimDelay)
		return ClaimResult{Correct: false}
	}

	// Correct claim — lock the room for all players during the transition
	r.claimLockedUntil = now.Add(r.correctClaimDelay)
	p.Score++

	// Player's card becomes the new center; player draws from their private deck
	r.CenterCard = p.Card
	if len(p.deck) > 0 {
		last := len(p.deck) - 1
		p.Card = p.deck[last]
		p.deck = p.deck[:last]
		p.CardsLeft = len(p.deck) + 1
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

	totalCardsLeft := 0
	for _, pl := range r.Players {
		totalCardsLeft += pl.CardsLeft
	}

	return ClaimResult{
		Correct:    true,
		GameOver:   gameOver,
		CenterCard: r.CenterCard,
		Players:    players,
		WinnerID:   winnerID,
		DeckSize:   totalCardsLeft,
	}
}

// SetLastGameResult stores a deep copy of the final game result before scores are cleared.
func (r *Room) SetLastGameResult(winnerID string, players []*Player) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.LastWinnerID = winnerID
	r.LastGamePlayers = make([]*Player, len(players))
	for i, p := range players {
		cp := *p
		r.LastGamePlayers[i] = &cp
	}
}

// ResetToLobby resets the room back to the waiting state for another game.
// Scores are cleared, cards are wiped, and the deck is emptied.
// Returns error if the room is not in the finished state.
func (r *Room) ResetToLobby() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.State != StateFinished {
		return errors.New("game is not finished")
	}

	r.resetLocked()
	return nil
}

// ForceResetToLobby resets the room regardless of current state (dev use only).
func (r *Room) ForceResetToLobby() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.resetLocked()
}

// resetLocked performs the actual reset. Must be called with lock held.
func (r *Room) resetLocked() {
	for _, p := range r.Players {
		p.SessionScore += p.Score
		p.Score = 0
		p.Card = nil
		p.deck = nil
		p.CardsLeft = 0
	}
	r.Deck = nil
	r.CenterCard = nil
	r.claimLockedUntil = time.Time{}
	r.countdownUntil = time.Time{}
	r.State = StateWaiting
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
