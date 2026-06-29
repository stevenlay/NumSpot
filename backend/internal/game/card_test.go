package game

import "testing"

func TestFindMatch(t *testing.T) {
	tests := []struct {
		name string
		a, b []int
		want int
	}{
		{
			name: "match at first position",
			a:    []int{3, 10, 20, 30},
			b:    []int{3, 11, 21, 31},
			want: 3,
		},
		{
			name: "match at last position",
			a:    []int{1, 2, 3, 7},
			b:    []int{5, 6, 4, 7},
			want: 7,
		},
		{
			name: "match in middle",
			a:    []int{1, 2, 5, 4},
			b:    []int{6, 5, 7, 8},
			want: 5,
		},
		{
			name: "no match returns -1",
			a:    []int{1, 2, 3, 4},
			b:    []int{5, 6, 7, 8},
			want: -1,
		},
		{
			name: "works with display (1-based) values",
			a:    []int{1, 8, 15, 22, 29, 36, 43, 50},
			b:    []int{2, 8, 16, 23, 30, 37, 44, 51},
			want: 8,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := FindMatch(tt.a, tt.b); got != tt.want {
				t.Errorf("FindMatch(%v, %v) = %d, want %d", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestToDisplay(t *testing.T) {
	input := []int{0, 1, 6, 56}
	got := ToDisplay(input)
	want := []int{1, 2, 7, 57}
	if !slicesEqual(got, want) {
		t.Errorf("ToDisplay(%v) = %v, want %v", input, got, want)
	}
}

func TestGenerateCards(t *testing.T) {
	cards := GenerateCards(7)

	t.Run("produces 57 cards", func(t *testing.T) {
		if len(cards) != 57 {
			t.Errorf("got %d cards, want 57", len(cards))
		}
	})

	t.Run("each card has 8 symbols", func(t *testing.T) {
		for i, c := range cards {
			if len(c) != 8 {
				t.Errorf("cards[%d] has %d symbols, want 8", i, len(c))
			}
		}
	})

	t.Run("any two cards share exactly one symbol", func(t *testing.T) {
		for i := 0; i < len(cards); i++ {
			for j := i + 1; j < len(cards); j++ {
				matches := 0
				for _, v := range cards[i] {
					for _, w := range cards[j] {
						if v == w {
							matches++
						}
					}
				}
				if matches != 1 {
					t.Errorf("cards[%d] and cards[%d] share %d symbols, want 1", i, j, matches)
				}
			}
		}
	})
}
