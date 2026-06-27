# CLAUDE.md

## Project overview

NumSpot is a real-time multiplayer number-spotting game. Players race to find the one number shared between their card and the center card. Communication between client and server is entirely over WebSockets.

## Repo structure

```
numspot/
├── backend/
│   ├── cmd/server/         # Entry point (main.go)
│   └── internal/
│       ├── game/           # Room, player, card logic (manager.go, room.go, card.go)
│       └── ws/             # WebSocket handler, message types, client pump (handler.go, client.go, messages.go)
├── frontend/
│   └── src/
│       ├── pages/          # Home, Lobby, Game
│       ├── components/
│       │   ├── game/       # NumberCard, Scoreboard
│       │   └── ui/         # shadcn/ui components
│       ├── store/          # Zustand store (gameStore.ts) — single source of truth
│       ├── types/          # Shared TypeScript types (game.ts)
│       └── test/           # Vitest setup
├── k8s/                    # Kubernetes manifests
├── docker-compose.yml
├── README.md
└── TESTING.md
```

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, Zustand |
| Backend | Go 1.22, Gin, gorilla/websocket |
| Testing | Vitest, React Testing Library, @testing-library/user-event |
| Runtime | Node.js 24 (see `.nvmrc`) |

## Dev commands

```bash
# Backend
cd backend && go run ./cmd/server

# Frontend
cd frontend && npm run dev

# Frontend tests
cd frontend && npm run test:run   # single run
cd frontend && npm test           # watch mode

# Build check
cd backend && go build ./...
cd frontend && npm run build
```

## Key conventions

### Backend
- All WebSocket message types are defined in `internal/ws/messages.go` — add new message types there first
- Name validation lives in `internal/ws/handler.go` (`validateName`) — rules must match the frontend
- The `game.Manager` owns room lifecycle; `ws.Handler` owns connection lifecycle

### Frontend
- All WebSocket state flows through `src/store/gameStore.ts` — components read from the store, never manage WS directly
- UI components use shadcn/ui from `src/components/ui/` — add new shadcn components with `npx shadcn@latest add <name>`
- Tailwind colors: the theme primary is blue (`--primary: 221 83% 53%`); titles use `text-blue-500` explicitly
- Validation rules (name: 2–24 chars, `[a-zA-Z0-9 '_\-.]`) must stay in sync with the backend

### Testing
- Test files live alongside the component: `Foo.tsx` → `Foo.test.tsx`
- Mock the game store with `vi.mock('../store/gameStore')` using a selector-compatible mock — see `Home.test.tsx`
- Wrap routed components in `<MemoryRouter>` from react-router-dom
- See `TESTING.md` for the full guide

## WebSocket message flow

| Direction | Type | Description |
|-----------|------|-------------|
| Client → Server | `create_room` | Create a new room |
| Client → Server | `join_room` | Join by room code |
| Client → Server | `start_game` | Host starts the game |
| Client → Server | `claim` | Player claims a symbol |
| Server → Client | `room_joined` | Confirmation with room + player info |
| Server → Client | `player_joined` | Another player joined |
| Server → Client | `player_left` | A player disconnected |
| Server → Client | `game_started` | Cards dealt, game begins |
| Server → Client | `claim_result` | Outcome of a claim attempt |
| Server → Client | `game_over` | Final scores and winner |
