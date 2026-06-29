import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BotSpeed } from '../components/dev/BotPlayer'

interface DevStore {
  skipCountdown: boolean
  deckSize: number
  highlightAnswer: boolean
  botSpeed: BotSpeed
  wrongClaimPenaltyMs: number
  correctClaimLockMs: number
  setSkipCountdown: (v: boolean) => void
  setDeckSize: (v: number) => void
  setHighlightAnswer: (v: boolean) => void
  setBotSpeed: (v: BotSpeed) => void
  setWrongClaimPenaltyMs: (v: number) => void
  setCorrectClaimLockMs: (v: number) => void
}

export const useDevStore = create<DevStore>()(
  persist(
    (set) => ({
      skipCountdown: false,
      deckSize: 57,
      highlightAnswer: false,
      botSpeed: 'medium',
      wrongClaimPenaltyMs: 1500,
      correctClaimLockMs: 2000,
      setSkipCountdown: (v) => set({ skipCountdown: v }),
      setDeckSize: (v) => set({ deckSize: v }),
      setHighlightAnswer: (v) => set({ highlightAnswer: v }),
      setBotSpeed: (v) => set({ botSpeed: v }),
      setWrongClaimPenaltyMs: (v) => set({ wrongClaimPenaltyMs: v }),
      setCorrectClaimLockMs: (v) => set({ correctClaimLockMs: v }),
    }),
    { name: 'numspot-dev' }
  )
)
