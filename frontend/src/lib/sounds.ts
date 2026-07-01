let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

export function initAudio() {
  try {
    const ctx = getCtx()
    if (ctx?.state === 'suspended') ctx.resume()
  } catch { /* audio not available */ }
}

export function playCorrect(isSelf: boolean) {
  try {
    const ctx = getCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    if (isSelf) {
      osc.frequency.setValueAtTime(660, ctx.currentTime)
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.28, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    } else {
      osc.frequency.setValueAtTime(660, ctx.currentTime)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    }
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  } catch { /* audio not available */ }
}

export function playWrong() {
  try {
    const ctx = getCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(220, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(130, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch { /* audio not available */ }
}
