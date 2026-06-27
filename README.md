# Numspot

A real-time multiplayer card-matching game. Players race to spot the one symbol shared between their card and the center card.

## How to play

1. One player creates a room and shares the room code.
2. Other players join using that code (up to 8 players per room).
3. The host starts the game. Each player gets a card; a center card is shown to everyone.
4. Each card shares exactly one symbol with the center card. First to claim the correct symbol wins the round and scores a point.
5. The game ends when the deck runs out. Highest score wins.

## Local development

### Prerequisites

- Go 1.22+
- Node.js 24+

### Backend (Go / Gin — port 8080)

```powershell
cd backend
go run ./cmd/server
```

### Frontend (React / Vite — port 5173)

```powershell
cd frontend
npm install   # first time only
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/ws` to the backend automatically.

## Architecture

```
numspot/
├── backend/
│   ├── cmd/server/       # Entry point
│   └── internal/
│       ├── game/         # Room, player, card logic
│       └── ws/           # WebSocket handler and message types
└── frontend/
    └── src/
        ├── pages/        # Home, Lobby, Game
        ├── components/   # NumberCard, Scoreboard
        └── hooks/        # useWebSocket
```

### WebSocket message flow

| Direction       | Type            | Description                          |
|-----------------|-----------------|--------------------------------------|
| Client → Server | `create_room`   | Create a new room                    |
| Client → Server | `join_room`     | Join by room code                    |
| Client → Server | `start_game`    | Host starts the game                 |
| Client → Server | `claim`         | Player claims a symbol               |
| Server → Client | `room_joined`   | Confirmation with room + player info |
| Server → Client | `player_joined` | Another player joined                |
| Server → Client | `player_left`   | A player disconnected                |
| Server → Client | `game_started`  | Cards dealt, game begins             |
| Server → Client | `claim_result`  | Outcome of a claim attempt           |
| Server → Client | `game_over`     | Final scores and winner              |

## Testing

See [TESTING.md](./TESTING.md) for the full guide.

```powershell
cd frontend
npm run test:run
```

## Deployment

Docker Compose and Kubernetes manifests are in the repo root (`docker-compose.yml`, `k8s/`).

```powershell
docker compose up --build
```
