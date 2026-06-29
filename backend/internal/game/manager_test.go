package game

import "testing"

func TestManagerCreateRoom(t *testing.T) {
	m := NewManager()
	room, err := m.CreateRoom("hostID", "Host")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if room == nil {
		t.Fatal("expected room, got nil")
	}
	if len(room.Code) != 6 {
		t.Errorf("room code length = %d, want 6", len(room.Code))
	}
	if room.HostID != "hostID" {
		t.Errorf("HostID = %q, want hostID", room.HostID)
	}
	if _, ok := room.Players["hostID"]; !ok {
		t.Error("host player not added to room")
	}

	// Code is unique: creating a second room should have a different code.
	room2, _ := m.CreateRoom("other", "Other")
	if room2.Code == room.Code {
		t.Error("two rooms should have different codes")
	}
}

func TestManagerGetRoom(t *testing.T) {
	m := NewManager()
	created, _ := m.CreateRoom("h", "Host")

	t.Run("found", func(t *testing.T) {
		r, ok := m.GetRoom(created.Code)
		if !ok {
			t.Error("expected room to be found")
		}
		if r != created {
			t.Error("returned wrong room pointer")
		}
	})

	t.Run("not found", func(t *testing.T) {
		_, ok := m.GetRoom("ZZZZZZ")
		if ok {
			t.Error("expected room not found")
		}
	})
}

func TestManagerDeleteRoom(t *testing.T) {
	m := NewManager()
	room, _ := m.CreateRoom("h", "Host")

	m.DeleteRoom(room.Code)

	_, ok := m.GetRoom(room.Code)
	if ok {
		t.Error("expected room to be deleted")
	}
}
