import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import ChatPanel from '../components/game/ChatPanel'
import { useGameStore } from '../store/gameStore'
import type { GameStore } from '../store/gameStore'
import type { ChatEntry } from '../types/game'

vi.mock('../store/gameStore')

const mockSendChat = vi.fn()

function makeStore(overrides: Partial<{ chatMessages: ChatEntry[]; sendChat: typeof mockSendChat; playerId: string }> = {}) {
  return {
    chatMessages: [] as ChatEntry[],
    sendChat: mockSendChat,
    playerId: 'p1',
    ...overrides,
  }
}

function setup(overrides = {}) {
  const store = makeStore(overrides)
  vi.mocked(useGameStore).mockImplementation(
    (selector: (s: GameStore) => unknown) => selector(store as unknown as GameStore)
  )
  const user = userEvent.setup()
  render(<ChatPanel />)
  return { user, store }
}

beforeEach(() => {
  mockSendChat.mockClear()
  // jsdom doesn't implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn()
})

describe('ChatPanel', () => {
  it('shows empty state when there are no messages', () => {
    setup()
    expect(screen.getByText('No messages yet')).toBeInTheDocument()
  })

  it('renders a status message', () => {
    const messages: ChatEntry[] = [
      { id: '1', kind: 'status', text: 'Alice joined', timestamp: 0 },
    ]
    setup({ chatMessages: messages })
    expect(screen.getByText('Alice joined')).toBeInTheDocument()
  })

  it('renders a chat message from another player', () => {
    const messages: ChatEntry[] = [
      { id: '1', kind: 'chat', text: 'Hello!', senderName: 'Bob', senderId: 'p2', timestamp: 0 },
    ]
    setup({ chatMessages: messages })
    expect(screen.getByText('Hello!')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('labels own messages as "You"', () => {
    const messages: ChatEntry[] = [
      { id: '1', kind: 'chat', text: 'My message', senderName: 'Alice', senderId: 'p1', timestamp: 0 },
    ]
    setup({ chatMessages: messages, playerId: 'p1' })
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('disables Send button when input is empty', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('enables Send button when input has text', async () => {
    const { user } = setup()
    await user.type(screen.getByPlaceholderText('Say something...'), 'hi')
    expect(screen.getByRole('button', { name: 'Send' })).not.toBeDisabled()
  })

  it('calls sendChat and clears input on Send click', async () => {
    const { user } = setup()
    await user.type(screen.getByPlaceholderText('Say something...'), 'hello')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(mockSendChat).toHaveBeenCalledWith('hello')
    expect(screen.getByPlaceholderText('Say something...')).toHaveValue('')
  })

  it('calls sendChat on Enter key press', async () => {
    const { user } = setup()
    await user.type(screen.getByPlaceholderText('Say something...'), 'hello{Enter}')
    expect(mockSendChat).toHaveBeenCalledWith('hello')
  })

  it('does not call sendChat for whitespace-only input', async () => {
    const { user } = setup()
    await user.type(screen.getByPlaceholderText('Say something...'), '   {Enter}')
    expect(mockSendChat).not.toHaveBeenCalled()
  })

  it('shows elapsed time for correct claim status messages', () => {
    const messages: ChatEntry[] = [
      { id: '1', kind: 'status', text: 'Bob got it! +1', timestamp: 0, claimElapsedMs: 2340 },
    ]
    setup({ chatMessages: messages })
    expect(screen.getByText(/2\.34s/)).toBeInTheDocument()
  })
})
