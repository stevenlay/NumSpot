package game

import (
	"fmt"
	"testing"
	"time"
)

// newPlayingRoom creates a single-player room with the countdown already expired.
func newPlayingRoom(t *testing.T) *Room {
	t.Helper()
	r := NewRoom("TEST", "host", "Host")
	if err := r.StartGame(StartGameOptions{}); err != nil {
		t.Fatalf("StartGame: %v", err)
	}
	r.countdownUntil = time.Now().Add(-time.Second)
	return r
}

func slicesEqual(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestStartGame(t *testing.T) {
	t.Run("sets state to playing", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		if err := r.StartGame(StartGameOptions{}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if r.State != StatePlaying {
			t.Errorf("State = %v, want StatePlaying", r.State)
		}
	})

	t.Run("deals center card and player cards", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		r.AddPlayer("p2", "P2")
		r.StartGame(StartGameOptions{})

		if len(r.CenterCard) == 0 {
			t.Error("CenterCard is empty after StartGame")
		}
		for id, p := range r.Players {
			if len(p.Card) == 0 {
				t.Errorf("player %s has empty card", id)
			}
		}
	})

	t.Run("total cards left equals shared deck size after dealing", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		r.AddPlayer("p2", "P2")
		r.AddPlayer("p3", "P3")
		r.StartGame(StartGameOptions{})

		numPlayers := len(r.Players) // 3
		// 57 cards: numPlayers to players, 1 to center, rest to shared deck
		wantDeckSize := 57 - numPlayers - 1
		got := r.TotalCardsLeft()
		if got != wantDeckSize {
			t.Errorf("TotalCardsLeft = %d, want %d", got, wantDeckSize)
		}
	})

	t.Run("all dealt cards are distinct", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		r.AddPlayer("p2", "P2")
		r.StartGame(StartGameOptions{})

		cards := [][]int{r.CenterCard}
		for _, p := range r.Players {
			cards = append(cards, p.Card)
		}
		for i := 0; i < len(cards); i++ {
			for j := i + 1; j < len(cards); j++ {
				if slicesEqual(cards[i], cards[j]) {
					t.Errorf("cards[%d] and cards[%d] are identical: %v", i, j, cards[i])
				}
			}
		}
	})

	t.Run("error if already playing", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		r.StartGame(StartGameOptions{})
		if err := r.StartGame(StartGameOptions{}); err == nil {
			t.Error("expected error starting game twice, got nil")
		}
	})
}

