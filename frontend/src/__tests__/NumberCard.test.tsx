import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import NumberCard from '../components/game/NumberCard'

describe('NumberCard', () => {
  it('renders all numbers as buttons', () => {
    render(<NumberCard numbers={[1, 7, 23, 45]} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
  })

  it('shows label when provided', () => {
    render(<NumberCard numbers={[1]} label="Center Card" />)
    expect(screen.getByText('Center Card')).toBeInTheDocument()
  })

  it('omits label when not provided', () => {
    render(<NumberCard numbers={[1]} />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('calls onClaim with the clicked number when clickable', async () => {
    const onClaim = vi.fn()
    const user = userEvent.setup()
    render(<NumberCard numbers={[4, 9, 15]} onClaim={onClaim} clickable />)
    await user.click(screen.getByText('9'))
    expect(onClaim).toHaveBeenCalledWith(9)
    expect(onClaim).toHaveBeenCalledTimes(1)
  })

  it('does not call onClaim when clickable is false', async () => {
    const onClaim = vi.fn()
    const user = userEvent.setup()
    render(<NumberCard numbers={[4, 9]} onClaim={onClaim} clickable={false} />)
    await user.click(screen.getByText('9'))
    expect(onClaim).not.toHaveBeenCalled()
  })

  it('highlights the specified number', () => {
    render(<NumberCard numbers={[3, 7, 11]} highlightNumber={7} />)
    const highlighted = screen.getByText('7')
    expect(highlighted.className).toContain('bg-green-400')
  })

  it('does not highlight other numbers', () => {
    render(<NumberCard numbers={[3, 7, 11]} highlightNumber={7} />)
    const notHighlighted = screen.getByText('3')
    expect(notHighlighted.className).not.toContain('bg-green-400')
  })

  it('renders an empty grid when numbers array is empty', () => {
    render(<NumberCard numbers={[]} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
