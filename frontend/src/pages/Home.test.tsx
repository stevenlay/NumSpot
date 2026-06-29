import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Home from './Home'
import { useGameStore } from '../store/gameStore'
import type { GameStore } from '../store/gameStore'

vi.mock('../store/gameStore')

const mockConnect = vi.fn()
const mockResetError = vi.fn()

function makeStore(overrides = {}) {
  return {
    phase: 'home',
    name: '',
    error: null,
    disconnected: false,
    connect: mockConnect,
    resetError: mockResetError,
    ...overrides,
  }
}

function setup(overrides = {}) {
  const store = makeStore(overrides)
  vi.mocked(useGameStore).mockImplementation(
    (selector: (s: GameStore) => unknown) => selector(store as unknown as GameStore)
  )
  const user = userEvent.setup()
  render(<MemoryRouter><Home /></MemoryRouter>)
  return { user, store }
}

beforeEach(() => {
  mockConnect.mockClear()
  mockResetError.mockClear()
})


describe('Home page', () => {
  it('renders title and slogan', () => {
    setup()
    expect(screen.getByText('NumSpot')).toBeInTheDocument()
    expect(screen.getByText('spot the number. win the round.')).toBeInTheDocument()
  })

  it('shows Create Room tab as default', () => {
    setup()
    expect(screen.getByRole('tab', { name: 'Create Room' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByRole('tab', { name: 'Join Room' })).toHaveAttribute('data-state', 'inactive')
  })

  it('shows room code input when Join Room tab is selected', async () => {
    const { user } = setup()
    expect(screen.queryByLabelText('Room Code')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Join Room' }))
    expect(screen.getByLabelText('Room Code')).toBeInTheDocument()
  })

  describe('name validation', () => {
    it('shows error when name is empty', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('button', { name: 'Create & Enter Lobby' }))
      expect(screen.getByText('Please enter your name.')).toBeInTheDocument()
      expect(mockConnect).not.toHaveBeenCalled()
    })

    it('shows error when name is too short', async () => {
      const { user } = setup()
      await user.type(screen.getByLabelText('Your Name'), 'a')
      await user.click(screen.getByRole('button', { name: 'Create & Enter Lobby' }))
      expect(screen.getByText('Name must be at least 2 characters.')).toBeInTheDocument()
      expect(mockConnect).not.toHaveBeenCalled()
    })

    it('shows error when name contains invalid characters', async () => {
      const { user } = setup()
      await user.type(screen.getByLabelText('Your Name'), 'abc<>')
      await user.click(screen.getByRole('button', { name: 'Create & Enter Lobby' }))
      expect(screen.getByText("Name can only contain letters, numbers, spaces, and - _ ' .")).toBeInTheDocument()
      expect(mockConnect).not.toHaveBeenCalled()
    })

    it('clears name error when user starts typing', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('button', { name: 'Create & Enter Lobby' }))
      expect(screen.getByText('Please enter your name.')).toBeInTheDocument()
      await user.type(screen.getByLabelText('Your Name'), 'a')
      expect(screen.queryByText('Please enter your name.')).not.toBeInTheDocument()
    })
  })

  describe('room code validation', () => {
    it('shows error when room code is empty on join', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('tab', { name: 'Join Room' }))
      await user.type(screen.getByLabelText('Your Name'), 'Alice')
      await user.click(screen.getByRole('button', { name: 'Enter Room' }))
      expect(screen.getByText('Please enter a room code.')).toBeInTheDocument()
      expect(mockConnect).not.toHaveBeenCalled()
    })
  })

  describe('form submission', () => {
    it('calls connect with name only when creating a room', async () => {
      const { user } = setup()
      await user.type(screen.getByLabelText('Your Name'), 'Alice')
      await user.click(screen.getByRole('button', { name: 'Create & Enter Lobby' }))
      expect(mockConnect).toHaveBeenCalledWith('Alice')
    })

    it('calls connect with name and room code when joining', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('tab', { name: 'Join Room' }))
      await user.type(screen.getByLabelText('Your Name'), 'Alice')
      await user.type(screen.getByLabelText('Room Code'), 'abc123')
      await user.click(screen.getByRole('button', { name: 'Enter Room' }))
      expect(mockConnect).toHaveBeenCalledWith('Alice', 'ABC123')
    })
  })

  it('displays server error from store', () => {
    setup({ error: 'room not found' })
    expect(screen.getByText('room not found')).toBeInTheDocument()
  })
})