func TestClaim(t *testing.T) {
	t.Run("correct claim advances game state", func(t *testing.T) {
		r := newPlayingRoom(t)
		host := r.Players["host"]

		oldCenterCard := append([]int{}, r.CenterCard...)
		oldDeckSize := r.TotalCardsLeft()

		symbol := FindMatch(host.Card, r.CenterCard)
		result := r.Claim("host", symbol)

		if !result.Correct {
			t.Fatal("expected Correct=true")
		}
		if result.Rejected {
			t.Fatal("expected Rejected=false")
		}
		if host.Score != 1 {
			t.Errorf("Score = %d, want 1", host.Score)
		}
		// Player should have taken the center card
		if !slicesEqual(host.Card, oldCenterCard) {
			t.Errorf("player card = %v, want old center card %v", host.Card, oldCenterCard)
		}
		// A new center card should have been dealt from the shared deck
		if slicesEqual(r.CenterCard, oldCenterCard) {
			t.Error("CenterCard should have changed after correct claim")
		}
		if r.TotalCardsLeft() != oldDeckSize-1 {
			t.Errorf("shared deck size = %d, want %d", r.TotalCardsLeft(), oldDeckSize-1)
		}
	})

	t.Run("wrong claim penalizes player without changing state", func(t *testing.T) {
		r := newPlayingRoom(t)
		host := r.Players["host"]

		match := FindMatch(host.Card, r.CenterCard)
		wrongSymbol := -1
		for _, n := range host.Card {
			if n != match {
				wrongSymbol = n
				break
			}
		}
		if wrongSymbol == -1 {
			t.Fatal("could not find a wrong symbol on player's card")
		}

		oldCenter := append([]int{}, r.CenterCard...)
		oldDeckSize := r.TotalCardsLeft()

		result := r.Claim("host", wrongSymbol)

		if result.Correct {
			t.Error("expected Correct=false")
		}
		if result.Rejected {
			t.Error("expected Rejected=false")
		}
		if host.Score != 0 {
			t.Errorf("Score = %d, want 0", host.Score)
		}
		if !slicesEqual(r.CenterCard, oldCenter) {
			t.Error("CenterCard should not change on wrong claim")
		}
		if r.TotalCardsLeft() != oldDeckSize {
			t.Error("shared deck size should not change on wrong claim")
		}
		if !host.penalizedUntil.After(time.Now()) {
			t.Error("player should be penalized after wrong claim")
		}
	})

	t.Run("rejected during countdown", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		r.StartGame(StartGameOptions{}) // countdown is active

		host := r.Players["host"]
		symbol := FindMatch(host.Card, r.CenterCard)
		result := r.Claim("host", symbol)

		if !result.Rejected {
			t.Error("expected Rejected=true during countdown")
		}
	})

	t.Run("rejected during claim lock after correct claim", func(t *testing.T) {
		r := newPlayingRoom(t)
		host := r.Players["host"]

		symbol := FindMatch(host.Card, r.CenterCard)
		r.Claim("host", symbol) // sets claimLockedUntil

		symbol2 := FindMatch(host.Card, r.CenterCard)
		result := r.Claim("host", symbol2)

		if !result.Rejected {
			t.Error("expected Rejected=true during claim lock")
		}
	})

	t.Run("rejected during player penalty after wrong claim", func(t *testing.T) {
		r := newPlayingRoom(t)
		host := r.Players["host"]

		match := FindMatch(host.Card, r.CenterCard)
		wrongSymbol := -1
		for _, n := range host.Card {
			if n != match {
				wrongSymbol = n
				break
			}
		}
		r.Claim("host", wrongSymbol) // sets penalizedUntil

		result := r.Claim("host", match)
		if !result.Rejected {
			t.Error("expected Rejected=true during player penalty")
		}
	})

	t.Run("game over when deck is empty", func(t *testing.T) {
		r := newPlayingRoom(t)
		host := r.Players["host"]

		r.Deck = nil // exhaust the shared deck before the claim

		symbol := FindMatch(host.Card, r.CenterCard)
		result := r.Claim("host", symbol)

		if !result.Correct {
			t.Fatal("expected Correct=true")
		}
		if !result.GameOver {
			t.Error("expected GameOver=true when deck is exhausted")
		}
		if r.State != StateFinished {
			t.Errorf("State = %v, want StateFinished", r.State)
		}
		if result.WinnerID == "" {
			t.Error("WinnerID should be set on game over")
		}
	})
}

func TestAddPlayer(t *testing.T) {
	t.Run("adds player successfully", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		if err := r.AddPlayer("p2", "Alice"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if _, ok := r.Players["p2"]; !ok {
			t.Error("player p2 not found after AddPlayer")
		}
	})

	t.Run("error if game already started", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		r.StartGame(StartGameOptions{})
		if err := r.AddPlayer("p2", "Alice"); err == nil {
			t.Error("expected error adding player during game, got nil")
		}
	})

	t.Run("error when room is full", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		for i := 0; i < 7; i++ {
			r.AddPlayer(fmt.Sprintf("p%d", i), fmt.Sprintf("P%d", i))
		}
		if err := r.AddPlayer("overflow", "Extra"); err == nil {
			t.Error("expected error when adding player to full room, got nil")
		}
	})
}

