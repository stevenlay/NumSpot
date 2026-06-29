import { render, screen, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Scoreboard from '../components/game/Scoreboard'
import type { Player } from '../types/game'

function makePlayer(id: string, name: string, score: number, cards_left = 0): Player {
  return { id, name, score, session_score: 0, cards_left, card: [] }
}

describe('Scoreboard', () => {
  const players = [
    makePlayer('p1', 'Alice', 3),
    makePlayer('p2', 'Bob', 5),
    makePlayer('p3', 'Carol', 1),
  ]

  describe('horizontal layout (default)', () => {
    it('renders all players', () => {
      render(<Scoreboard players={players} currentPlayerId="p99" />)
      expect(screen.getByText(/Alice/)).toBeInTheDocument()
      expect(screen.getByText(/Bob/)).toBeInTheDocument()
      expect(screen.getByText(/Carol/)).toBeInTheDocument()
    })

    it('marks the current player with (you)', () => {
      render(<Scoreboard players={players} currentPlayerId="p1" />)
      expect(screen.getByText(/Alice.*\(you\)/)).toBeInTheDocument()
      expect(screen.queryByText(/Bob.*\(you\)/)).not.toBeInTheDocument()
    })

    it('renders rank numbers in order', () => {
      render(<Scoreboard players={players} currentPlayerId="p99" />)
      // Bob has highest score so rank 1, Alice rank 2, Carol rank 3
      const ranks = screen.getAllByText(/^\d+\.$/)
      expect(ranks[0].textContent).toBe('1.')
      expect(ranks[1].textContent).toBe('2.')
      expect(ranks[2].textContent).toBe('3.')
    })

    it('renders empty scoreboard with no players', () => {
      render(<Scoreboard players={[]} currentPlayerId="p1" />)
      expect(screen.queryByText('(you)')).not.toBeInTheDocument()
    })
  })

  describe('vertical layout', () => {
    it('renders all players with scores', () => {
      render(<Scoreboard players={players} currentPlayerId="p1" layout="vertical" />)
      expect(screen.getByText(/Alice.*\(you\)/)).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('shows cards_left count', () => {
      const withCards = [makePlayer('p1', 'Alice', 3, 4)]
      render(<Scoreboard players={withCards} currentPlayerId="p1" layout="vertical" />)
      expect(screen.getByText('5 left')).toBeInTheDocument()
    })

    it('renders Scores heading', () => {
      render(<Scoreboard players={players} currentPlayerId="p1" layout="vertical" />)
      expect(screen.getByText('Scores')).toBeInTheDocument()
    })
  })
})
