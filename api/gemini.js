/**
 * Vercel serverless function — proxies Gemini API calls server-side.
 *
 * The browser POSTs the same `generateContent` payload it would normally
 * pass to the SDK; we forward it with the server's API key. The key
 * never leaves the server, so visitors can't extract it from the bundle.
 *
 * Configure on Vercel: add env var GEMINI_API_KEY in Project Settings.
 */
import { GoogleGenAI } from '@google/genai'

let _ai = null
function getAI() {
  if (_ai) return _ai
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not configured on the server')
  _ai = new GoogleGenAI({ apiKey: key })
  return _ai
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'POST required' } })
  }

  try {
    const ai = getAI()
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: { message: 'Invalid JSON body' } })
    }

    const response = await ai.models.generateContent(payload)

    // `response.text` is a getter that throws on empty candidates and
    // does not serialise to JSON. Return the structured fields the
    // client needs — `safeResponseText()` walks `candidates` itself.
    res.status(200).json({
      candidates: response?.candidates ?? [],
      promptFeedback: response?.promptFeedback,
      usageMetadata: response?.usageMetadata,
    })
  } catch (err) {
    const raw = err?.message || String(err)
    const codeMatch = raw.match(/"code"\s*:\s*(\d{3})/) || raw.match(/\b(4\d{2}|5\d{2})\b/)
    const status = codeMatch
      ? Math.min(599, Math.max(400, parseInt(codeMatch[1], 10)))
      : 500
    res.status(status).json({ error: { code: status, message: raw } })
  }
}
