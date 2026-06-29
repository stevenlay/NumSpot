import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BotSpeed } from '../components/dev/BotPlayer'

export interface DevStore {
  skipCountdown: boolean
  highlightAnswer: boolean
  botSpeed: BotSpeed
  setSkipCountdown: (v: boolean) => void
  setHighlightAnswer: (v: boolean) => void
  setBotSpeed: (v: BotSpeed) => void
}

export const useDevStore = create<DevStore>()(
  persist(
    (set) => ({
      skipCountdown: false,
      highlightAnswer: false,
      botSpeed: 'medium',
      setSkipCountdown: (v) => set({ skipCountdown: v }),
      setHighlightAnswer: (v) => set({ highlightAnswer: v }),
      setBotSpeed: (v) => set({ botSpeed: v }),
    }),
    { name: 'numspot-dev' }
  )
)
