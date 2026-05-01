/* On-device LLM extraction for study-session auto-fill.
 *
 * Primary path:  Chrome's built-in Prompt API (Gemini Nano), which runs
 *                100% on the user's device — no network, no API key,
 *                no data leaving the machine. Surface name varies by
 *                Chrome version; we probe both `window.LanguageModel`
 *                (Chrome 138+ stable) and the older `window.ai` shape.
 * Fallback path: A simple regex parser. Used when no on-device model
 *                is present (Safari, Firefox, older Chrome) so the
 *                feature still works everywhere — just less accurately.
 *
 * Public surface:
 *   isOnDeviceAvailable() → Promise<boolean>
 *   extractStudySession(text) → Promise<{ subject, duration, notes, source }>
 *     source ∈ 'on-device' | 'fallback' | 'empty'
 */

const EXTRACT_SYSTEM_PROMPT = `You parse short study/work-session descriptions and return strict JSON.

Extract exactly three fields:
- subject (string): the topic in 1–4 words, capitalized naturally (e.g. "Python", "Linear Algebra", "JLPT N3 Kanji").
- duration (integer | null): total minutes spent. Convert hours to minutes (1.5h = 90). Null if no time is stated.
- notes (string): a brief summary of what was done, ≤ 80 characters. Empty string if nothing else worth noting.

The user may write in English or Japanese — echo their language in subject and notes.

Respond with ONLY raw JSON, one line, no markdown, no code fences, no commentary.
Example: {"subject":"Python","duration":45,"notes":"async/await deep dive"}`

/* Cache the model session across calls so we don't pay a creation cost
   on every extract. The session itself is cheap, but creation can take
   several hundred ms on first use. */
let _modelPromise = null

async function getModel() {
  if (_modelPromise) return _modelPromise
  _modelPromise = (async () => {
    if (typeof window === 'undefined') return null

    /* Newer surface (Chrome 138+ stable): global `LanguageModel`. */
    if ('LanguageModel' in window) {
      try {
        const a = await window.LanguageModel.availability()
        // Possible values: "unavailable" | "downloadable" | "downloading" | "available"
        if (a && a !== 'unavailable') {
          return await window.LanguageModel.create({
            initialPrompts: [{ role: 'system', content: EXTRACT_SYSTEM_PROMPT }],
          })
        }
      } catch (e) {
        console.warn('[onDevice] LanguageModel.create failed:', e)
      }
    }

    /* Older origin-trial surface: `window.ai.languageModel`. */
    if (window.ai && window.ai.languageModel) {
      try {
        const caps = await window.ai.languageModel.capabilities()
        if (caps && caps.available && caps.available !== 'no') {
          return await window.ai.languageModel.create({
            systemPrompt: EXTRACT_SYSTEM_PROMPT,
          })
        }
      } catch (e) {
        console.warn('[onDevice] window.ai.languageModel.create failed:', e)
      }
    }

    return null
  })()
  return _modelPromise
}

export async function isOnDeviceAvailable() {
  try {
    const m = await getModel()
    return !!m
  } catch {
    return false
  }
}

/* The model is told to return raw JSON, but small models like Gemini
   Nano sometimes wrap output in code fences or add "Here's the JSON:"
   preambles anyway. This pulls the first {...} block out. */
function tryParseJSON(text) {
  const cleaned = String(text || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
  try {
    const parsed = JSON.parse(cleaned)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/)
  if (m) {
    try { return JSON.parse(m[0]) } catch {}
  }
  return null
}

/* Regex parser used when no on-device model exists. Handles common
   English + Japanese phrasings: "I studied X for 45 minutes", "30 mins
   on X", "Xを30分", "1.5時間", etc. Always returns the original text as
   notes (truncated) so nothing is lost. */
function fallbackExtract(text) {
  const raw = String(text || '')
  const lower = raw.toLowerCase()

  /* --- duration --- */
  let duration = null
  // English: "Xh", "X hours", "X hrs"
  const hr = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i)
  if (hr) duration = (duration || 0) + Math.round(parseFloat(hr[1]) * 60)
  // English: "X minutes", "X mins", "Xm"
  const mn = lower.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/i)
  if (mn) duration = (duration || 0) + Math.round(parseFloat(mn[1]))
  // Japanese: "X時間"
  const jhr = raw.match(/(\d+(?:\.\d+)?)\s*時間/)
  if (jhr) duration = (duration || 0) + Math.round(parseFloat(jhr[1]) * 60)
  // Japanese: "X分"
  const jmn = raw.match(/(\d+(?:\.\d+)?)\s*分/)
  if (jmn) duration = (duration || 0) + Math.round(parseFloat(jmn[1]))
  // Bare "for X" — last resort
  if (duration == null) {
    const bare = lower.match(/\bfor\s+(\d+)\b/)
    if (bare) duration = parseInt(bare[1], 10)
  }

  /* --- subject --- */
  let subject = ''
  // English: "studied X", "worked on X", "learning X", "on X", "about X"
  const en = raw.match(
    /(?:studied|studying|worked\s+on|working\s+on|practic(?:ing|ed)|learning|learned|reviewed|reviewing|on|about)\s+([\w][\w\s\-+#./]{0,30}?)(?:\s+for\s+\d|\s+for\b|[,.!?]|$)/i
  )
  if (en) subject = en[1].trim().replace(/\s+/g, ' ')
  // Japanese: "Xを勉強" / "X勉強"
  if (!subject) {
    const jp = raw.match(/([\w぀-ヿ一-鿿]{1,20})\s*[をの]?\s*(?:勉強|学習|練習|復習)/)
    if (jp) subject = jp[1].trim()
  }
  // Capitalize first letter if it's plain ASCII
  if (subject && /^[a-z]/.test(subject)) subject = subject[0].toUpperCase() + subject.slice(1)

  /* --- notes --- */
  const notes = raw.length > 80 ? raw.slice(0, 77).trimEnd() + '…' : raw

  return { subject, duration, notes }
}

export async function extractStudySession(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return { subject: '', duration: null, notes: '', source: 'empty' }

  const model = await getModel()
  if (model) {
    try {
      const reply = await model.prompt(trimmed)
      const parsed = tryParseJSON(reply)
      if (parsed) {
        const dur = parsed.duration == null ? null : parseInt(parsed.duration, 10)
        return {
          subject: String(parsed.subject || '').trim(),
          duration: Number.isFinite(dur) && dur > 0 ? dur : null,
          notes: String(parsed.notes || '').trim(),
          source: 'on-device',
        }
      }
    } catch (e) {
      console.warn('[onDevice] extract failed, falling back:', e)
    }
  }
  return { ...fallbackExtract(trimmed), source: 'fallback' }
}