func TestUpdateSettings(t *testing.T) {
	clamp := func(field string, input, want int, s RoomSettings) {
		t.Helper()
		r := NewRoom("TEST", "host", "Host")
		got := r.UpdateSettings(s)
		var gotVal int
		switch field {
		case "MaxPlayers":
			gotVal = got.MaxPlayers
		case "DeckSize":
			gotVal = got.DeckSize
		case "WrongClaimPenaltyMs":
			gotVal = got.WrongClaimPenaltyMs
		case "CorrectClaimLockMs":
			gotVal = got.CorrectClaimLockMs
		}
		if gotVal != want {
			t.Errorf("%s: input=%d got=%d want=%d", field, input, gotVal, want)
		}
	}

	base := RoomSettings{MaxPlayers: 4, DeckSize: 57, WrongClaimPenaltyMs: 1500, CorrectClaimLockMs: 2000}

	clamp("MaxPlayers", 1, 2, RoomSettings{MaxPlayers: 1, DeckSize: base.DeckSize, WrongClaimPenaltyMs: base.WrongClaimPenaltyMs, CorrectClaimLockMs: base.CorrectClaimLockMs})
	clamp("MaxPlayers", 100, 8, RoomSettings{MaxPlayers: 100, DeckSize: base.DeckSize, WrongClaimPenaltyMs: base.WrongClaimPenaltyMs, CorrectClaimLockMs: base.CorrectClaimLockMs})
	clamp("MaxPlayers", 4, 4, base)

	clamp("DeckSize", 1, 5, RoomSettings{MaxPlayers: base.MaxPlayers, DeckSize: 1, WrongClaimPenaltyMs: base.WrongClaimPenaltyMs, CorrectClaimLockMs: base.CorrectClaimLockMs})
	clamp("DeckSize", 100, 57, RoomSettings{MaxPlayers: base.MaxPlayers, DeckSize: 100, WrongClaimPenaltyMs: base.WrongClaimPenaltyMs, CorrectClaimLockMs: base.CorrectClaimLockMs})

	clamp("WrongClaimPenaltyMs", -1, 0, RoomSettings{MaxPlayers: base.MaxPlayers, DeckSize: base.DeckSize, WrongClaimPenaltyMs: -1, CorrectClaimLockMs: base.CorrectClaimLockMs})
	clamp("WrongClaimPenaltyMs", 10001, 10000, RoomSettings{MaxPlayers: base.MaxPlayers, DeckSize: base.DeckSize, WrongClaimPenaltyMs: 10001, CorrectClaimLockMs: base.CorrectClaimLockMs})
	clamp("WrongClaimPenaltyMs", 0, 0, RoomSettings{MaxPlayers: base.MaxPlayers, DeckSize: base.DeckSize, WrongClaimPenaltyMs: 0, CorrectClaimLockMs: base.CorrectClaimLockMs})

	clamp("CorrectClaimLockMs", -1, 0, RoomSettings{MaxPlayers: base.MaxPlayers, DeckSize: base.DeckSize, WrongClaimPenaltyMs: base.WrongClaimPenaltyMs, CorrectClaimLockMs: -1})
	clamp("CorrectClaimLockMs", 10001, 10000, RoomSettings{MaxPlayers: base.MaxPlayers, DeckSize: base.DeckSize, WrongClaimPenaltyMs: base.WrongClaimPenaltyMs, CorrectClaimLockMs: 10001})

	t.Run("persists clamped values in room", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		r.UpdateSettings(RoomSettings{MaxPlayers: 3, DeckSize: 20, WrongClaimPenaltyMs: 500, CorrectClaimLockMs: 1000})
		if r.Settings.MaxPlayers != 3 {
			t.Errorf("Settings.MaxPlayers = %d, want 3", r.Settings.MaxPlayers)
		}
		if r.Settings.DeckSize != 20 {
			t.Errorf("Settings.DeckSize = %d, want 20", r.Settings.DeckSize)
		}
	})
}

func TestRemovePlayer(t *testing.T) {
	t.Run("removes a non-host player", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		r.AddPlayer("p2", "Alice")

		empty, left, newHostID := r.RemovePlayer("p2")

		if empty {
			t.Error("expected empty=false")
		}
		if !left {
			t.Error("expected playerLeft=true")
		}
		if newHostID != "" {
			t.Errorf("expected no host transfer, got %q", newHostID)
		}
		if _, ok := r.Players["p2"]; ok {
			t.Error("p2 still present after removal")
		}
	})

	t.Run("host transfer when host leaves", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		r.AddPlayer("p2", "Alice")

		empty, left, newHostID := r.RemovePlayer("host")

		if empty {
			t.Error("expected empty=false")
		}
		if !left {
			t.Error("expected playerLeft=true")
		}
		if newHostID != "p2" {
			t.Errorf("expected newHostID=p2, got %q", newHostID)
		}
		if r.HostID != "p2" {
			t.Errorf("HostID = %q, want p2", r.HostID)
		}
	})

	t.Run("room becomes empty when last player leaves", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		empty, left, _ := r.RemovePlayer("host")
		if !empty {
			t.Error("expected empty=true")
		}
		if !left {
			t.Error("expected playerLeft=true")
		}
	})

	t.Run("removing non-existent player returns playerLeft=false", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		empty, left, _ := r.RemovePlayer("ghost")
		if empty {
			t.Error("expected empty=false")
		}
		if left {
			t.Error("expected playerLeft=false for unknown player")
		}
	})
}

