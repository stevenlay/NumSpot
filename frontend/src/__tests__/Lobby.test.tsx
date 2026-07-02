import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Lobby from '../pages/Lobby'
import { useGameStore } from '../store/gameStore'
import type { GameStore } from '../store/gameStore'
import type { Player, Spectator, RoomSettings } from '../types/game'

vi.mock('../store/gameStore')

// Stub GameShell so we only test Lobby's own content
vi.mock('../components/game/GameShell', () => ({
  default: ({ children, sidebarContent, centerBanner }: {
    children: React.ReactNode
    sidebarContent: React.ReactNode
    centerBanner?: React.ReactNode
  }) => (
    <div>
      {centerBanner}
      <div data-testid="sidebar">{sidebarContent}</div>
      {children}
    </div>
  ),
}))

const mockStartGame = vi.fn()
const mockUpdateSettings = vi.fn()
const mockJoinAsPlayer = vi.fn()
const mockGoHome = vi.fn()
const mockResetError = vi.fn()

const DEFAULT_SETTINGS: RoomSettings = {
  max_players: 8,
  deck_size: 57,
  wrong_claim_penalty_ms: 1500,
  wrong_claim_point_penalty: 0,
  correct_claim_lock_ms: 2000,
  rounds: 1,
  hint_delay_ms: 6000,
}

function makePlayer(id: string, name: string, score = 0): Player {
  return { id, name, score, session_score: 0, card: [] }
}

function makeStore(overrides = {}) {
  return {
    phase: 'lobby',
    roomCode: 'ABC123',
    players: [] as Player[],
    spectators: [] as Spectator[],
    isHost: false,
    isSpectator: false,
    playerId: 'p1',
    settings: DEFAULT_SETTINGS,
    startGame: mockStartGame,
    updateSettings: mockUpdateSettings,
    joinAsPlayer: mockJoinAsPlayer,
    goHome: mockGoHome,
    disconnected: false,
    error: null,
    resetError: mockResetError,
    gameOverToast: null,
    currentRound: 0,
    ...overrides,
  }
}

function setup(overrides = {}) {
  const store = makeStore(overrides)
  vi.mocked(useGameStore).mockImplementation(
    (selector: (s: GameStore) => unknown) => selector(store as unknown as GameStore)
  )
  const user = userEvent.setup()
  render(<MemoryRouter><Lobby /></MemoryRouter>)
  return { user }
}

beforeEach(() => {
  mockStartGame.mockClear()
  mockUpdateSettings.mockClear()
  mockJoinAsPlayer.mockClear()
  mockGoHome.mockClear()
  mockResetError.mockClear()
})

