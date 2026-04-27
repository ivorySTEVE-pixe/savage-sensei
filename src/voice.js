/**
 * Voice helpers.
 *
 * Primary path:  Gemini native TTS (gemini-2.5-flash-preview-tts).
 *                Bilingual voices, much higher quality than browser TTS.
 *                Returns base64 PCM (24kHz mono 16-bit) which we wrap
 *                in WAV headers and play via <Audio>.
 * Fallback path: Browser Web Speech API. Used when Gemini TTS errors
 *                or when the SDK doesn't support it.
 *
 * Speech recognition (user → text) always uses the browser API.
 */

/* ─── GEMINI VOICE MAPPING ───────────────────────────────────────── */
/* Each personality picks a Gemini prebuilt voice that fits its vibe.
   Voices are bilingual (24 languages incl. Japanese) so we don't need
   per-language entries — same voice handles EN + JP cleanly. */
export const GEMINI_VOICES = {
  demonCoach:  'Algenib',   // gravelly, mature male — drill sergeant bark
  osakaAuntie: 'Sulafat',   // warm, mature female — auntie warmth
  techBro:     'Puck',      // upbeat, energetic male — chipper bro
}

/* ─── STYLE PROMPTS (huge quality lift) ──────────────────────────── */
/* Gemini TTS understands natural-language style instructions prepended
   to the text. These dramatically improve delivery — emotion, pacing,
   accent. The prefix is invisible to the listener; only the bracketed
   text after the colon gets read. */
export const STYLE_PROMPTS = {
  demonCoach: {
    en: 'Say in the loud, gravelly, impatient bark of a Japanese drill-sergeant anime coach — clipped, urgent, no filler:',
    jp: '日本のスポ根アニメに出てくる鬼コーチのように、大声で、低く、命令口調で、せっかちに：',
  },
  osakaAuntie: {
    en: 'Say in the warm, sing-song, gossipy voice of an Osaka auntie — playful nagging, motherly, with bouncy intonation:',
    jp: '関西のおばちゃんのように、温かくて、リズミカルで、ちょっとお節介な口調で、語尾を伸ばしながら：',
  },
  techBro: {
    en: 'Say with the upbeat, over-caffeinated enthusiasm of a Silicon Valley startup bro recording a podcast intro — fast, punchy, all-in:',
    jp: 'シリコンバレーのスタートアップ兄貴がポッドキャストを録音しているような、過剰なテンションで、早口で、ノリノリで：',
  },
}

/* ─── BROWSER FALLBACK PROFILES ──────────────────────────────────── */
/* Same shape as before — used only when Gemini TTS fails. */
export const VOICE_PROFILES = {
  demonCoach: {
    en: {
      patterns: [/Daniel/, /Alex/, /Aaron/, /Fred/, /Bruce/, /Google UK English Male/, /Microsoft.*Male/i],
      lang: 'en-US',
      pitch: 0.65,
      rate: 1.1,
    },
    jp: {
      patterns: [/Otoya/, /Hattori/, /Ichiro/, /Google.*Japanese/i, /Microsoft.*Japanese/i],
      lang: 'ja-JP',
      pitch: 0.7,
      rate: 1.05,
    },
  },
  osakaAuntie: {
    en: {
      patterns: [/Karen/, /Moira/, /Tessa/, /Samantha/, /Veena/, /Google UK English Female/, /Microsoft.*Female/i],
      lang: 'en-US',
      pitch: 1.2,
      rate: 1.05,
    },
    jp: {
      patterns: [/Kyoko/, /O-ren/, /Sayaka/, /Google.*Japanese/i, /Microsoft.*Japanese/i],
      lang: 'ja-JP',
      pitch: 1.15,
      rate: 1.05,
    },
  },
  techBro: {
    en: {
      patterns: [/Aaron/, /Tom/, /Fred/, /Alex/, /Google US English/, /Microsoft.*Male/i],
      lang: 'en-US',
      pitch: 1.0,
      rate: 1.15,
    },
    jp: {
      patterns: [/Otoya/, /Ichiro/, /Google.*Japanese/i, /Microsoft.*Japanese/i],
      lang: 'ja-JP',
      pitch: 1.0,
      rate: 1.15,
    },
  },
}

