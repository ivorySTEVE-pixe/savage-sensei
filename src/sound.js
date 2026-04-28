/* Generated audio via Web Audio API — no binary assets.
   Linear-switch keyboard click (Cherry MX Red feel): no tactile bump,
   no high-frequency snap. Just the smooth bottom-out — a low "thock"
   layered with a low-mid plastic clack. Brief, mellow, percussive. */

let ctx = null

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
  return ctx
}

/* Pre-build a static noise buffer once and reuse for every click. */
let noiseBuf = null
function getNoiseBuf(c) {
  if (noiseBuf) return noiseBuf
  const len = Math.floor(c.sampleRate * 0.04)  // 40 ms
  const b = c.createBuffer(1, len, c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < len; i++) {
    /* sharper falloff than the brown variant — linear hits and dies. */
    const env = Math.pow(1 - i / len, 2.4)
    d[i] = (Math.random() * 2 - 1) * env
  }
  noiseBuf = b
  return b
}

export function playClick() {
  const c = getCtx()
  if (!c) return
  const now = c.currentTime

  /* (1) Plastic clack — short low-pass-filtered noise burst (case impact).
     Linear switches don't snap, so we keep this dull and brief, with the
     content centered under ~1.5 kHz instead of the brown's ~2.4 kHz. */
  const noise = c.createBufferSource()
  noise.buffer = getNoiseBuf(c)

  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1500
  lp.Q.value = 0.5

  const clackGain = c.createGain()
  clackGain.gain.setValueAtTime(0.0001, now)
  clackGain.gain.exponentialRampToValueAtTime(0.085, now + 0.0015)
  clackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025)

  noise.connect(lp).connect(clackGain).connect(c.destination)
  noise.start(now)

  /* (2) Bottom-out thock — heavier than brown, since on a linear it's
     the dominant sound. Sine sweep from 165 → 65 Hz over 70 ms. */
  const thock = c.createOscillator()
  thock.type = 'sine'
  thock.frequency.setValueAtTime(165, now)
  thock.frequency.exponentialRampToValueAtTime(65, now + 0.06)

  const thockGain = c.createGain()
  thockGain.gain.setValueAtTime(0.0001, now)
  thockGain.gain.exponentialRampToValueAtTime(0.18, now + 0.004)
  thockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)

  thock.connect(thockGain).connect(c.destination)
  thock.start(now)
  thock.stop(now + 0.1)
}
