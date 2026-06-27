import { useGameStore } from '../store/gameStore'

// This hook exposes a simple interface to the WebSocket managed by the store.
export function useWebSocket() {
  const connected = useGameStore((s) => s.connected)
  const ws = useGameStore((s) => s._ws)

  const send = (msg: object) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  return { connected, send }
}
