import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import Game from './pages/Game'
import { useGameStore } from './store/gameStore'
import DevPanel from './components/dev/DevPanel'

function RequirePhase({ phase, children }: { phase: string | string[]; children: React.ReactNode }) {
  const currentPhase = useGameStore((s) => s.phase)
  const phases = Array.isArray(phase) ? phase : [phase]
  if (!phases.includes(currentPhase)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      {import.meta.env.DEV && <DevPanel />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/lobby"
          element={
            <RequirePhase phase={['lobby', 'playing', 'finished']}>
              <Lobby />
            </RequirePhase>
          }
        />
        <Route
          path="/game"
          element={
            <RequirePhase phase={['playing', 'lobby']}>
              <Game />
            </RequirePhase>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
