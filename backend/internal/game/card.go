package game

// GenerateCards generates all cards for a projective plane of order p (p must be prime).
// Returns cards where each symbol index is 0-based (0..p²+p).
// For p=7: 57 cards, 8 symbols each, symbols 0..56.
func GenerateCards(p int) [][]int {
	// Symbol indices:
	// Regular (i,j): i*p + j, i,j in [0,p)  → range [0, p²-1]
	// Slope m:       p*p + m, m in [0,p)     → range [p², p²+p-1]
	// Infinity:      p*p + p                  → index p²+p

	inf := p*p + p
	var cards [][]int

	// Card 0: Infinity card
	// [inf, p²+0, p²+1, ..., p²+(p-1)]
	infCard := make([]int, p+1)
	infCard[0] = inf
	for m := 0; m < p; m++ {
		infCard[m+1] = p*p + m
	}
	cards = append(cards, infCard)

	// Cards 1..p²: For each slope m in [0,p), for each offset b in [0,p):
	// card = [p²+m] ++ [x*p + (m*x+b)%p for x in 0..p-1]
	for m := 0; m < p; m++ {
		for b := 0; b < p; b++ {
			card := make([]int, p+1)
			card[0] = p*p + m
			for x := 0; x < p; x++ {
				card[x+1] = x*p + (m*x+b)%p
			}
			cards = append(cards, card)
		}
	}

	// Cards p²+1..p²+p: For each x in [0,p):
	// card = [inf] ++ [x*p+y for y in 0..p-1]  -- wait, spec says p²+p, not inf
	// Re-reading spec: card = [p²+p] ++ [x*p+y for y in 0..p-1]
	// p²+p is the infinity symbol index, so this is correct.
	for x := 0; x < p; x++ {
		card := make([]int, p+1)
		card[0] = inf
		for y := 0; y < p; y++ {
			card[y+1] = x*p + y
		}
		cards = append(cards, card)
	}

	return cards
}

// FindMatch returns the single shared symbol between two cards.
// Returns -1 if no match found (should not happen with valid projective plane cards).
func FindMatch(a, b []int) int {
	set := make(map[int]bool, len(a))
	for _, v := range a {
		set[v] = true
	}
	for _, v := range b {
		if set[v] {
			return v
		}
	}
	return -1
}

// ToDisplay converts 0-based symbol indices to 1-based display numbers.
func ToDisplay(card []int) []int {
	out := make([]int, len(card))
	for i, v := range card {
		out[i] = v + 1
	}
	return out
}

// FromDisplay converts 1-based display number back to 0-based symbol index.
func FromDisplay(n int) int {
	return n - 1
}