/* ─── BROWSER SUPPORT ────────────────────────────────────────────── */
export const SR_SUPPORTED =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition)

export const TTS_SUPPORTED =
  typeof window !== 'undefined' &&
  typeof window.speechSynthesis !== 'undefined'

/* ─── VOICE LIST (cached) ────────────────────────────────────────── */
let _voicesCache = null
let _voicesPromise = null

export function loadVoices() {
  if (!TTS_SUPPORTED) return Promise.resolve([])
  if (_voicesCache && _voicesCache.length) return Promise.resolve(_voicesCache)
  if (_voicesPromise) return _voicesPromise

  _voicesPromise = new Promise((resolve) => {
    const grab = () => {
      const list = window.speechSynthesis.getVoices()
      if (list && list.length) {
        _voicesCache = list
        resolve(list)
        return true
      }
      return false
    }
    if (grab()) return
    // Some browsers populate asynchronously
    window.speechSynthesis.onvoiceschanged = () => { grab() }
    // Fallback: try a few times
    let tries = 0
    const interval = setInterval(() => {
      if (grab() || ++tries > 10) clearInterval(interval)
    }, 200)
  })
  return _voicesPromise
}

/* ─── UNLOCK AUDIO PLAYBACK ───────────────────────────────────────
   Chrome and Safari both block automatic <audio>.play() and
   speechSynthesis.speak() unless the call chain originates from a
   user gesture. Calling this from a click/tap handler primes both
   pipelines so subsequent auto-play works without prompting.
   It's safe to call multiple times. */
let _audioUnlocked = false
export function unlockAudio() {
  if (_audioUnlocked) return
  try {
    if (TTS_SUPPORTED) {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      window.speechSynthesis.speak(u)
      window.speechSynthesis.cancel()
    }
    // Prime <audio> as well — empty WAV buffer
    const a = new Audio()
    a.muted = true
    a.play().catch(() => {})
    _audioUnlocked = true
  } catch {
    /* best-effort */
  }
}

/* ─── PICK A VOICE FOR A PERSONALITY ─────────────────────────────── */
export function pickVoice(voices, personalityKey, lang) {
  const profile = VOICE_PROFILES[personalityKey]?.[lang]
  if (!profile || !voices?.length) return null

  // Try each pattern in order
  for (const pattern of profile.patterns) {
    const match = voices.find((v) => pattern.test(v.name))
    if (match) return match
  }
  // Fallback to any voice matching the language
  const langPrefix = profile.lang.split('-')[0]
  return voices.find((v) => v.lang?.startsWith(langPrefix)) || voices[0] || null
}

/* ─── BROWSER TTS (fallback) ─────────────────────────────────────── */
async function speakWithBrowser(text, personalityKey, lang, callbacks = {}) {
  if (!TTS_SUPPORTED || !text) return null
  const { onStart, onEnd, onError } = callbacks
  const voices = await loadVoices()
  const voice = pickVoice(voices, personalityKey, lang)
  const profile = VOICE_PROFILES[personalityKey]?.[lang]

  window.speechSynthesis.cancel()

  const utt = new SpeechSynthesisUtterance(text)
  if (voice) utt.voice = voice
  utt.lang  = profile?.lang || (lang === 'jp' ? 'ja-JP' : 'en-US')
  utt.pitch = profile?.pitch ?? 1
  utt.rate  = profile?.rate  ?? 1
  utt.volume = 1
  utt.onstart = () => onStart?.()
  utt.onend   = () => onEnd?.()
  utt.onerror = (e) => onError?.(e)

  window.speechSynthesis.speak(utt)
  return utt
}

/* ─── GEMINI TTS (primary) ───────────────────────────────────────── */
let _currentAudio = null

function base64ToBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * Wraps raw 16-bit PCM bytes in a WAV container so the browser can play it.
 * Gemini TTS returns 24kHz mono 16-bit PCM by default.
 */
function pcmToWav(pcmBytes, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const dataSize  = pcmBytes.length
  const byteRate  = sampleRate * numChannels * bitsPerSample / 8
  const blockAlign = numChannels * bitsPerSample / 8
  const buffer    = new ArrayBuffer(44 + dataSize)
  const view      = new DataView(buffer)
  const writeStr  = (off, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)             // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)
  new Uint8Array(buffer, 44).set(pcmBytes)
  return buffer
}

