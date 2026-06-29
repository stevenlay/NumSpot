# Testing

## Backend (Go)

Tests live alongside their package (`room_test.go` next to `room.go`). Run from the `backend` directory:

```bash
go test ./...

# With verbose output
go test -v ./...
```

### What's covered (`internal/game/room_test.go`)

| Area | Cases |
|------|-------|
| `StartGame` | State transitions to playing; center card and player cards are dealt; per-player deck sizes are correct; all dealt cards are distinct; error if called twice |
| `Claim` (correct) | Score increments; player's old card becomes new center; player draws next card from private deck; CardsLeft decrements |
| `Claim` (wrong) | Score unchanged; center card unchanged; CardsLeft unchanged; player is penalized |
| Rejection — countdown | Claims rejected while start countdown is active |
| Rejection — claim lock | Claims rejected during the post-correct-claim lock window |
| Rejection — penalty | Claims rejected while player is under a wrong-claim penalty |
| Game over | GameOver=true and State=Finished when a player's private deck is exhausted on a correct claim |

---

## Frontend (JavaScript / React)

## Stack

- **[Vitest](https://vitest.dev/)** — test runner (Vite-native, Jest-compatible API)
- **[React Testing Library](https://testing-library.com/react)** — component rendering and interaction
- **[@testing-library/user-event](https://testing-library.com/docs/user-event/intro)** — realistic user interactions (typing, clicking)
- **[@testing-library/jest-dom](https://github.com/testing-library/jest-dom)** — DOM matchers (`toBeInTheDocument`, `toHaveAttribute`, etc.)

## Running tests

From the `frontend` directory:

```bash
# Watch mode (re-runs on file change)
npm test

# Single run (CI / pre-commit)
npm run test:run
```

## What's covered

### `src/pages/Home.test.tsx`

| Area | Cases |
|------|-------|
| Rendering | Title, slogan |
| Tabs | Create Room active by default, Join Room reveals room code input |
| Name validation | Empty, too short (< 2 chars), invalid characters, error clears on type |
| Room code validation | Empty code when joining |
| Form submission | `connect(name)` on create, `connect(name, code)` on join |
| Server errors | Error message from store renders in alert banner |

## Philosophy

Tests assert **behavior from the user's perspective** — what appears on screen and what happens when the user interacts with it. Implementation details (state shape, internal functions) are not tested directly.

## Adding tests

- Place test files alongside the component they test: `Foo.tsx` → `Foo.test.tsx`
- Mock the game store with `vi.mock('../store/gameStore')` and use a selector-compatible mock (see `Home.test.tsx` for the pattern)
- Wrap components that use routing in `<MemoryRouter>`
