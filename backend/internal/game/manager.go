package game

import (
	"math/rand"
	"sync"
	"time"
)

const roomCodeChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

type Manager struct {
	rooms map[string]*Room
	mu    sync.RWMutex
	rng   *rand.Rand
}

func NewManager() *Manager {
	return &Manager{
		rooms: make(map[string]*Room),
		rng:   rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// GenerateCode creates a unique 6-character alphanumeric room code.
func (m *Manager) GenerateCode() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	for {
		code := make([]byte, 6)
		for i := range code {
			code[i] = roomCodeChars[m.rng.Intn(len(roomCodeChars))]
		}
		s := string(code)
		if _, exists := m.rooms[s]; !exists {
			return s
		}
	}
}

// CreateRoom creates a new room with the given host.
func (m *Manager) CreateRoom(hostID, hostName string) (*Room, error) {
	code := m.GenerateCode()
	room := NewRoom(code, hostID, hostName)

	m.mu.Lock()
	m.rooms[code] = room
	m.mu.Unlock()

	return room, nil
}

// GetRoom retrieves a room by code.
func (m *Manager) GetRoom(code string) (*Room, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	r, ok := m.rooms[code]
	return r, ok
}

// DeleteRoom removes a room by code.
func (m *Manager) DeleteRoom(code string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.rooms, code)
}