func TestSpectators(t *testing.T) {
	t.Run("add and list spectators", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		r.AddSpectator("s1", "Watcher", nil)

		list := r.SpectatorList()
		if len(list) != 1 {
			t.Fatalf("SpectatorList len = %d, want 1", len(list))
		}
		if list[0].ID != "s1" || list[0].Name != "Watcher" {
			t.Errorf("spectator = %+v, want {ID:s1 Name:Watcher}", list[0])
		}
	})

	t.Run("remove spectator returns empty=false when players remain", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		r.AddSpectator("s1", "Watcher", nil)

		empty := r.RemoveSpectator("s1")
		if empty {
			t.Error("expected empty=false with host still in room")
		}
		if len(r.SpectatorList()) != 0 {
			t.Error("spectator still present after removal")
		}
	})

	t.Run("remove spectator returns empty=true when no players or spectators remain", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		r.RemovePlayer("host")
		r.AddSpectator("s1", "Watcher", nil)

		empty := r.RemoveSpectator("s1")
		if !empty {
			t.Error("expected empty=true")
		}
	})
}

func TestResetToLobby(t *testing.T) {
	t.Run("error from waiting state", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		if err := r.ResetToLobby(); err == nil {
			t.Error("expected error resetting from waiting state, got nil")
		}
	})

	t.Run("error from playing state", func(t *testing.T) {
		r := newPlayingRoom(t)
		if err := r.ResetToLobby(); err == nil {
			t.Error("expected error resetting from playing state, got nil")
		}
	})

	t.Run("succeeds from finished state", func(t *testing.T) {
		r := newPlayingRoom(t)
		host := r.Players["host"]
		r.Deck = nil
		symbol := FindMatch(host.Card, r.CenterCard)
		r.Claim("host", symbol)

		if err := r.ResetToLobby(); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if r.State != StateWaiting {
			t.Errorf("State = %v, want StateWaiting", r.State)
		}
		if r.CenterCard != nil {
			t.Error("CenterCard should be nil after reset")
		}
	})

	t.Run("score cleared and accumulated in session score", func(t *testing.T) {
		r := newPlayingRoom(t)
		host := r.Players["host"]

		symbol := FindMatch(host.Card, r.CenterCard)
		r.Claim("host", symbol)
		scoreAfterClaim := host.Score

		// Clear the claim lock so the next claim is not rejected.
		r.claimLockedUntil = time.Time{}

		r.Deck = nil
		symbol2 := FindMatch(host.Card, r.CenterCard)
		r.Claim("host", symbol2) // triggers game over

		r.ResetToLobby()

		if host.Score != 0 {
			t.Errorf("Score = %d after reset, want 0", host.Score)
		}
		if host.SessionScore != scoreAfterClaim+1 {
			t.Errorf("SessionScore = %d, want %d", host.SessionScore, scoreAfterClaim+1)
		}
	})
}

func TestForceResetToLobby(t *testing.T) {
	t.Run("resets from playing state", func(t *testing.T) {
		r := newPlayingRoom(t)
		r.Players["host"].Score = 3
		r.ForceResetToLobby()
		if r.State != StateWaiting {
			t.Errorf("State = %v, want StateWaiting", r.State)
		}
		if r.CenterCard != nil {
			t.Error("CenterCard should be nil after reset")
		}
		if r.Players["host"].Score != 0 {
			t.Error("Score should be 0 after reset")
		}
		if r.Players["host"].SessionScore != 3 {
			t.Errorf("SessionScore = %d, want 3", r.Players["host"].SessionScore)
		}
	})

	t.Run("resets from waiting state", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		r.Players["host"].Score = 5
		r.ForceResetToLobby()
		if r.State != StateWaiting {
			t.Errorf("State = %v, want StateWaiting", r.State)
		}
		if r.Players["host"].SessionScore != 5 {
			t.Errorf("SessionScore = %d, want 5", r.Players["host"].SessionScore)
		}
	})
}

func TestSetLastGameResult(t *testing.T) {
	r := NewRoom("TEST", "host", "Host")
	players := r.PlayerList()

	r.SetLastGameResult("host", players)

	if r.LastWinnerID != "host" {
		t.Errorf("LastWinnerID = %q, want host", r.LastWinnerID)
	}
	if len(r.LastGamePlayers) != len(players) {
		t.Fatalf("LastGamePlayers len = %d, want %d", len(r.LastGamePlayers), len(players))
	}

	// Verify it is a deep copy
	r.Players["host"].Score = 999
	if r.LastGamePlayers[0].Score == 999 {
		t.Error("LastGamePlayers should be a deep copy, not a live reference")
	}
}
