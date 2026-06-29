# NumSpot

A real-time multiplayer number-spotting game. Players race to find the one number shared between their card and the center card.

## How to play

1. One player creates a room and shares the room code.
2. Up to 8 players join using that code. Late joiners (or players who join a full room) enter as spectators and can convert to a player when a slot opens.
3. The host configures settings and starts the game. Each player gets their own private card; a center card is shown to everyone.
4. Each card shares exactly one number with the center card. First to tap the correct number wins the round and scores a point.
5. The game ends when all cards are played. Highest score wins. The host can restart for another round — session scores accumulate across games.

## Features

- **Lobby** — Room code sharing, live player list, spectator list, and host-only settings panel
- **Spectators** — Join any room at any time; watch from the sidelines and jump in when a slot opens
- **Host settings** — Max players (2–8), deck size (5–57 cards), wrong-claim penalty duration, correct-claim lock duration
- **Chat** — Live chat for players and spectators in both lobby and game
- **Session scores** — Cumulative scores shown in the lobby between rounds
- **Claim feedback** — Animated penalty bar on a missed claim; lock-out cooldown after a correct claim

## Local development

### Prerequisites

- Go 1.22+
- Node.js 24+

### Backend (Go / Gin — port 8080)

```bash
cd backend
go run ./cmd/server
```

### Frontend (React / Vite — port 5173)

```bash
cd frontend
npm install   # first time only
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/ws` to the backend automatically.

## Architecture

```
numspot/
├── backend/
│   ├── cmd/server/       # Entry point (main.go)
│   └── internal/
│       ├── game/         # Room, player, card logic (manager.go, room.go, card.go)
│       └── ws/           # WebSocket handler, message types, client pump (handler.go, client.go, messages.go)
└── frontend/
    └── src/
        ├── pages/        # Home, Lobby, Game
        ├── components/
        │   ├── game/     # NumberCard, Scoreboard, ChatPanel, GameShell
        │   └── ui/       # shadcn/ui components
        ├── store/        # Zustand store (gameStore.ts) — single source of truth
        └── types/        # Shared TypeScript types (game.ts)
```

### WebSocket message flow

| Direction | Type | Description |
|-----------|------|-------------|
| Client → Server | `create_room` | Create a new room |
| Client → Server | `join_room` | Join by room code (spectator if room is full or game is active) |
| Client → Server | `start_game` | Host starts the game |
| Client → Server | `claim` | Player claims a number |
| Client → Server | `restart_game` | Host resets back to lobby |
| Client → Server | `update_settings` | Host changes room settings |
| Client → Server | `join_as_player` | Spectator converts to player |
| Client → Server | `chat_send` | Send a chat message |
| Server → Client | `room_joined` | Confirmation with room, player, and settings info |
| Server → Client | `player_joined` | Another player joined |
| Server → Client | `player_left` | A player disconnected |
| Server → Client | `spectator_joined` | A spectator joined |
| Server → Client | `spectator_left` | A spectator disconnected or converted to player |
| Server → Client | `game_started` | Cards dealt, game begins |
| Server → Client | `claim_result` | Outcome of a claim attempt |
| Server → Client | `game_over` | Final scores and winner |
| Server → Client | `game_reset` | Room returned to lobby after game ends |
| Server → Client | `settings_updated` | Host changed room settings |
| Server → Client | `joined_as_player` | Confirms spectator-to-player conversion |
| Server → Client | `chat_message` | A chat message from a player or spectator |
| Server → Client | `error` | An error message |

## Testing

See [TESTING.md](./TESTING.md) for the full guide.

```bash
# Backend
cd backend
go test ./...

# Frontend
cd frontend
npm run test:run   # single run
npm test           # watch mode
```

## Deployment

Docker Compose and Kubernetes manifests are in the repo root (`docker-compose.yml`, `k8s/`).

```bash
docker compose up --build
```
