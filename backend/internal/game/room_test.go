package game

import (
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

	t.Run("deck size equals total cards minus dealt", func(t *testing.T) {
		r := NewRoom("TEST", "host", "Host")
		r.AddPlayer("p2", "P2")
		r.AddPlayer("p3", "P3")
		r.StartGame(StartGameOptions{})

		want := 57 - 1 - len(r.Players)
		if len(r.Deck) != want {
			t.Errorf("deck size = %d, want %d", len(r.Deck), want)
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

		oldPlayerCard := append([]int{}, host.Card...)
		oldDeckSize := len(r.Deck)

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
		// Player's old card should now be the center
		if !slicesEqual(r.CenterCard, oldPlayerCard) {
			t.Errorf("CenterCard = %v, want player's old card %v", r.CenterCard, oldPlayerCard)
		}
		// Player should have a fresh deck card
		if slicesEqual(host.Card, oldPlayerCard) {
			t.Error("player card should have changed after correct claim")
		}
		if len(r.Deck) != oldDeckSize-1 {
			t.Errorf("deck size = %d, want %d", len(r.Deck), oldDeckSize-1)
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
		oldDeckSize := len(r.Deck)

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
		if len(r.Deck) != oldDeckSize {
			t.Error("deck should not advance on wrong claim")
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

		r.Deck = r.Deck[:0] // exhaust the deck before the claim

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
