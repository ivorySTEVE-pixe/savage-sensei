/**
 * Single entry point for all Gemini calls.
 *
 * In production: POSTs to /api/gemini (a Vercel serverless function that
 * holds the API key server-side). The browser bundle never sees the key.
 *
 * In local dev: calls the Gemini SDK directly with VITE_GEMINI_API_KEY
 * from .env, so you can keep using `npm run dev` without setting up a
 * local proxy.
 *
 * The response shape is the same in both cases: `{candidates, ...}`.
 * The client-side `safeResponseText()` helper handles either path.
 */
import { GoogleGenAI } from '@google/genai'

const _devKey = import.meta.env.VITE_GEMINI_API_KEY
const _devAi  = import.meta.env.DEV && _devKey
  ? new GoogleGenAI({ apiKey: _devKey })
  : null

export async function callGemini(payload) {
  if (import.meta.env.PROD) {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    let json = null
    try { json = await res.json() } catch { /* non-JSON body */ }
    if (!res.ok) {
      const detail = json?.error?.message || `HTTP ${res.status}`
      throw new Error(detail)
    }
    return json
  }
  if (!_devAi) {
    throw new Error('VITE_GEMINI_API_KEY missing in .env (local dev)')
  }
  return await _devAi.models.generateContent(payload)
}