describe('Lobby', () => {
  describe('player list', () => {
    it('shows players in the sidebar', () => {
      setup({ players: [makePlayer('p1', 'Alice'), makePlayer('p2', 'Bob')] })
      const sidebar = screen.getByTestId('sidebar')
      expect(sidebar).toHaveTextContent('Alice')
      expect(sidebar).toHaveTextContent('Bob')
    })

    it('marks current player with (you)', () => {
      setup({ players: [makePlayer('p1', 'Alice'), makePlayer('p2', 'Bob')], playerId: 'p1' })
      expect(screen.getAllByText(/Alice.*\(you\)/)[0]).toBeInTheDocument()
    })

    it('shows spectators section when spectators exist', () => {
      const spectators: Spectator[] = [{ id: 's1', name: 'Watcher' }]
      setup({ spectators })
      expect(screen.getAllByText('Watcher')[0]).toBeInTheDocument()
    })
  })

  describe('host controls', () => {
    it('shows an enabled Start Game button for the host', () => {
      setup({ isHost: true })
      expect(screen.getByRole('button', { name: 'Start Game' })).not.toBeDisabled()
    })

    it('calls startGame when host clicks Start Game', async () => {
      const { user } = setup({ isHost: true })
      await user.click(screen.getByRole('button', { name: 'Start Game' }))
      expect(mockStartGame).toHaveBeenCalledTimes(1)
    })

    it('disables Start Game for non-hosts', () => {
      setup({ isHost: false })
      expect(screen.getByRole('button', { name: 'Start Game' })).toBeDisabled()
    })

    it('shows "Waiting for host" message for non-hosts', () => {
      setup({ isHost: false })
      expect(screen.getByText(/Waiting for the host/)).toBeInTheDocument()
    })

    it('shows setting controls only for the host', () => {
      setup({ isHost: true })
      // Max players buttons (2–8) should be present for host
      expect(screen.getByRole('button', { name: '8' })).toBeInTheDocument()
    })

    it('does not show setting controls for non-hosts', () => {
      setup({ isHost: false })
      // Without host controls, individual preset buttons are absent
      expect(screen.queryByRole('button', { name: 'Normal' })).not.toBeInTheDocument()
    })
  })

  describe('spectator mode', () => {
    it('shows Join as Player button for spectators', () => {
      setup({ isSpectator: true })
      expect(screen.getByRole('button', { name: 'Join as Player' })).toBeInTheDocument()
    })

    it('calls joinAsPlayer when spectator clicks the button', async () => {
      const { user } = setup({ isSpectator: true })
      await user.click(screen.getByRole('button', { name: 'Join as Player' }))
      expect(mockJoinAsPlayer).toHaveBeenCalledTimes(1)
    })

    it('disables Join as Player when room is full', () => {
      const players = Array.from({ length: 8 }, (_, i) => makePlayer(`p${i}`, `Player${i}`))
      setup({ isSpectator: true, players, settings: { ...DEFAULT_SETTINGS, max_players: 8 } })
      expect(screen.getByRole('button', { name: 'Join as Player' })).toBeDisabled()
    })
  })

  describe('redirect', () => {
    it('redirects to /game when phase is playing', () => {
      setup({ phase: 'playing' })
      // Navigate rendered — lobby main content should not appear
      expect(screen.queryByRole('button', { name: 'Start Game' })).not.toBeInTheDocument()
    })
  })

  describe('alerts', () => {
    it('shows disconnected alert with Return Home button', () => {
      setup({ disconnected: true })
      expect(screen.getByText('Connection lost.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Return Home' })).toBeInTheDocument()
    })

    it('calls goHome when Return Home is clicked', async () => {
      const { user } = setup({ disconnected: true })
      await user.click(screen.getByRole('button', { name: 'Return Home' }))
      expect(mockGoHome).toHaveBeenCalledTimes(1)
    })

    it('shows error alert with Dismiss button', () => {
      setup({ error: 'room is full' })
      expect(screen.getByText('room is full')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
    })

    it('calls resetError when Dismiss is clicked', async () => {
      const { user } = setup({ error: 'something went wrong' })
      await user.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(mockResetError).toHaveBeenCalledTimes(1)
    })

    it('does not show error alert when disconnected (disconnected takes precedence)', () => {
      setup({ disconnected: true, error: 'some error' })
      expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
    })
  })

  describe('game over toast', () => {
    it('shows winner name when game just ended', () => {
      const winner = makePlayer('p2', 'Bob', 5)
      const players = [makePlayer('p1', 'Alice', 3), winner]
      setup({ gameOverToast: { winner, players, currentRound: 1, totalRounds: 1 }, playerId: 'p1' })
      expect(screen.getByText('Bob wins!')).toBeInTheDocument()
    })

    it('shows "You won!" when current player is the winner', () => {
      const winner = makePlayer('p1', 'Alice', 5)
      const players = [winner, makePlayer('p2', 'Bob', 2)]
      setup({ gameOverToast: { winner, players, currentRound: 1, totalRounds: 1 }, playerId: 'p1' })
      expect(screen.getByText('You won!')).toBeInTheDocument()
    })

    it('shows top 3 scores sorted by score', () => {
      const players = [
        makePlayer('p1', 'Alice', 5),
        makePlayer('p2', 'Bob', 3),
        makePlayer('p3', 'Carol', 7),
      ]
      setup({ gameOverToast: { winner: players[2], players, currentRound: 1, totalRounds: 1 }, playerId: 'p99' })
      const items = screen.getAllByText(/pts$/)
      // Carol(7), Alice(5), Bob(3)
      expect(items[0].textContent).toBe('7 pts')
      expect(items[1].textContent).toBe('5 pts')
      expect(items[2].textContent).toBe('3 pts')
    })
  })
})
