package game

import (
	crand "crypto/rand"
	"math/big"
	"sync"
)

const roomCodeChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

type Manager struct {
	rooms map[string]*Room
	mu    sync.RWMutex
}

func NewManager() *Manager {
	return &Manager{
		rooms: make(map[string]*Room),
	}
}

// generateCodeLocked creates a unique 6-character alphanumeric room code.
// Must be called with m.mu write lock held.
func (m *Manager) generateCodeLocked() string {
	n := big.NewInt(int64(len(roomCodeChars)))
	for {
		code := make([]byte, 6)
		for i := range code {
			idx, _ := crand.Int(crand.Reader, n)
			code[i] = roomCodeChars[idx.Int64()]
		}
		s := string(code)
		if _, exists := m.rooms[s]; !exists {
			return s
		}
	}
}

// CreateRoom creates a new room with the given host.
// The code check and insertion are atomic under a single write lock.
func (m *Manager) CreateRoom(hostID, hostName string) (*Room, error) {
	m.mu.Lock()
	code := m.generateCodeLocked()
	room := NewRoom(code, hostID, hostName)
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
