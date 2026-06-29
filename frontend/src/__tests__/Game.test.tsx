import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Game from '../pages/Game'
import { useGameStore } from '../store/gameStore'
import { useDevStore } from '../store/devStore'
import type { GameStore } from '../store/gameStore'
import type { DevStore } from '../store/devStore'
import type { Player, Spectator, RoomSettings } from '../types/game'

vi.mock('../store/gameStore')
vi.mock('../store/devStore')

// Stub child components so Game rendering doesn't depend on their internals
vi.mock('../components/game/NumberCard', () => ({
  default: ({ numbers, onClaim, clickable, label }: {
    numbers: number[]
    onClaim?: (n: number) => void
    clickable?: boolean
    label?: string
  }) => (
    <div data-testid="number-card">
      {label && <span>{label}</span>}
      {numbers.map((n) => (
        <button key={n} onClick={() => clickable && onClaim?.(n)} disabled={!clickable}>
          {n}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('../components/game/Scoreboard', () => ({
  default: () => <div data-testid="scoreboard" />,
}))

vi.mock('../components/game/ChatPanel', () => ({
  default: () => <div data-testid="chat-panel" />,
}))

const mockClaim = vi.fn()
const mockGoHome = vi.fn()
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const DEFAULT_SETTINGS: RoomSettings = {
  max_players: 8,
  deck_size: 57,
  wrong_claim_penalty_ms: 1500,
  correct_claim_lock_ms: 2000,
}

function makePlayer(id: string, name: string, card: number[] = []): Player {
  return { id, name, score: 0, session_score: 0, cards_left: 5, card }
}

function makeStore(overrides = {}) {
  return {
    phase: 'playing',
    playerId: 'p1',
    // Use numbers >10 to avoid collision with countdown values (0–3) and cards_left+1 (6)
    players: [makePlayer('p1', 'Alice', [11, 22, 33])],
    centerCard: [14, 25, 36],
    lastClaim: null,
    deckSize: 5,
    countdown: null,
    roomCode: 'ABC123',
    spectators: [] as Spectator[],
    claim: mockClaim,
    goHome: mockGoHome,
    isSpectator: false,
    settings: DEFAULT_SETTINGS,
    disconnected: false,
    ...overrides,
  }
}

function setup(storeOverrides = {}) {
  const store = makeStore(storeOverrides)
  vi.mocked(useGameStore).mockImplementation(
    (selector: (s: GameStore) => unknown) => selector(store as unknown as GameStore)
  )
  vi.mocked(useDevStore).mockImplementation(
    (selector: (s: DevStore) => unknown) =>
      selector({ highlightAnswer: false, skipCountdown: false, botSpeed: 'medium', setSkipCountdown: () => {}, setHighlightAnswer: () => {}, setBotSpeed: () => {} } as DevStore)
  )
  const user = userEvent.setup()
  render(<MemoryRouter><Game /></MemoryRouter>)
  return { user }
}

beforeEach(() => {
  mockClaim.mockClear()
  mockGoHome.mockClear()
  mockNavigate.mockClear()
})

describe('Game', () => {
  describe('navigation', () => {
    it('navigates to / when phase is home', () => {
      setup({ phase: 'home' })
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    })

    it('navigates to /lobby when phase is lobby', () => {
      setup({ phase: 'lobby' })
      expect(mockNavigate).toHaveBeenCalledWith('/lobby', { replace: true })
    })

    it('does not navigate when phase is playing', () => {
      setup({ phase: 'playing' })
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe('countdown overlay', () => {
    it('shows countdown number when countdown is active', () => {
      setup({ countdown: 3 })
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('shows "Go!" when countdown reaches 0', () => {
      setup({ countdown: 0 })
      expect(screen.getByText('Go!')).toBeInTheDocument()
    })

    it('does not show countdown overlay when countdown is null', () => {
      setup({ countdown: null })
      expect(screen.queryByText('Go!')).not.toBeInTheDocument()
      expect(screen.queryByText('3')).not.toBeInTheDocument()
    })
  })

  describe('game UI', () => {
    it('renders center card and player card', () => {
      setup()
      const cards = screen.getAllByTestId('number-card')
      expect(cards).toHaveLength(2)
    })

    it('shows cards remaining', () => {
      setup()
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('cards left in your deck')).toBeInTheDocument()
    })

    it('shows the room code', () => {
      setup()
      // Room code appears in both mobile header button and desktop sidebar
      expect(screen.getAllByText('ABC123').length).toBeGreaterThan(0)
    })

    it('renders the scoreboard and chat panel', () => {
      setup()
      expect(screen.getByTestId('scoreboard')).toBeInTheDocument()
      expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    })
  })

  describe('claiming', () => {
    it('calls claim with the number when player taps their card', async () => {
      const { user } = setup({
        players: [makePlayer('p1', 'Alice', [11, 22, 33])],
        countdown: null,
        lastClaim: null,
      })
      // Player card buttons are enabled (clickable=true passed to NumberCard mock)
      const yourCard = screen.getAllByTestId('number-card')[1]
      await user.click(yourCard.querySelector('button')!)
      expect(mockClaim).toHaveBeenCalledTimes(1)
    })

    it('shows Leave button that calls goHome', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('button', { name: 'Leave' }))
      expect(mockGoHome).toHaveBeenCalledTimes(1)
    })
  })

  describe('spectator mode', () => {
    it('shows spectating badge for spectators', () => {
      setup({ isSpectator: true })
      expect(screen.getByText('Spectating')).toBeInTheDocument()
    })

    it('shows spectator message instead of player card', () => {
      setup({ isSpectator: true })
      expect(screen.getByText(/You are spectating/)).toBeInTheDocument()
    })

    it('does not show how-to-play banner for spectators', () => {
      setup({ isSpectator: true })
      expect(screen.queryByText(/Find the one number/)).not.toBeInTheDocument()
    })
  })

  describe('disconnected state', () => {
    it('shows disconnected alert with Return Home button', () => {
      setup({ disconnected: true })
      expect(screen.getByText(/Connection lost/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Return Home' })).toBeInTheDocument()
    })

    it('calls goHome when Return Home is clicked', async () => {
      const { user } = setup({ disconnected: true })
      await user.click(screen.getByRole('button', { name: 'Return Home' }))
      expect(mockGoHome).toHaveBeenCalledTimes(1)
    })
  })
})