import { callGemini } from './api.js'

async function speakWithGemini(text, personalityKey, lang, callbacks = {}) {
  const { onStart, onEnd, onError } = callbacks
  const voiceName = GEMINI_VOICES[personalityKey] || 'Kore'
  const stylePrefix = STYLE_PROMPTS[personalityKey]?.[lang]
  // Prefix the text with a style instruction Gemini TTS will use to shape delivery.
  // The prefix itself is not heard — Gemini parses it as a directive.
  const styledText = stylePrefix ? `${stylePrefix} ${text}` : text

  const response = await callGemini({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ parts: [{ text: styledText }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
    },
  })
  const part = response?.candidates?.[0]?.content?.parts?.[0]
  const audioB64 = part?.inlineData?.data
  if (!audioB64) throw new Error('Gemini TTS returned no audio data')

  const pcmBytes = base64ToBytes(audioB64)
  const wavBuffer = pcmToWav(pcmBytes)
  const blob = new Blob([wavBuffer], { type: 'audio/wav' })
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  _currentAudio = audio
  audio.onplay = () => onStart?.()
  audio.onended = () => {
    URL.revokeObjectURL(url)
    if (_currentAudio === audio) _currentAudio = null
    onEnd?.()
  }
  audio.onerror = (e) => {
    URL.revokeObjectURL(url)
    if (_currentAudio === audio) _currentAudio = null
    onError?.(e)
  }
  await audio.play()
  return audio
}

/* Track whether Gemini TTS has already failed once; if so, skip it
   for the rest of the session to avoid 1-2s wasted on each reply. */
let _geminiTtsBroken = false

/**
 * Public speak() — tries Gemini TTS first (via the proxy / SDK in api.js),
 * falls back to browser TTS if that fails or isn't available.
 * Returns the underlying utterance/audio handle, or null if both paths fail.
 */
export async function speak(text, personalityKey, lang, callbacks = {}) {
  if (!text) return null
  stopSpeaking()

  if (!_geminiTtsBroken) {
    try {
      return await speakWithGemini(text, personalityKey, lang, callbacks)
    } catch (err) {
      const msg = err?.message || String(err)
      console.warn('[voice] Gemini TTS unavailable, falling back to browser TTS:', msg)
      // If the model isn't available at all, mark as broken to skip the next ~1.5s round-trip
      if (/not found|unsupported|permission|404|400/i.test(msg)) {
        _geminiTtsBroken = true
      }
    }
  }
  if (!TTS_SUPPORTED) {
    callbacks.onError?.(new Error('Speech synthesis is not supported in this browser'))
    return null
  }
  try {
    return await speakWithBrowser(text, personalityKey, lang, callbacks)
  } catch (err) {
    console.error('[voice] Browser TTS failed:', err)
    callbacks.onError?.(err)
    return null
  }
}

export function stopSpeaking() {
  if (_currentAudio) {
    try { _currentAudio.pause() } catch {}
    _currentAudio = null
  }
  if (TTS_SUPPORTED) window.speechSynthesis.cancel()
}

/* ─── SPEECH RECOGNITION WRAPPER ─────────────────────────────────── */
/**
 * Returns a controller object: { start, stop, abort }.
 * Callbacks: onResult(transcript, isFinal), onStart, onEnd, onError.
 */
export function createRecognizer(lang, callbacks = {}) {
  if (!SR_SUPPORTED) return null
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
  const rec = new Ctor()
  rec.lang = lang === 'jp' ? 'ja-JP' : 'en-US'
  rec.continuous = false
  rec.interimResults = true
  rec.maxAlternatives = 1

  const { onResult, onStart, onEnd, onError } = callbacks

  rec.onstart = () => onStart?.()
  rec.onend   = () => onEnd?.()
  rec.onerror = (e) => onError?.(e)
  rec.onresult = (event) => {
    let interim = ''
    let final = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (result.isFinal) final += result[0].transcript
      else interim += result[0].transcript
    }
    onResult?.((final || interim).trim(), Boolean(final))
  }

  return {
    start: () => { try { rec.start() } catch (e) { onError?.(e) } },
    stop:  () => { try { rec.stop()  } catch {} },
    abort: () => { try { rec.abort() } catch {} },
  }
}
