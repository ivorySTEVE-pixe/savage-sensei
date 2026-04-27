import { useState, useEffect, useMemo, useRef } from 'react'
import { callGemini } from './api.js'
import {
  Flame, BookOpen, ScrollText, X, Trash2,
  Loader2, Send, Languages, Sparkles, ArrowLeft,
  MessageCircle, RotateCcw, Mic, MicOff,
  Volume2, VolumeX, Type, AudioLines,
  Info, Target, BarChart3, Plus, Check, Bot,
  Home, ChevronDown, ChevronUp, Brain,
} from 'lucide-react'
import {
  speak, stopSpeaking, createRecognizer, loadVoices, unlockAudio,
  SR_SUPPORTED, TTS_SUPPORTED,
} from './voice.js'
import demonCoachImg from './assets/demon-coach.png'
import osakaAuntieImg from './assets/osaka-auntie.png'
import techBroImg from './assets/tech-bro.png'

/* All Gemini access goes through `callGemini` from ./api.js — proxied
   server-side in production, direct SDK in local dev. */

/* ─── PERSONALITIES ─────────────────────────────────────────────── */
const PERSONALITIES = {
  demonCoach: {
    image: demonCoachImg,
    label: { en: 'Demon Coach', jp: '鬼コーチ' },
    description: { en: 'Brutal drill sergeant. No excuses.', jp: '冷酷な鬼軍曹。言い訳禁止。' },
    tag: 'DRILL SGT',
    accent: '#ef4444',
    accentDark: '#450a0a',
    prompt: {
      en: `You are 鬼コーチ (Oni Coach), a brutal drill sergeant study coach from Japanese sports anime tradition.
## Personality
- Strict, loud, impatient. No excuses.
- Use military/sports metaphors constantly.
- Underneath, you secretly want them to succeed.
- Stay playful, never genuinely cruel.
## Rules
- Respond in English.
- Keep responses 2-4 sentences MAX.
- End with a challenge or command.
- IMPORTANT: If past session context is provided, REFERENCE IT. Notice patterns, call out repeats, acknowledge progress or backsliding.`,
      jp: `あなたは鬼コーチ。スポ根アニメに出てくるような熱血指導者です。
## 性格
- 厳しく、大声で、せっかち。言い訳は一切聞かない。
- 軍隊やスポーツの例えをよく使う。
- 本音では生徒の成功を望んでいる。
## ルール
- 必ず日本語で答える。命令口調を使う。
- 2〜4文以内で短く。
- 最後に次への課題や指示で締める。
- 重要：過去のセッション情報があれば、必ず言及せよ。`,
    },
  },
  osakaAuntie: {
    image: osakaAuntieImg,
    label: { en: 'Osaka Auntie', jp: '関西のおばちゃん' },
    description: { en: 'Loud, loving, brutally honest.', jp: '愛情たっぷり、口は悪い。' },
    tag: 'OSAKA',
    accent: '#f59e0b',
    accentDark: '#451a03',
    prompt: {
      en: `You are an Osaka Auntie who treats the user like her own grandchild. Loud, loving, sharp-tongued.
## Personality
- Warm but ツッコミ style.
- Compare everything to food or neighborhood gossip.
- Care deeply but show it by complaining.
## Rules
- Respond in English but sprinkle Japanese exclamations (やん, ほんま, あかん) naturally.
- Keep responses 2-4 sentences MAX.
- End with motherly advice or a food reference.
- IMPORTANT: If past session context is provided, gossip about it like neighborhood news.`,
      jp: `あなたは関西のおばちゃん。ユーザーを孫みたいに扱う、愛情深いけど口の悪いおばちゃんです。
## 性格
- 関西弁バリバリ（〜やん、〜やで、ほんま、あかん等）。
- 何でも食べ物か近所の噂話に例える。
## ルール
- 必ず関西弁で答える。2〜4文以内で短く。
- 最後は母性的なアドバイスか食べ物の話で締める。
- 重要：過去のセッション情報があれば、近所の噂話みたいに触れる。`,
    },
  },
  techBro: {
    image: techBroImg,
    label: { en: 'Tech Bro', jp: 'シリコンバレー兄貴' },
    description: { en: 'Silicon Valley cringe energy.', jp: 'スタートアップ用語を多用するイタい兄貴。' },
    tag: 'VC MODE',
    accent: '#38bdf8',
    accentDark: '#082f49',
    prompt: {
      en: `You are a Silicon Valley startup bro. You watched too many LinkedIn motivational videos.
## Personality
- Use tech/startup jargon (grinding, 10x, leverage, scale, runway).
- Call the user "champ", "legend", "king/queen".
- Treat studying like building a unicorn startup.
## Rules
- Respond in English with excessive enthusiasm.
- Keep responses 2-4 sentences MAX.
- End with toxic-positive advice or "circle back tomorrow".
- IMPORTANT: If past session context is provided, frame it as "metrics" and "KPIs".`,
      jp: `あなたはシリコンバレーのスタートアップ兄貴。
## 性格
- カタカナのビジネス用語を多用する（グラインド、10x、レバレッジ等）。
- ユーザーを「キング」「レジェンド」「兄弟」と呼ぶ。
## ルール
- 日本語で答えるが、ビジネス英語のカタカナ語を多めに混ぜる。
- 過剰なテンションで。2〜4文以内で短く。
- 重要：過去のセッション情報があれば、「KPI」「メトリクス」みたいに語れ。`,
    },
  },
}

const TEXT = {
  en: {
    title: 'Savage Sensei',
    tagline: 'Track your study.\nGet a brutally honest take from your sensei.',
    chooseTormentor: 'Pick your sensei',
    subject: 'Subject', subjectPh: 'e.g. Python, Japanese, Math',
    duration: 'Duration (min)', durationPh: '30',
    notes: 'Notes', notesPh: 'What did you study? What went wrong?',
    roastMe: 'Submit', thinking: 'Consulting',
    fillIn: 'Please fill in subject and duration',
    says: 'weighs in', history: 'Your sessions', clearAll: 'Clear all',
    confirmClear: 'Delete ALL sessions? This cannot be undone.',
    min: 'min', streak: 'Day Streak', sessions: 'Sessions',
    emptyTitle: 'No sessions tracked yet',
    emptyText: 'Log your first session — your sensei is waiting to weigh in.',
    back: 'Switch sensei', activeSensei: 'Active sensei',
    showMore: (n) => `+${n} more`, showLess: 'Show less', cancel: 'Cancel',
    /* Chat */
    continueChat: 'Consult further',
    askSensei: 'Ask sensei',
    chatPlaceholder: 'Ask your sensei…',
    chatTitle: 'Consulting with',
    chatEmpty: 'Start the consultation. Sensei is listening.',
    clearChat: 'Reset chat',
    confirmClearChat: 'Reset this chat? The conversation will be lost.',
    backToSession: 'Back to session',
    sending: 'Sending',
    /* Voice */
    modeText: 'Text', modeVoice: 'Voice',
    tapToSpeak: 'Tap to speak',
    listening: 'Listening…',
    voiceUnsupported: 'Voice not supported in this browser',
    micUnavailable: 'Microphone unavailable',
    play: 'Play', stop: 'Stop',
  },
  jp: {
    title: '鬼コーチ',
    tagline: '勉強を記録して、\n容赦のない先生の見立てをもらおう。',
    chooseTormentor: '先生を選ぶ',
    subject: '科目', subjectPh: '例：Python、日本語、数学',
    duration: '時間（分）', durationPh: '30',
    notes: 'メモ', notesPh: '何を勉強した？何があかんかった？',
    roastMe: '送信', thinking: '考えてる',
    fillIn: '科目と時間を入力してや！',
    says: 'の見立て', history: 'セッション履歴', clearAll: '全削除',
    confirmClear: '全部消すで？戻されへんで。',
    min: '分', streak: '日連続', sessions: '回',
    emptyTitle: 'まだセッションがあらへん',
    emptyText: '最初のセッションを記録してや。先生が見立てをくれるで。',
    back: '先生を変える', activeSensei: '現在の先生',
    showMore: (n) => `+${n}件`, showLess: '閉じる', cancel: 'キャンセル',
    /* Chat */
    continueChat: '相談を続ける',
    askSensei: '先生に相談',
    chatPlaceholder: '先生に聞いてみ…',
    chatTitle: '相談相手：',
    chatEmpty: '話しかけてみ。先生が聞いてるで。',
    clearChat: 'チャットをリセット',
    confirmClearChat: 'このチャットをリセットする？会話は全部消えるで。',
    backToSession: 'セッションに戻る',
    sending: '送信中',
    /* Voice */
    modeText: 'テキスト', modeVoice: '音声',
    tapToSpeak: 'タップして話す',
    listening: '聞いてる…',
    voiceUnsupported: 'このブラウザは音声非対応',
    micUnavailable: 'マイクが使えへん',
    play: '再生', stop: '停止',
  },
}

const STORAGE_KEY = 'savage-sensei-sessions'
const LANG_KEY    = 'savage-sensei-lang'
const CHATS_KEY   = 'savage-sensei-chats'
const GOALS_KEY   = 'savage-sensei-goals'

/* Tone instruction for chat-mode replies. Drops the "always end with a command"
   rule from the roast prompt and reframes as a brutal-but-helpful consultation. */
const CHAT_MODE_ADDON = {
  en: `\n\n## CONSULTATION MODE
- The user has just been given a take on their study session and now wants to keep talking with you.
- Stay 100% in character (tone, voice, slang) at all times.
- Reply length: 1-3 sentences typically; up to 5 if they ask a real study question.
- If they ask for genuine help (explanations, study tips, language questions), give it — but answer IN CHARACTER.
- Don't keep ending every reply with a command or challenge — this is a conversation, not a roast.
- Reference their past sessions naturally when relevant.`,
  jp: `\n\n## 相談モード
- ユーザーは見立てをもらった後、引き続きあなたと相談したい。
- キャラクターを絶対に崩さない。
- 返答は通常1〜3文。本格的な勉強の相談なら最大5文まで。
- 真面目な質問（解説、勉強のコツ、言語の質問）には答えてもよい。ただしキャラのまま答える。
- 毎回命令や課題で締めなくてよい。これは会話。
- 過去のセッションに自然に触れる。`,
}

/* ─── UTILS ─────────────────────────────────────────────────────── */
function calculateStreak(sessions) {
  if (!sessions.length) return 0
  const days = [...new Set(sessions.map(s => new Date(s.timestamp).toISOString().split('T')[0]))]
    .sort().reverse()
  let streak = 0, cur = new Date(); cur.setHours(0,0,0,0)
  for (const d of days) {
    const diff = Math.round((cur - new Date(d)) / 86400000)
    if (diff === streak) streak++
    else if (diff === streak + 1 && streak === 0) { streak++; cur.setDate(cur.getDate()-1) }
    else break
  }
  return streak
}

function buildContextString(sessions, lang) {
  if (!sessions.length) return ''
  const recent = sessions.slice(0, 5)
  const streak = calculateStreak(sessions)
  const lines = recent.map((s, i) => {
    const date = new Date(s.timestamp).toLocaleDateString()
    return `${i+1}. ${date} — ${s.subject} for ${s.duration} min${s.notes ? ` (notes: ${s.notes})` : ''}`
  }).join('\n')
  if (lang === 'jp') {
    return `\n\n## このユーザーの最近の履歴\n- 合計セッション数: ${sessions.length}回\n- 連続学習日数: ${streak}日\n- 直近のセッション:\n${lines}\n\n上記を参考に反応せよ。`
  }
  return `\n\n## This user's recent history\n- Total sessions: ${sessions.length}\n- Streak: ${streak} days\n- Recent:\n${lines}\n\nUse this to call out patterns, progress, or backsliding.`
}

/* ─── GEMINI CONTENTS HELPERS ──────────────────────────────────────
   Gemini's chat API rejects conversations that don't start with role
   'user'. Our UI prepends a greeting from the AI, which would crash
   the call. Strip leading non-user messages before sending.
   Also normalises the response text safely — `.text` is a getter on
   the @google/genai SDK that THROWS if no candidates were returned
   (e.g. on safety blocks), so wrap it. */
function toGeminiContents(messages) {
  const firstUserIdx = messages.findIndex(m => m.role === 'user')
  if (firstUserIdx < 0) return []
  return messages.slice(firstUserIdx).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: String(m.text || '') }],
  }))
}
/* Friendly error formatter — turns raw Gemini errors into a single
   readable line. Detects HTTP status codes embedded in JSON-shaped
   error bodies. Returns a translated string. */
function formatGeminiError(err, lang) {
  const raw = err?.message || String(err || '')
  const codeMatch = raw.match(/"code"\s*:\s*(\d{3})/) || raw.match(/\b(4\d{2}|5\d{2})\b/)
  const code = codeMatch ? parseInt(codeMatch[1], 10) : 0

  const en = {
    429: 'Quota exceeded — wait a minute or check your Google AI plan.',
    403: "API key rejected — check it's valid and has access.",
    401: 'API key missing or unauthorized.',
    400: 'The model rejected the request. Try shorter input.',
    404: 'Model not available on this key.',
    500: 'Gemini is having issues — try again in a moment.',
    503: 'Gemini is overloaded — try again in a moment.',
    empty: 'The model returned an empty response.',
    network: 'No connection to Gemini. Check your internet.',
    generic: 'Something went wrong talking to Gemini.',
  }
  const jp = {
    429: 'クオータ超過 — 1分待つか、Google AIプランを確認してや。',
    403: 'APIキー拒否されたで — 有効か確認して。',
    401: 'APIキーが無いか、認証エラーや。',
    400: 'モデルがリクエストを拒否した。入力を短くしてみ。',
    404: 'このキーではモデル使えへん。',
    500: 'Geminiが不調や — 少し待ってもう一回。',
    503: 'Geminiが混雑してる — 少し待ってもう一回。',
    empty: 'モデルから空の返答や。',
    network: 'Geminiに繋がらへん。ネット確認してや。',
    generic: 'Geminiでエラーが起きた。',
  }
  const msgs = lang === 'jp' ? jp : en

  if (code === 429) return msgs[429]
  if (code && msgs[code]) return msgs[code]
  if (/empty response/i.test(raw)) return msgs.empty
  if (/network|fetch|failed to fetch/i.test(raw)) return msgs.network
  if (code >= 500) return msgs[500]
  return msgs.generic
}

function safeResponseText(response) {
  try {
    const t = response?.text
    if (typeof t === 'string' && t.length) return t
  } catch { /* getter threw */ }
  // Fallback: walk candidates manually
  try {
    const parts = response?.candidates?.[0]?.content?.parts
    if (Array.isArray(parts)) {
      const joined = parts.map(p => p?.text || '').join('').trim()
      if (joined) return joined
    }
  } catch {}
  return ''
}

/* ─── PERSONALITY GREETINGS ──────────────────────────────────────── */
/* Funny, in-character one-liners shown on each picker card. References
   the user's most recent session if any, otherwise an intro line. */
function getGreeting(personalityKey, sessions, openGoals, lang) {
  const last = sessions[0]
  const subj = last?.subject
  const hasGoals = openGoals > 0
  const en = {
    demonCoach: last
      ? `${subj} again? I see you. Drop and give me 30 — minutes, not pushups.`
      : hasGoals
      ? `${openGoals} open goals on the board. Move.`
      : `Fresh recruit. Log your first session — NOW.`,
    osakaAuntie: last
      ? `${subj}まだやっとるん？えらいなぁ — でももっとやりや、たこ焼き作っとくで！`
      : hasGoals
      ? `${openGoals}個も目標残ってんで〜 ぼちぼちやろか！`
      : `あらあら、おかえり〜！何勉強しに来たん？`,
    techBro: last
      ? `${subj} grind detected. Let's 10x it today, legend.`
      : hasGoals
      ? `${openGoals} goals in the pipeline. Time to ship, king.`
      : `New user! This is your founder moment. Log a session, scale the streak.`,
  }
  const jp = {
    demonCoach: last
      ? `また${subj}か。30分追加や。今すぐ動け！`
      : hasGoals
      ? `目標が${openGoals}個も残ってる。動け！`
      : `新入りや。最初のセッションを記録しろ！`,
    osakaAuntie: last
      ? `${subj}またやっとるん？えらいなぁ〜 もっとやりや！`
      : hasGoals
      ? `${openGoals}個も目標残ってんで〜 ぼちぼちやろか！`
      : `あらあら、おかえり〜！何しに来たん？`,
    techBro: last
      ? `${subj}グラインド継続中？10xしようぜ、レジェンド！`
      : hasGoals
      ? `目標が${openGoals}個もパイプラインにある。出荷タイムや！`
      : `新規ユーザー！ファウンダーモード起動。記録始めろ！`,
  }
  return (lang === 'jp' ? jp : en)[personalityKey] || ''
}

/* ─── PARTICLE DATA (stable reference) ──────────────────────────── */
const PARTICLE_DATA = Array.from({ length: 30 }, () => {
  const r = Math.random()
  const type = r < 0.25 ? 'ember-lg' : r < 0.65 ? 'ember-sm' : 'spark'
  return {
    type,
    left: `${(Math.random() * 100).toFixed(1)}%`,
    dur:  `${(5 + Math.random() * 10).toFixed(1)}s`,
    del:  `${(Math.random() * -15).toFixed(1)}s`,
  }
})

/* ─── BACKGROUND LAYERS ─────────────────────────────────────────── */
function BgLayers({ accent }) {
  const a = accent || '#ef4444'
  return (
    <>
      <div className="bg-ambient" style={{
        background: `radial-gradient(ellipse 80% 50% at 50% -5%, ${a}18 0%, transparent 65%)`,
      }} />
      <div className="bg-orb" style={{ width:520, height:520, top:'4%', left:'-6%', background: a, opacity:0.14, animationDelay:'0s' }} />
      <div className="bg-orb" style={{ width:360, height:360, bottom:'8%', right:'-5%', background: a, opacity:0.09, animationDelay:'-8s' }} />
      <div className="bg-orb" style={{ width:260, height:260, top:'45%', right:'22%', background: a, opacity:0.07, animationDelay:'-4s' }} />
      <div className="ground-glow">
        <div className="ground-glow-inner" style={{
          background: `radial-gradient(ellipse at center bottom, ${a}35 0%, ${a}12 40%, transparent 75%)`,
        }} />
      </div>
      <div className="flame-wrap" style={{ opacity: 0.6 }}>
        {PARTICLE_DATA.map((p, i) => (
          <div key={i} className={`fp ${p.type}`}
            style={{ left: p.left, animationDuration: p.dur, animationDelay: p.del }} />
        ))}
      </div>
    </>
  )
}

/* ─── ROAST PANEL ────────────────────────────────────────────────── */
function RoastPanel({ roast, personality, t, lang, accent, onContinue }) {
  return (
    <div className="anim-fadein" style={{
      borderRadius: 14, overflow: 'hidden',
      border: `1px solid ${accent}22`,
      boxShadow: `0 20px 60px -20px ${accent}35`,
    }}>
      <div style={{ display: 'flex', minHeight: 220 }}>
        <div className="anim-slideleft" style={{ width: '36%', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
          <img src={personality.image} alt={personality.label[lang]}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to right, transparent 60%, ${accent}14 100%)` }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: accent }} />
          <div style={{
            position: 'absolute', top: 10, left: 10,
            padding: '3px 7px', borderRadius: 4,
            background: `${personality.accentDark}ee`, backdropFilter: 'blur(8px)',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: accent,
          }}>{personality.tag}</div>
        </div>
        <div className="anim-slideright" style={{
          flex: 1, padding: '28px 26px',
          background: 'rgba(255,255,255,0.02)',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
            <Sparkles size={11} color={accent} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: accent, textTransform: 'uppercase' }}>
              {personality.label[lang]} {t.says}
            </span>
          </div>
          <div style={{ fontSize: 52, lineHeight: 0.7, color: `${accent}28`, fontFamily: 'Georgia,serif', marginBottom: 12, userSelect: 'none' }}>"</div>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#dde4ef', whiteSpace: 'pre-wrap' }}>{roast}</p>
        </div>
      </div>
      {onContinue && (
        <button onClick={onContinue} className="anim-fadein" style={{
          width: '100%', padding: '14px 20px', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
          color: accent, background: `${accent}10`,
          borderTop: `1px solid ${accent}1f`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 0.18s, color 0.18s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = `${accent}1c`; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={e => { e.currentTarget.style.background = `${accent}10`; e.currentTarget.style.color = accent }}>
          <MessageCircle size={14} />
          {t.continueChat}
          <span style={{ fontSize: 14, fontWeight: 400, opacity: 0.7 }}>→</span>
        </button>
      )}
    </div>
  )
}

/* ─── HISTORY ITEM ───────────────────────────────────────────────── */
function HistoryItem({ session, t, onDelete }) {
  const [hov, setHov] = useState(false)
  const p = PERSONALITIES[session.personalityKey]
  const color = p ? p.accent : 'rgba(148,163,184,0.5)'
  const fmt = new Date(session.timestamp).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  return (
    <div className="history-item" onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', gap: 14, padding: '14px 12px', position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <div style={{ width: 1, flex: 1, marginTop: 6, background: 'rgba(255,255,255,0.05)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 10px', marginBottom: 5 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>{session.subject}</span>
          <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)' }}>{session.duration} {t.min}</span>
          {p && <span style={{ fontSize: 11, fontWeight: 600, color }}>{p.label.en}</span>}
          <span style={{ fontSize: 11, color: 'rgba(100,116,139,0.5)', marginLeft: 'auto' }}>{fmt}</span>
        </div>
        {session.notes && (
          <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', fontStyle: 'italic', marginBottom: 5 }}>
            "{session.notes}"
          </div>
        )}
        <div style={{ fontSize: 13, color: 'rgba(203,213,225,0.7)', lineHeight: 1.65 }}>{session.roast}</div>
      </div>
      {hov && (
        <button onClick={() => onDelete(session.id)} style={{
          position: 'absolute', top: 12, right: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(148,163,184,0.3)', padding: 4, transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.3)'}>
          <X size={13} />
        </button>
      )}
    </div>
  )
}

/* ─── CHAT BUBBLE ────────────────────────────────────────────────── */
function ChatBubble({ m, personality, accent, fmtTime, speaking, onToggleSpeak, t }) {
  const isUser = m.role === 'user'
  return (
    <div className="anim-fadeup" style={{
      display: 'flex', gap: 10, alignItems: 'flex-end',
      flexDirection: isUser ? 'row-reverse' : 'row',
    }}>
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: 8, overflow: 'hidden',
          border: `1.5px solid ${speaking ? accent : `${accent}33`}`,
          flexShrink: 0,
          boxShadow: speaking ? `0 0 0 3px ${accent}30` : 'none',
          transition: 'box-shadow 0.2s, border-color 0.2s',
        }}>
          <img src={personality.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        <div style={{
          padding: '11px 14px',
          borderRadius: isUser ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
          background: isUser ? 'rgba(255,255,255,0.06)' : `${accent}0e`,
          border: isUser
            ? '1px solid rgba(255,255,255,0.07)'
            : `1px solid ${speaking ? `${accent}55` : `${accent}22`}`,
          color: '#e2e8f0', fontSize: 14, lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          transition: 'border-color 0.2s',
        }}>
          {m.text}
        </div>
        <div style={{
          display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, padding: '0 4px',
          flexDirection: isUser ? 'row-reverse' : 'row',
        }}>
          <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)' }}>{fmtTime(m.ts)}</span>
          {!isUser && TTS_SUPPORTED && onToggleSpeak && (
            <button
              onClick={() => onToggleSpeak(m)}
              title={speaking ? t.stop : t.play}
              aria-label={speaking ? t.stop : t.play}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: speaking ? accent : 'rgba(148,163,184,0.4)',
                padding: 0, display: 'flex', alignItems: 'center',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { if (!speaking) e.currentTarget.style.color = '#cbd5e1' }}
              onMouseLeave={e => { if (!speaking) e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}
            >
              {speaking ? <VolumeX size={11} /> : <Volume2 size={11} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── VOICE COMPOSER ─────────────────────────────────────────────── */
function VoiceComposer({ accent, listening, sending, interim, t, onStart, onStop }) {
  const isBusy = sending && !listening
  const label = isBusy ? t.sending : listening ? t.listening : t.tapToSpeak
  return (
    <div style={{
      padding: '20px 16px 22px',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.015)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      flexShrink: 0,
    }}>
      {interim && listening && (
        <div className="anim-fadein" style={{
          width: '100%', maxWidth: 380, padding: '8px 14px',
          borderRadius: 999, background: 'rgba(255,255,255,0.04)',
          fontSize: 12, color: 'rgba(203,213,225,0.7)',
          textAlign: 'center', fontStyle: 'italic',
          border: `1px solid ${accent}22`,
        }}>
          {interim}
        </div>
      )}
      <button
        onClick={listening ? onStop : onStart}
        disabled={isBusy}
        aria-label={label}
        style={{
          position: 'relative',
          width: 72, height: 72, borderRadius: '50%', border: 'none',
          cursor: isBusy ? 'not-allowed' : 'pointer',
          background: listening
            ? `radial-gradient(circle at center, ${accent}, ${accent}cc)`
            : isBusy ? 'rgba(255,255,255,0.04)'
            : `linear-gradient(135deg, ${accent}, ${accent}99)`,
          color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: listening
            ? `0 0 0 8px ${accent}1a, 0 12px 40px -8px ${accent}80`
            : isBusy ? 'none'
            : `0 8px 28px -6px ${accent}80`,
          transition: 'box-shadow 0.25s, background 0.25s, transform 0.18s',
        }}
        onMouseDown={e => { if (!isBusy) e.currentTarget.style.transform = 'scale(0.96)' }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        {listening && (
          <span style={{
            position: 'absolute', inset: -6, borderRadius: '50%',
            border: `2px solid ${accent}`, opacity: 0.5,
            animation: 'voicePulse 1.4s ease-out infinite',
          }} />
        )}
        {isBusy
          ? <Loader2 size={26} style={{ animation: 'spinAnim 1s linear infinite' }} />
          : listening ? <MicOff size={26} /> : <Mic size={26} />}
      </button>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: listening ? accent : 'rgba(148,163,184,0.55)',
        transition: 'color 0.2s',
      }}>{label}</div>
    </div>
  )
}

/* ─── CHAT VIEW ──────────────────────────────────────────────────── */
function ChatView({
  personality, accent, lang, t,
  messages, input, setInput, sending,
  onSend, onBack, onSwitchSensei, onClear,
  mode, setMode,
  listening, onStartListening, onStopListening,
  speakingId, onToggleSpeak,
}) {
  const scrollRef = useRef(null)
  const inputRef  = useRef(null)
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length, sending])
  useEffect(() => { if (mode === 'text') inputRef.current?.focus() }, [mode])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() }
  }

  return (
    <div className="anim-fadeup" style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100dvh - 110px)', minHeight: 520,
      borderRadius: 16, overflow: 'hidden',
      border: `1px solid ${accent}22`,
      background: 'rgba(255,255,255,0.015)',
      boxShadow: `0 24px 80px -24px ${accent}30`,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 18px',
        background: `${accent}0c`, borderBottom: `1px solid ${accent}1f`,
        flexShrink: 0,
      }}>
        <button onClick={onBack} title={t.backToSession} style={{
          width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#f1f5f9' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(148,163,184,0.7)' }}>
          <ArrowLeft size={15} />
        </button>
        <div style={{ width: 38, height: 38, borderRadius: 10, overflow: 'hidden',
          border: `2px solid ${accent}40`, flexShrink: 0 }}>
          <img src={personality.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.13em',
            textTransform: 'uppercase', fontWeight: 700, marginBottom: 2 }}>
            {t.chatTitle}
          </div>
          <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: accent, lineHeight: 1 }}>
            {personality.label[lang]}
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 8,
          padding: 3, border: '1px solid rgba(255,255,255,0.07)',
        }}>
          {[
            { key: 'text',  icon: <Type size={11} />,       label: t.modeText },
            { key: 'voice', icon: <AudioLines size={11} />, label: t.modeVoice },
          ].map(opt => (
            <button key={opt.key}
              onClick={() => { unlockAudio(); setMode(opt.key) }}
              disabled={opt.key === 'voice' && !SR_SUPPORTED}
              title={opt.key === 'voice' && !SR_SUPPORTED ? t.voiceUnsupported : opt.label}
              style={{
                padding: '5px 10px', borderRadius: 6, border: 'none',
                cursor: (opt.key === 'voice' && !SR_SUPPORTED) ? 'not-allowed' : 'pointer',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', fontFamily: 'inherit',
                background: mode === opt.key ? accent : 'transparent',
                color: mode === opt.key ? 'white'
                  : (opt.key === 'voice' && !SR_SUPPORTED) ? 'rgba(148,163,184,0.25)'
                  : 'rgba(148,163,184,0.65)',
                transition: 'all 0.18s', display: 'flex', alignItems: 'center', gap: 4,
              }}>
              {opt.icon}{opt.label}
            </button>
          ))}
        </div>

        <button onClick={onSwitchSensei} title={t.back} style={{
          padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.07)',
          background: 'transparent', color: 'rgba(148,163,184,0.55)',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(148,163,184,0.55)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}>
          {t.back}
        </button>
        <button onClick={onClear} title={t.clearChat} style={{
          width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'transparent', color: 'rgba(148,163,184,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)'; e.currentTarget.style.background = 'transparent' }}>
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '22px 18px',
        display: 'flex', flexDirection: 'column', gap: 14,
        scrollBehavior: 'smooth',
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 12px', color: 'rgba(148,163,184,0.5)' }}>
            <MessageCircle size={28} color={`${accent}55`} style={{ marginBottom: 10 }} />
            <div className="font-display" style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
              {personality.label[lang]}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.55)' }}>{t.chatEmpty}</div>
          </div>
        )}
        {messages.map((m, i) => (
          <ChatBubble key={i} m={m} personality={personality} accent={accent} fmtTime={fmtTime}
            speaking={speakingId === m.ts} onToggleSpeak={onToggleSpeak} t={t} />
        ))}
        {sending && (
          <div className="anim-fadein" style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, overflow: 'hidden',
              border: `1.5px solid ${accent}33`, flexShrink: 0 }}>
              <img src={personality.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{
              padding: '11px 14px', borderRadius: '12px 12px 12px 3px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: 4, color: accent,
            }}>
              <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      {mode === 'text' ? (
        <div style={{
          display: 'flex', gap: 8, padding: 14,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.015)', flexShrink: 0,
        }}>
          <textarea
            ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t.chatPlaceholder} rows={1}
            className="input-field"
            style={{
              flex: 1, resize: 'none', minHeight: 44, maxHeight: 120,
              lineHeight: 1.5, fontSize: 14, padding: '11px 14px',
            }}
            onFocus={e => { e.target.style.borderColor = `${accent}60`; e.target.style.boxShadow = `0 0 0 3px ${accent}18` }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
          />
          <button
            onClick={onSend} disabled={sending || !input.trim()}
            style={{
              width: 44, height: 44, borderRadius: 10, border: 'none',
              background: input.trim() && !sending ? accent : 'rgba(255,255,255,0.05)',
              color: input.trim() && !sending ? 'white' : 'rgba(148,163,184,0.4)',
              cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.18s', flexShrink: 0,
              boxShadow: input.trim() && !sending ? `0 6px 20px -6px ${accent}80` : 'none',
            }}>
            {sending ? <Loader2 size={15} style={{ animation: 'spinAnim 1s linear infinite' }} /> : <Send size={15} />}
          </button>
        </div>
      ) : (
        <VoiceComposer
          accent={accent} listening={listening} sending={sending} interim={input} t={t}
          onStart={onStartListening} onStop={onStopListening}
        />
      )}
    </div>
  )
}

/* ─── APP ────────────────────────────────────────────────────────── */
function App() {
  const [tab, setTab]                 = useState('log')   // log | ask | goals | stats
  const [showInfo, setShowInfo]       = useState(false)
  const [openGoalsCount, setOpenGoalsCount] = useState(0)
  const [goalsSubTab, setGoalsSubTab]       = useState('goals')   // goals | quiz
  const [step, setStep]               = useState('pick')
  const [personalityKey, setPersonalityKey] = useState(null)
  const [lang, setLang]               = useState('en')
  const [sessions, setSessions]       = useState([])
  const [subject, setSubject]         = useState('')
  const [duration, setDuration]       = useState('')
  const [notes, setNotes]             = useState('')
  const [roast, setRoast]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [histExpanded, setHistExpanded] = useState(false)
  const [toast, setToast]             = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [fading, setFading]           = useState(false)
  /* Chat */
  const [chatMessages, setChatMessages] = useState({})
  const [chatInput, setChatInput]       = useState('')
  const [chatSending, setChatSending]   = useState(false)
  const [confirmClearChat, setConfirmClearChat] = useState(false)
  /* Voice */
  const [chatMode, setChatMode]     = useState('text')
  const [listening, setListening]   = useState(false)
  const [speakingId, setSpeakingId] = useState(null)
  const recognizerRef    = useRef(null)
  const lastReplyTsRef   = useRef(null)

  const t = TEXT[lang]
  const personality = personalityKey ? PERSONALITIES[personalityKey] : null
  const accent = personality?.accent || '#ef4444'
  const streak = calculateStreak(sessions)

  /* Persist sessions + lang */
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setSessions(JSON.parse(saved))
    const savedLang = localStorage.getItem(LANG_KEY)
    if (savedLang) setLang(savedLang)
  }, [])
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)) }, [sessions])
  useEffect(() => { localStorage.setItem(LANG_KEY, lang) }, [lang])

  /* Persist chats per personality */
  useEffect(() => {
    const saved = localStorage.getItem(CHATS_KEY)
    if (saved) { try { setChatMessages(JSON.parse(saved)) } catch {} }
  }, [])
  useEffect(() => { localStorage.setItem(CHATS_KEY, JSON.stringify(chatMessages)) }, [chatMessages])

  /* Pre-load TTS voices once */
  useEffect(() => { if (TTS_SUPPORTED) loadVoices() }, [])

  /* Refresh open-goal count when entering Home or after Goals tab activity */
  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem(GOALS_KEY) || '[]')
      setOpenGoalsCount(list.filter(g => !g.done).length)
    } catch {
      setOpenGoalsCount(0)
    }
  }, [tab])

  /* Stop any speech / mic when leaving chat */
  useEffect(() => {
    if (step !== 'chat') {
      stopSpeaking()
      recognizerRef.current?.abort()
      setListening(false)
      setSpeakingId(null)
    }
  }, [step])

  /* In voice mode, auto-play newest sensei reply via Gemini TTS (fallback to browser) */
  useEffect(() => {
    if (step !== 'chat' || chatMode !== 'voice' || !personalityKey) return
    const msgs = chatMessages[personalityKey] || []
    const last = msgs[msgs.length - 1]
    if (!last || last.role !== 'model' || last.ts === lastReplyTsRef.current) return
    lastReplyTsRef.current = last.ts
    setSpeakingId(last.ts)
    speak(last.text, personalityKey, lang, {
      onEnd:   () => setSpeakingId((id) => (id === last.ts ? null : id)),
      onError: (err) => {
        setSpeakingId((id) => (id === last.ts ? null : id))
        const msg = err?.message || ''
        if (msg) showToast(lang === 'jp' ? `音声エラー：${msg}` : `Voice error: ${msg}`)
      },
    })
  }, [chatMessages, personalityKey, chatMode, step, lang])

  /* Sync accent CSS variable */
  useEffect(() => {
    const hex = accent.replace('#','')
    const r = parseInt(hex.slice(0,2),16)
    const g = parseInt(hex.slice(2,4),16)
    const b = parseInt(hex.slice(4,6),16)
    document.documentElement.style.setProperty('--accent', accent)
    document.documentElement.style.setProperty('--accent-rgb', `${r},${g},${b}`)
  }, [accent])

  const showToast = (msg) => {
    setToast({ msg, out: false })
    setTimeout(() => setToast(t => t ? { ...t, out: true } : null), 2200)
    setTimeout(() => setToast(null), 2600)
  }

  const goWork = (key) => {
    setFading(true)
    setTimeout(() => { setPersonalityKey(key); setStep('work'); setFading(false) }, 180)
  }
  const goPick = () => {
    setFading(true); setRoast('')
    setTimeout(() => { setStep('pick'); setFading(false) }, 180)
  }

  /* ── CHAT ── */
  const goChat = () => {
    if (!personalityKey) return
    const existing = chatMessages[personalityKey] || []
    if (existing.length === 0 && roast && sessions[0]) {
      const s = sessions[0]
      const seedUser = lang === 'jp'
        ? `科目：${s.subject}\n時間：${s.duration}分${s.notes ? `\nメモ：${s.notes}` : ''}`
        : `Subject: ${s.subject}\nDuration: ${s.duration} min${s.notes ? `\nNotes: ${s.notes}` : ''}`
      setChatMessages(prev => ({
        ...prev,
        [personalityKey]: [
          { role: 'user',  text: seedUser, ts: Date.now() - 1 },
          { role: 'model', text: s.roast,  ts: Date.now() },
        ],
      }))
    }
    setFading(true)
    setTimeout(() => { setStep('chat'); setFading(false) }, 180)
  }
  const goBackToWork = () => {
    setFading(true)
    setTimeout(() => { setStep('work'); setFading(false) }, 180)
  }

  const _sendChatCore = async (text, current) => {
    const updated = [...current, { role: 'user', text, ts: Date.now() }]
    setChatMessages(prev => ({ ...prev, [personalityKey]: updated }))
    setChatSending(true)
    try {
      const systemPrompt =
        personality.prompt[lang] +
        buildContextString(sessions, lang) +
        CHAT_MODE_ADDON[lang]
      const response = await callGemini({
        model: 'gemini-2.5-flash',
        contents: toGeminiContents(updated),
        config: { systemInstruction: systemPrompt },
      })
      const replyText = safeResponseText(response)
      if (!replyText) throw new Error('Empty response from model')
      setChatMessages(prev => ({
        ...prev,
        [personalityKey]: [...updated, { role: 'model', text: replyText, ts: Date.now() }],
      }))
    } catch (err) {
      console.error('Chat error:', err)
      showToast(formatGeminiError(err, lang))
      setChatMessages(prev => ({ ...prev, [personalityKey]: current }))
      setChatInput(text)
    } finally {
      setChatSending(false)
    }
  }

  const sendChatMessage = () => {
    const text = chatInput.trim()
    if (!text || chatSending || !personality) return
    setChatInput('')
    _sendChatCore(text, chatMessages[personalityKey] || [])
  }

  const resetCurrentChat = () => {
    setChatMessages(prev => {
      const next = { ...prev }
      delete next[personalityKey]
      return next
    })
    setConfirmClearChat(false)
    lastReplyTsRef.current = null
    stopSpeaking()
    setSpeakingId(null)
  }

  /* ── VOICE ── */
  const startListening = () => {
    if (!SR_SUPPORTED) { showToast(t.voiceUnsupported); return }
    if (chatSending) return
    unlockAudio()  // prime TTS pipeline within user gesture
    stopSpeaking()
    setSpeakingId(null)
    let finalText = ''
    const rec = createRecognizer(lang, {
      onStart:  () => setListening(true),
      onResult: (text, isFinal) => {
        setChatInput(text)
        if (isFinal) finalText = text
      },
      onEnd: () => {
        setListening(false)
        recognizerRef.current = null
        const toSend = (finalText || '').trim()
        if (toSend) {
          setChatInput('')
          _sendChatCore(toSend, chatMessages[personalityKey] || [])
        }
      },
      onError: (e) => {
        setListening(false)
        recognizerRef.current = null
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
          showToast(t.micUnavailable)
        }
      },
    })
    if (!rec) { showToast(t.voiceUnsupported); return }
    recognizerRef.current = rec
    rec.start()
  }
  const stopListening = () => recognizerRef.current?.stop()

  const toggleSpeakMessage = (msg) => {
    if (!TTS_SUPPORTED || !personalityKey) {
      showToast(lang === 'jp' ? '音声再生に対応していないブラウザや' : 'Audio playback not supported here')
      return
    }
    if (speakingId === msg.ts) {
      stopSpeaking()
      setSpeakingId(null)
      return
    }
    unlockAudio()  // user-gesture audio unlock
    setSpeakingId(msg.ts)
    speak(msg.text, personalityKey, lang, {
      onEnd:   () => setSpeakingId((id) => (id === msg.ts ? null : id)),
      onError: () => setSpeakingId((id) => (id === msg.ts ? null : id)),
    })
  }

  const handleSubmit = async () => {
    if (!subject || !duration) { showToast(t.fillIn); return }
    setLoading(true); setRoast('')
    try {
      const userMsg = `Subject: ${subject}\nDuration: ${duration} minutes\nNotes: ${notes || '(none)'}`
      const systemPrompt = personality.prompt[lang] + buildContextString(sessions, lang)
      const response = await callGemini({
        model: 'gemini-2.5-flash',
        contents: userMsg,
        config: { systemInstruction: systemPrompt },
      })
      const aiRoast = safeResponseText(response)
      if (!aiRoast) throw new Error('Empty response from model')
      setRoast(aiRoast)
      setSessions(prev => [{
        id: Date.now(), subject, duration, notes, roast: aiRoast,
        personalityKey, timestamp: new Date().toISOString(),
      }, ...prev])
      setSubject(''); setDuration(''); setNotes('')
      showToast(lang === 'jp' ? 'セッション保存したで' : 'Session saved')
    } catch (err) {
      console.error('Gemini error:', err)
      setRoast(formatGeminiError(err, lang))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (id) => setSessions(s => s.filter(x => x.id !== id))

  const focusStyle = { borderColor: `${accent}60`, boxShadow: `0 0 0 3px ${accent}18` }
  const blurStyle  = { borderColor: 'rgba(255,255,255,0.08)', boxShadow: 'none' }

  return (
    <>
      <BgLayers accent={accent} />

      <div style={{ position: 'relative', zIndex: 2, minHeight: '100dvh',
        opacity: fading ? 0 : 1, transition: 'opacity 0.18s ease' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px' }}>

          {/* NAV */}
          <nav className="anim-fadein" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '26px 0 30px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: `linear-gradient(135deg, ${accent}, ${accent}99)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 14px -4px ${accent}80`,
                transition: 'background 0.6s, box-shadow 0.6s',
              }}>
                <Flame size={14} color="white" />
              </div>
              <span className="font-display" style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                Savage Sensei
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {streak > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 11px', borderRadius: 999,
                  background: `${accent}14`, border: `1px solid ${accent}28`,
                  transition: 'all 0.6s',
                }}>
                  <Flame size={11} color={accent} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>
                    {streak} {t.streak}
                  </span>
                </div>
              )}
              <button onClick={() => setShowInfo(true)} aria-label="About" style={{
                width: 32, height: 32, borderRadius: 9,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(148,163,184,0.55)', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}40`; e.currentTarget.style.color = accent }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(148,163,184,0.55)' }}>
                <Info size={14} />
              </button>
              <div style={{
                display: 'flex', background: 'rgba(255,255,255,0.04)',
                borderRadius: 8, padding: 3, border: '1px solid rgba(255,255,255,0.07)',
              }}>
                {['en', 'jp'].map(l => (
                  <button key={l} onClick={() => setLang(l)} style={{
                    padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', fontFamily: 'inherit',
                    background: lang === l ? accent : 'transparent',
                    color: lang === l ? 'white' : 'rgba(148,163,184,0.65)',
                    transition: 'all 0.18s',
                  }}>
                    {l === 'en' ? 'EN' : '日本語'}
                  </button>
                ))}
              </div>
            </div>
          </nav>

          {/* ── LOG TAB ── */}
          {tab === 'log' && <>
          {/* ── PICK ── */}
          {step === 'pick' && (
            <>
              <div style={{ marginBottom: 36, textAlign: 'center', '--shimmer': accent }}>
                <h1 className="font-display hero-title" style={{
                  fontSize: 'clamp(38px,8vw,58px)', fontWeight: 700,
                  lineHeight: 1.05, marginBottom: 14, whiteSpace: 'pre-line',
                }}>{t.title}</h1>
                <p className="hero-tagline" style={{
                  fontSize: 15, color: 'rgba(148,163,184,0.7)',
                  lineHeight: 1.65, maxWidth: 380, whiteSpace: 'pre-line',
                  margin: '0 auto',
                }}>
                  {t.tagline}
                </p>
              </div>

              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em',
                  color: 'rgba(148,163,184,0.45)', textTransform: 'uppercase', marginBottom: 12 }}>
                  {t.chooseTormentor}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(PERSONALITIES).map(([key, p], i) => {
                    const greet = getGreeting(key, sessions, openGoalsCount, lang)
                    return (
                      <button key={key} onClick={() => goWork(key)} className={`persona-card stagger-${i+1}`} style={{
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 12, overflow: 'visible', cursor: 'pointer',
                        textAlign: 'left', padding: 0, display: 'flex',
                        animation: `fadeUp 0.45s cubic-bezier(.16,1,.3,1) both`,
                        position: 'relative',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = `${p.accent}45`; e.currentTarget.style.boxShadow = `0 8px 28px -10px ${p.accent}40` }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none' }}>
                        {/* Hover tooltip — sits outside clipped content */}
                        <span className="sensei-card-tip" style={{ borderColor: `${p.accent}40` }}>
                          {p.description[lang]}
                        </span>
                        {/* Inner clipping wrapper so border-radius is respected */}
                        <span style={{ display: 'flex', flex: 1, borderRadius: 11, overflow: 'hidden' }}>
                        {/* Color strip on left edge */}
                        <div style={{ width: 3, background: p.accent, flexShrink: 0 }} />
                        {/* Avatar */}
                        <div style={{
                          width: 64, height: 64, flexShrink: 0,
                          position: 'relative', overflow: 'hidden', background: '#060810',
                        }}>
                          <img src={p.image} alt={p.label[lang]} style={{
                            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                          }} />
                          <div style={{ position: 'absolute', inset: 0,
                            background: `linear-gradient(to right, transparent, ${p.accentDark}80)` }} />
                        </div>
                        {/* Body */}
                        <div style={{
                          flex: 1, padding: '10px 14px',
                          display: 'flex', flexDirection: 'column', justifyContent: 'center',
                          gap: 3, minWidth: 0,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span className="font-display" style={{ fontSize: 13.5, fontWeight: 700, color: '#f1f5f9' }}>
                              {p.label[lang]}
                            </span>
                            <span style={{
                              fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em',
                              color: p.accent, padding: '2px 6px', borderRadius: 3,
                              background: `${p.accent}14`, border: `1px solid ${p.accent}33`,
                            }}>{p.tag}</span>
                          </div>
                          <div style={{
                            fontSize: 11.5, color: 'rgba(203,213,225,0.7)',
                            lineHeight: 1.45, fontStyle: 'italic',
                            overflow: 'hidden', display: '-webkit-box',
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          }}>
                            "{greet}"
                          </div>
                        </div>
                        {/* Arrow */}
                        <div style={{
                          display: 'flex', alignItems: 'center', paddingRight: 14,
                          color: p.accent, fontSize: 16, fontWeight: 600, flexShrink: 0,
                        }}>→</div>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Stats — expandable */}
              {sessions.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
                  <ExpandableStatCard
                    kind="streak"
                    accent={accent}
                    sessions={sessions}
                    streak={streak}
                    lang={lang}
                    label={t.streak}
                  />
                  <ExpandableStatCard
                    kind="sessions"
                    accent={accent}
                    sessions={sessions}
                    streak={streak}
                    lang={lang}
                    label={t.sessions}
                  />
                </div>
              )}

              {/* History */}
              {sessions.length > 0 && (
                <HistSection sessions={sessions} t={t} expanded={histExpanded}
                  setExpanded={setHistExpanded} onDelete={handleDelete}
                  onClear={() => setConfirmClear(true)} />
              )}

              {sessions.length === 0 && (
                <div className="anim-fadein" style={{ textAlign: 'center', padding: '48px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.2 }}>🥋</div>
                  <div className="font-display" style={{ fontWeight: 700, fontSize: 15, color: '#64748b', marginBottom: 6 }}>{t.emptyTitle}</div>
                  <div style={{ fontSize: 13, color: 'rgba(100,116,139,0.6)' }}>{t.emptyText}</div>
                </div>
              )}
            </>
          )}

          {/* ── WORK ── */}
          {step === 'work' && personality && (
            <>
              {/* Sensei bar */}
              <div className="anim-fadeup" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderRadius: 12, marginBottom: 18,
                background: `${accent}0c`, border: `1px solid ${accent}22`, transition: 'all 0.6s',
              }}>
                <button onClick={goPick} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(148,163,184,0.65)', fontSize: 13, fontWeight: 500,
                  fontFamily: 'inherit', transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.65)'}>
                  <ArrowLeft size={14} /> {t.back}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={goChat} title={t.askSensei} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 11px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${accent}33`,
                    background: `${accent}10`, color: accent,
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    fontFamily: 'inherit', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${accent}1f`; e.currentTarget.style.borderColor = `${accent}55` }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${accent}10`; e.currentTarget.style.borderColor = `${accent}33` }}>
                    <MessageCircle size={12} />
                    {t.askSensei}
                  </button>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.4)',
                      letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
                      {t.activeSensei}
                    </div>
                    <div className="font-display" style={{ fontSize: 13, fontWeight: 700, color: accent, transition: 'color 0.6s' }}>
                      {personality.label[lang]}
                    </div>
                  </div>
                  <div style={{
                    position: 'relative', width: 38, height: 38, flexShrink: 0,
                  }}>
                    <span className="sensei-halo" style={{ background: accent }} />
                    <div style={{
                      position: 'relative', width: 38, height: 38, borderRadius: 10,
                      overflow: 'hidden', border: `2px solid ${accent}`,
                      boxShadow: `0 0 12px ${accent}55`,
                    }}>
                      <img src={personality.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className="anim-fadeup work-form" style={{
                '--ac': accent, '--ac-bg': `${accent}1f`,
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16, padding: '26px 24px 22px', marginBottom: 18,
              }}>
                {/* Personality motto / battle-cry */}
                <div className="sensei-motto" style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18,
                  paddingBottom: 14, borderBottom: `1px dashed ${accent}26`,
                }}>
                  <Sparkles size={11} color={accent} />
                  <span style={{
                    fontSize: 11, fontStyle: 'italic',
                    color: 'rgba(203,213,225,0.75)', lineHeight: 1.5,
                  }}>
                    {getGreeting(personalityKey, sessions, openGoalsCount, lang)}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em',
                      color: 'rgba(148,163,184,0.45)', textTransform: 'uppercase', marginBottom: 8 }}>{t.subject}</div>
                    <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                      placeholder={t.subjectPh} className="input-field"
                      onFocus={e => Object.assign(e.target.style, focusStyle)}
                      onBlur={e => Object.assign(e.target.style, blurStyle)} />
                    {/* Recent subject chips */}
                    {(() => {
                      const recentSubjects = [...new Set(sessions.map(s => s.subject))].filter(Boolean).slice(0, 4)
                      if (!recentSubjects.length) return null
                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                          {recentSubjects.map(s => (
                            <button key={s} type="button"
                              onClick={() => setSubject(s)}
                              className={`chip${subject === s ? ' active' : ''}`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em',
                      color: 'rgba(148,163,184,0.45)', textTransform: 'uppercase', marginBottom: 8 }}>{t.duration}</div>
                    <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                      placeholder={t.durationPh} className="input-field"
                      onFocus={e => Object.assign(e.target.style, focusStyle)}
                      onBlur={e => Object.assign(e.target.style, blurStyle)} />
                  </div>
                </div>

                {/* Quick-fill duration chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
                  {[15, 30, 45, 60, 90].map(m => (
                    <button key={m} type="button"
                      onClick={() => setDuration(String(m))}
                      className={`chip${duration === String(m) ? ' active' : ''}`}>
                      {m}m
                    </button>
                  ))}
                </div>

                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em',
                    color: 'rgba(148,163,184,0.45)', textTransform: 'uppercase', marginBottom: 8 }}>{t.notes}</div>
                  <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder={t.notesPh} className="input-field"
                    onFocus={e => Object.assign(e.target.style, focusStyle)}
                    onBlur={e => Object.assign(e.target.style, blurStyle)} />
                </div>
                <button onClick={handleSubmit} disabled={loading}
                  className={`btn-primary${!loading && subject && duration ? ' cta-shimmer' : ''}`}
                  style={{ background: loading ? `${accent}70` : accent, boxShadow: loading ? 'none' : `0 6px 24px -6px ${accent}70` }}>
                  {loading ? (
                    <>
                      <Loader2 size={14} style={{ animation: 'spinAnim 1s linear infinite' }} />
                      <span>{t.thinking}</span>
                      <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                    </>
                  ) : (
                    <><Send size={14} /><span>{t.roastMe}</span></>
                  )}
                </button>
              </div>

              {/* Skeleton */}
              {loading && !roast && (
                <div className="anim-fadein" style={{
                  borderRadius: 14, overflow: 'hidden', display: 'flex', minHeight: 180,
                  border: '1px solid rgba(255,255,255,0.06)', marginBottom: 18,
                }}>
                  <div style={{ width: '36%', flexShrink: 0 }} className="skeleton" />
                  <div style={{ flex: 1, padding: '24px 22px', display: 'flex', flexDirection: 'column',
                    gap: 10, justifyContent: 'center', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="skeleton" style={{ height: 10, width: '38%' }} />
                    <div className="skeleton" style={{ height: 9, width: '90%', marginTop: 6 }} />
                    <div className="skeleton" style={{ height: 9, width: '80%' }} />
                    <div className="skeleton" style={{ height: 9, width: '62%' }} />
                  </div>
                </div>
              )}

              {roast && !loading && (
                <div style={{ marginBottom: 18 }}>
                  <RoastPanel roast={roast} personality={personality} t={t} lang={lang} accent={accent} onContinue={goChat} />
                </div>
              )}

              {!roast && !loading && sessions.length === 0 && (
                <div className="anim-fadein" style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 36, opacity: 0.18, marginBottom: 10 }}>🔥</div>
                  <div className="font-display" style={{ fontWeight: 700, fontSize: 14, color: '#64748b', marginBottom: 5 }}>{t.emptyTitle}</div>
                  <div style={{ fontSize: 12, color: 'rgba(100,116,139,0.55)' }}>{t.emptyText}</div>
                </div>
              )}

              {sessions.length > 0 && (
                <div style={{ marginTop: 36 }}>
                  <HistSection sessions={sessions} t={t} expanded={histExpanded}
                    setExpanded={setHistExpanded} onDelete={handleDelete}
                    onClear={() => setConfirmClear(true)} />
                </div>
              )}
            </>
          )}

          {/* ── CHAT (per-personality consultation) ── */}
          {step === 'chat' && personality && (
            <ChatView
              personality={personality}
              accent={accent} lang={lang} t={t}
              messages={chatMessages[personalityKey] || []}
              input={chatInput} setInput={setChatInput}
              sending={chatSending}
              onSend={sendChatMessage}
              onBack={goBackToWork}
              onSwitchSensei={goPick}
              onClear={() => setConfirmClearChat(true)}
              mode={chatMode} setMode={setChatMode}
              listening={listening}
              onStartListening={startListening}
              onStopListening={stopListening}
              speakingId={speakingId}
              onToggleSpeak={toggleSpeakMessage}
            />
          )}
          </>}

          {/* ── ASK TAB ── */}
          {tab === 'ask' && (
            <>
              <div className="anim-fadeup" style={{ marginBottom: 20 }}>
                <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                  {lang === 'jp' ? '先生に聞く' : 'Ask Your Sensei'}
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)' }}>
                  {lang === 'jp'
                    ? `AIアシスタントが${sessions.length}件のセッション全てを把握してる。`
                    : `Your AI assistant has full context of all ${sessions.length} sessions.`}
                </p>
              </div>
              <AskAITab
                sessions={sessions} accent={accent} lang={lang} 
                chatMessages={chatMessages}
                setChatMessages={setChatMessages}
                openFullChat={(key) => {
                  setPersonalityKey(key)
                  setStep('chat')
                  setTab('log')
                }}
              />
            </>
          )}

          {/* ── GOALS TAB ── */}
          {tab === 'goals' && (
            <>
              <div className="anim-fadeup" style={{ marginBottom: 16 }}>
                <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                  {lang === 'jp' ? '目標とクイズ' : 'Goals & Quiz'}
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)' }}>
                  {lang === 'jp'
                    ? '目標を追跡したり、自分の知識をクイズで試したり。'
                    : 'Track your future targets — or test the knowledge you\'ve logged so far.'}
                </p>
              </div>
              {/* Inner tab toggle */}
              <div className="anim-fadeup" style={{
                display: 'inline-flex', background: 'rgba(255,255,255,0.04)',
                borderRadius: 10, padding: 3, border: '1px solid rgba(255,255,255,0.07)',
                marginBottom: 18,
              }}>
                {[
                  { id: 'goals', label: lang === 'jp' ? '目標' : 'Goals',  icon: Target },
                  { id: 'quiz',  label: lang === 'jp' ? 'クイズ' : 'Quiz', icon: Brain  },
                ].map(it => {
                  const Icon = it.icon
                  const active = goalsSubTab === it.id
                  return (
                    <button key={it.id} onClick={() => setGoalsSubTab(it.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                      background: active ? accent : 'transparent',
                      color: active ? 'white' : 'rgba(148,163,184,0.65)',
                      transition: 'all 0.18s',
                    }}>
                      <Icon size={13} />
                      {it.label}
                    </button>
                  )
                })}
              </div>
              {goalsSubTab === 'goals'
                ? <GoalsTab accent={accent} sessions={sessions} lang={lang} />
                : <QuizTab accent={accent} sessions={sessions} lang={lang}  />}
            </>
          )}

          {/* ── STATS TAB ── */}
          {tab === 'stats' && (
            <>
              <div className="anim-fadeup" style={{ marginBottom: 20 }}>
                <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                  {lang === 'jp' ? 'あなたの進捗' : 'Your Progress'}
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)' }}>
                  {lang === 'jp'
                    ? `${sessions.length}件のセッションから見える学習パターン。`
                    : `Study patterns across ${sessions.length} sessions.`}
                </p>
              </div>
              <StatsTab sessions={sessions} accent={accent} lang={lang} />
            </>
          )}

          <div style={{ padding: '40px 0 28px', textAlign: 'center',
            fontSize: 11, color: 'rgba(100,116,139,0.4)' }}>
            Savage Sensei · React + Gemini · {new Date().getFullYear()}
          </div>
        </div>
      </div>

      {/* BOTTOM TAB BAR */}
      <nav className="tab-bar" style={{ '--tab-accent': accent }}>
        {[
          { id: 'log',   icon: Home,          label: lang === 'jp' ? 'ホーム' : 'Home' },
          { id: 'ask',   icon: MessageCircle, label: lang === 'jp' ? '質問'   : 'Ask' },
          { id: 'goals', icon: Target,        label: lang === 'jp' ? '目標'   : 'Goals' },
          { id: 'stats', icon: BarChart3,     label: lang === 'jp' ? '統計'   : 'Stats' },
        ].map(tb => {
          const Icon = tb.icon
          return (
            <button key={tb.id}
              className={`tab-btn${tab === tb.id ? ' active' : ''}`}
              onClick={() => setTab(tb.id)}>
              <Icon size={18} strokeWidth={2} />
              <span>{tb.label}</span>
            </button>
          )
        })}
      </nav>

      {/* INFO MODAL */}
      {showInfo && <InfoModal onClose={() => setShowInfo(false)} accent={accent} lang={lang} />}

      {/* Confirm clear */}
      {confirmClear && (
        <div onClick={() => setConfirmClear(false)} className="anim-fadein" style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(14px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} className="anim-fadeup" style={{
            background: '#0c0f18', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: 24, maxWidth: 380, width: '100%',
            boxShadow: '0 40px 80px rgba(0,0,0,0.7)',
          }}>
            <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={15} color="#ef4444" />
              </div>
              <div>
                <div className="font-display" style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9', marginBottom: 6 }}>
                  {lang === 'jp' ? '本当に削除する？' : 'Delete all sessions?'}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(148,163,184,0.65)', lineHeight: 1.55 }}>
                  {t.confirmClear}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmClear(false)} style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)', color: 'rgba(148,163,184,0.8)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t.cancel}</button>
              <button onClick={() => { setSessions([]); setConfirmClear(false) }} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', background: '#ef4444',
                color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t.clearAll}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm clear chat */}
      {confirmClearChat && (
        <div onClick={() => setConfirmClearChat(false)} className="anim-fadein" style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(14px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} className="anim-fadeup" style={{
            background: '#0c0f18', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: 24, maxWidth: 380, width: '100%',
            boxShadow: '0 40px 80px rgba(0,0,0,0.7)',
          }}>
            <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}14`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <RotateCcw size={15} color={accent} />
              </div>
              <div>
                <div className="font-display" style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9', marginBottom: 6 }}>
                  {t.clearChat}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(148,163,184,0.65)', lineHeight: 1.55 }}>
                  {t.confirmClearChat}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmClearChat(false)} style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)', color: 'rgba(148,163,184,0.8)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t.cancel}</button>
              <button onClick={resetCurrentChat} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', background: accent,
                color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t.clearChat}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={toast.out ? 'toast-exit' : 'toast-enter'} style={{
          position: 'fixed', bottom: 28, left: '50%', zIndex: 999,
          background: 'rgba(10,13,22,0.96)', backdropFilter: 'blur(18px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999,
          padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, color: '#f1f5f9', fontWeight: 500,
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
          {toast.msg}
        </div>
      )}
    </>
  )
}

/* ─── HISTORY SECTION ────────────────────────────────────────────── */
function HistSection({ sessions, t, expanded, setExpanded, onDelete, onClear }) {
  const visible = expanded ? sessions : sessions.slice(0, 3)
  return (
    <div className="anim-fadeup">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScrollText size={14} color="rgba(148,163,184,0.4)" />
          <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: '#cbd5e1' }}>{t.history}</span>
          <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.35)', fontWeight: 600 }}>({sessions.length})</span>
        </div>
        <button onClick={onClear} style={{
          display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
          cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'rgba(148,163,184,0.35)', fontFamily: 'inherit', transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.35)'}>
          <Trash2 size={11} /> {t.clearAll}
        </button>
      </div>
      <div style={{ borderRadius: 12, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)' }}>
        {visible.map((s, i) => (
          <div key={s.id}>
            <HistoryItem session={s} t={t} onDelete={onDelete} />
            {i < visible.length - 1 && (
              <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '0 14px' }} />
            )}
          </div>
        ))}
      </div>
      {sessions.length > 3 && (
        <button onClick={() => setExpanded(v => !v)} style={{
          marginTop: 6, width: '100%', padding: '9px', background: 'none',
          border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
          color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#94a3b8' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}>
          {expanded ? t.showLess : t.showMore(sessions.length - 3)}
        </button>
      )}
    </div>
  )
}

/* ─── EXPANDABLE STAT CARD ────────────────────────────────── */
function ExpandableStatCard({ kind, accent, sessions, streak, lang, label }) {
  const [open, setOpen] = useState(false)
  const isStreak = kind === 'streak'
  const value = isStreak ? streak : sessions.length
  const Icon  = isStreak ? Flame : BookOpen
  const tint  = isStreak ? accent : 'rgba(148,163,184,0.6)'

  // Compute expanded content
  let body = null
  if (isStreak) {
    // Last 7 days breakdown
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0)
      const key = d.toISOString().split('T')[0]
      const studied = sessions.some(s => s.timestamp.startsWith(key))
      const wd = d.toLocaleDateString(lang === 'jp' ? 'ja-JP' : 'en-US', { weekday: 'short' })
      days.push({ wd, studied })
    }
    // Best streak ever — rough computation: longest run of consecutive distinct days
    const allDays = [...new Set(sessions.map(s => new Date(s.timestamp).toISOString().split('T')[0]))].sort()
    let best = 0, run = 0, prev = null
    for (const d of allDays) {
      if (prev) {
        const diff = Math.round((new Date(d) - new Date(prev)) / 86400000)
        run = diff === 1 ? run + 1 : 1
      } else run = 1
      if (run > best) best = run
      prev = d
    }
    body = (
      <>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.45)', marginBottom: 8 }}>
          {lang === 'jp' ? '直近7日間' : 'Last 7 days'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, marginBottom: 12 }}>
          {days.map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                width: '100%', aspectRatio: '1/1', borderRadius: 6,
                background: d.studied ? accent : 'rgba(255,255,255,0.04)',
                boxShadow: d.studied ? `0 2px 10px -3px ${accent}80` : 'none',
                marginBottom: 4, transition: 'all 0.3s',
              }} />
              <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', fontWeight: 600 }}>{d.wd}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(148,163,184,0.6)' }}>
          <span>{lang === 'jp' ? '最長連続記録' : 'Best streak'}</span>
          <span style={{ color: accent, fontWeight: 700 }}>{best} {lang === 'jp' ? '日' : 'days'}</span>
        </div>
      </>
    )
  } else {
    // Sessions: top 3 subjects + total minutes
    const subj = {}
    sessions.forEach(s => { subj[s.subject] = (subj[s.subject] || 0) + parseInt(s.duration || 0, 10) })
    const top = Object.entries(subj).sort((a,b) => b[1]-a[1]).slice(0, 3)
    const total = Object.values(subj).reduce((a,b) => a+b, 0)
    body = (
      <>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.45)', marginBottom: 10 }}>
          {lang === 'jp' ? '上位科目' : 'Top subjects'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
          {top.map(([s, m]) => (
            <div key={s} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#e2e8f0' }}>{s}</span>
              <span style={{ color: 'rgba(148,163,184,0.6)' }}>{m}m</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(148,163,184,0.6)' }}>
          <span>{lang === 'jp' ? '総学習時間' : 'Total studied'}</span>
          <span style={{ color: accent, fontWeight: 700 }}>{total}m</span>
        </div>
      </>
    )
  }

  return (
    <button
      onClick={() => setOpen(v => !v)}
      style={{
        gridColumn: open ? '1 / -1' : 'auto',
        padding: 0, borderRadius: 12,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${open ? `${accent}33` : 'rgba(255,255,255,0.06)'}`,
        cursor: 'pointer', textAlign: 'left',
        fontFamily: 'inherit', color: 'inherit',
        overflow: 'hidden', transition: 'border-color 0.2s, grid-column 0.3s',
      }}
      aria-expanded={open}>
      <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: `${tint}14`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} color={tint} strokeWidth={2.5} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc', lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.45)', marginTop: 4, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
        </div>
        <div style={{ color: 'rgba(148,163,184,0.4)', display: 'flex', alignItems: 'center' }}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>
      {open && (
        <div className="anim-fadein" style={{ padding: '0 18px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 14 }}>
          {body}
        </div>
      )}
    </button>
  )
}

/* ─── INFO MODAL ──────────────────────────────────────────── */
function InfoModal({ onClose, accent, lang }) {
  const copy = lang === 'jp' ? {
    subtitle: 'あなた専用のAI学習・ワークフローアシスタント',
    intro: 'Savage Senseiは、あなたの学習やワークフローを記録する個人AIトラッカー。何をやったかを記録し、容赦のない見立てをもらい、進捗を積み上げよう。',
    cta: '始めよう →',
    features: [
      { icon: 'log',    title: 'セッション記録', desc: '科目・時間・メモを記録。AIの先生が（愛をこめて）厳しく評価。' },
      { icon: 'msg',    title: '履歴に質問',     desc: 'AIに過去のセッションについて自由に質問。傾向も弱点もお見通し。' },
      { icon: 'target', title: '目標管理',       desc: '将来の目標やタスクを設定。完了状況と学習時間がリンク。' },
      { icon: 'chart',  title: '可視化',         desc: '日別バーチャートと科目別内訳で、自分の使い方が一目で分かる。' },
    ],
  } : {
    subtitle: 'Your AI Study & Workflow Assistant',
    intro: 'Savage Sensei is a personal AI tracking assistant for your study and workflow sessions. Log what you worked on, get brutally honest feedback, and watch your progress stack up over time.',
    cta: "Let's go →",
    features: [
      { icon: 'log',    title: 'Session Logging', desc: 'Record your study sessions with subject, duration, and notes. Your AI sensei roasts your effort (lovingly).' },
      { icon: 'msg',    title: 'Ask Your History', desc: 'Ask the AI anything about your past sessions — patterns, weak spots, what to study next. It has full context.' },
      { icon: 'target', title: 'Goal Tracking',   desc: 'Set future goals and tasks. Track completion progress and see how your study time connects to your targets.' },
      { icon: 'chart',  title: 'Visual Stats',    desc: "Daily bar charts and subject breakdowns show exactly where you're spending your time and how consistent you are." },
    ],
  }
  const iconMap = { log: BookOpen, msg: MessageCircle, target: Target, chart: BarChart3 }
  return (
    <div onClick={onClose} className="anim-fadein" style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,.78)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} className="anim-fadeup" style={{
        background: '#0c0f18', border: '1px solid rgba(255,255,255,.1)',
        borderRadius: 20, padding: 0, maxWidth: 420, width: '100%',
        boxShadow: '0 40px 80px rgba(0,0,0,.7)', overflow: 'hidden',
      }}>
        <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid rgba(255,255,255,.07)', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 6px 20px -6px ${accent}80`,
            }}>
              <Flame size={18} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>Savage Sensei</div>
              <div style={{ fontSize: 11, color: 'rgba(148,163,184,.5)', marginTop: 1 }}>{copy.subtitle}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            position: 'absolute', top: 20, right: 20,
            background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 8,
            cursor: 'pointer', width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(148,163,184,.6)',
          }}>
            <X size={13} />
          </button>
        </div>
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13.5, color: 'rgba(203,213,225,.8)', lineHeight: 1.75 }}>{copy.intro}</p>
          {copy.features.map(f => {
            const Icon = iconMap[f.icon]
            return (
              <div key={f.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9, background: `${accent}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={15} color={accent} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 3 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(148,163,184,.6)', lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              </div>
            )
          })}
          <button onClick={onClose} style={{
            marginTop: 4, width: '100%', padding: '12px',
            borderRadius: 10, background: accent, color: 'white',
            border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
            boxShadow: `0 6px 24px -6px ${accent}70`,
          }}>{copy.cta}</button>
        </div>
      </div>
    </div>
  )
}

/* ─── STATS TAB ───────────────────────────────────────────── */
function StatsTab({ sessions, accent, lang }) {
  if (!sessions.length) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(148,163,184,.4)', fontSize: 14 }}>
        {lang === 'jp' ? 'まだセッションがあらへん。記録したら統計が出るで。' : 'No sessions yet. Log some sessions to see your stats.'}
      </div>
    )
  }
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
    const key = d.toISOString().split('T')[0]
    const label = d.toLocaleDateString(lang === 'jp' ? 'ja-JP' : 'en-US', { weekday: 'short' })
    const mins = sessions.filter(s => s.timestamp.startsWith(key)).reduce((a, s) => a + parseInt(s.duration || 0, 10), 0)
    days.push({ label, mins, key })
  }
  const maxMins = Math.max(...days.map(d => d.mins), 1)

  const subjects = {}
  sessions.forEach(s => {
    subjects[s.subject] = (subjects[s.subject] || 0) + parseInt(s.duration || 0, 10)
  })
  const totalMins = Object.values(subjects).reduce((a, b) => a + b, 0)
  const subjectList = Object.entries(subjects).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const subColors = ['#ef4444', '#f59e0b', '#38bdf8', '#a78bfa', '#34d399', '#f97316']

  const totalSessions = sessions.length
  const avgMins = totalMins / totalSessions | 0

  const labels = lang === 'jp'
    ? { total: '総時間', avg: '平均', sessions: 'セッション数', allTime: '通算', perSession: '1回あたり', logged: '記録済み', daily: '日別学習（直近7日間）', breakdown: '科目別内訳' }
    : { total: 'Total Time', avg: 'Avg Session', sessions: 'Sessions', allTime: 'all time', perSession: 'per session', logged: 'logged', daily: 'Daily Study (last 7 days)', breakdown: 'Subject Breakdown' }

  return (
    <div className="anim-fadeup">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
        {[
          { label: labels.total,    value: `${totalMins}m`, sub: labels.allTime },
          { label: labels.avg,      value: `${avgMins}m`,   sub: labels.perSession },
          { label: labels.sessions, value: totalSessions,   sub: labels.logged },
        ].map(s => (
          <div key={s.label} style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
            <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,.45)', marginTop: 5 }}>{s.label}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(148,163,184,.3)', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '20px 20px 16px', borderRadius: 14, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,.45)', marginBottom: 18 }}>{labels.daily}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
          {days.map((d, i) => {
            const pct = d.mins / maxMins
            const h = Math.max(pct * 100, d.mins > 0 ? 4 : 0)
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,.4)', fontWeight: 600 }}>{d.mins > 0 ? `${d.mins}m` : ''}</div>
                <div style={{
                  width: '100%', borderRadius: '5px 5px 3px 3px',
                  height: `${h}%`, minHeight: d.mins > 0 ? 4 : 0,
                  background: d.mins > 0 ? `linear-gradient(180deg, ${accent}, ${accent}88)` : 'rgba(255,255,255,.04)',
                  transition: 'height .6s cubic-bezier(.16,1,.3,1)',
                  boxShadow: d.mins > 0 ? `0 4px 16px -4px ${accent}60` : 'none',
                }} />
                <div style={{ fontSize: 9, color: 'rgba(148,163,184,.4)', fontWeight: 700 }}>{d.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '20px', borderRadius: 14, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,.45)', marginBottom: 16 }}>{labels.breakdown}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {subjectList.map(([subj, mins], i) => {
            const pct = (mins / totalMins * 100).toFixed(0)
            const col = subColors[i % subColors.length]
            return (
              <div key={subj}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12.5, color: '#e2e8f0', fontWeight: 500 }}>{subj}</span>
                  <span style={{ fontSize: 11, color: 'rgba(148,163,184,.5)' }}>{mins}m <span style={{ color: col }}>{pct}%</span></span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 3, transition: 'width .8s cubic-bezier(.16,1,.3,1)' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── GOALS TAB ───────────────────────────────────────────── */
function GoalsTab({ accent, sessions, lang }) {
  const [goals, setGoals] = useState([])
  const [input, setInput] = useState('')
  const [selAccent, setSelAccent] = useState(accent || '#ef4444')

  useEffect(() => {
    const saved = localStorage.getItem(GOALS_KEY)
    if (saved) { try { setGoals(JSON.parse(saved)) } catch {} }
  }, [])
  useEffect(() => { localStorage.setItem(GOALS_KEY, JSON.stringify(goals)) }, [goals])

  const addGoal = () => {
    if (!input.trim()) return
    setGoals(g => [{ id: Date.now(), text: input.trim(), done: false, accent: selAccent, createdAt: new Date().toISOString() }, ...g])
    setInput('')
  }
  const toggle = (id) => setGoals(g => g.map(x => x.id === id ? { ...x, done: !x.done } : x))
  const del    = (id) => setGoals(g => g.filter(x => x.id !== id))

  const active = goals.filter(g => !g.done)
  const done   = goals.filter(g => g.done)
  const totalStudied = sessions.reduce((a, s) => a + parseInt(s.duration || 0, 10), 0)

  const labels = lang === 'jp'
    ? { progress: '目標達成度', completed: '達成', placeholder: '新しい目標やタスクを追加…', totalStudied: '総学習時間', active: 'アクティブ', doneLabel: '完了', empty: 'まだ目標がない。上で追加してや！' }
    : { progress: 'Goal Progress', completed: 'completed', placeholder: 'Add a new goal or task…', totalStudied: 'Total Studied', active: 'Active', doneLabel: 'Completed', empty: 'No goals yet. Add one above!' }

  return (
    <div className="anim-fadeup">
      <div style={{ padding: '16px 18px', borderRadius: 14, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', marginBottom: 20, display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,.4)', marginBottom: 6 }}>{labels.progress}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="font-display" style={{ fontSize: 28, fontWeight: 700, color: '#f8fafc' }}>{done.length}/{goals.length}</div>
            <div style={{ fontSize: 12, color: 'rgba(148,163,184,.5)' }}>{labels.completed}</div>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)', marginTop: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${goals.length ? done.length / goals.length * 100 : 0}%`, background: accent, borderRadius: 2, transition: 'width .6s cubic-bezier(.16,1,.3,1)' }} />
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 700, color: accent }}>{totalStudied}m</div>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,.4)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 3 }}>{labels.totalStudied}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <input
          type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addGoal()}
          placeholder={labels.placeholder}
          className="input-field"
          style={{ flex: 1 }}
          onFocus={e => { e.target.style.borderColor = `${accent}60`; e.target.style.boxShadow = `0 0 0 3px ${accent}18` }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,.08)'; e.target.style.boxShadow = 'none' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {['#ef4444', '#f59e0b', '#38bdf8', '#a78bfa'].map(c => (
            <button key={c} onClick={() => setSelAccent(c)} aria-label={`Color ${c}`} style={{
              width: 18, height: 18, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
              outline: selAccent === c ? '2px solid white' : 'none', outlineOffset: 2,
              transform: selAccent === c ? 'scale(1.2)' : 'scale(1)', transition: 'transform .15s',
            }} />
          ))}
        </div>
        <button onClick={addGoal} aria-label="Add goal" style={{
          width: 40, height: 40, borderRadius: 10, background: accent, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 16px -4px ${accent}70`, flexShrink: 0,
        }}>
          <Plus size={16} color="white" strokeWidth={2.5} />
        </button>
      </div>

      {active.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(148,163,184,.35)', marginBottom: 10 }}>{labels.active} · {active.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {active.map(g => <GoalItem key={g.id} g={g} onToggle={toggle} onDelete={del} />)}
          </div>
        </>
      )}

      {done.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(148,163,184,.35)', marginBottom: 10 }}>{labels.doneLabel} · {done.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {done.map(g => <GoalItem key={g.id} g={g} onToggle={toggle} onDelete={del} />)}
          </div>
        </>
      )}

      {goals.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(148,163,184,.4)', fontSize: 13 }}>
          {labels.empty}
        </div>
      )}
    </div>
  )
}

function GoalItem({ g, onToggle, onDelete }) {
  const [hov, setHov] = useState(false)
  return (
    <div className="goal-item"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        opacity: g.done ? 0.65 : 1,
        borderColor: g.done ? 'rgba(255,255,255,.04)' : hov ? `${g.accent}30` : 'rgba(255,255,255,.06)',
      }}>
      <button className="goal-check"
        onClick={() => onToggle(g.id)}
        aria-label={g.done ? 'Mark incomplete' : 'Mark complete'}
        style={{
          borderColor: g.done ? g.accent : 'rgba(255,255,255,.15)',
          background: g.done ? g.accent : 'none',
        }}>
        {g.done && <Check size={11} color="white" strokeWidth={3} />}
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, color: g.done ? 'rgba(148,163,184,.5)' : '#e2e8f0', textDecoration: g.done ? 'line-through' : 'none', lineHeight: 1.5 }}>{g.text}</div>
        {!g.done && <div style={{ marginTop: 5, width: 3, height: 3, borderRadius: '50%', background: g.accent, display: 'inline-block' }} />}
      </div>
      {hov && (
        <button onClick={() => onDelete(g.id)} aria-label="Delete goal" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(148,163,184,.25)', padding: '0 2px',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,.25)'}>
          <X size={13} />
        </button>
      )}
    </div>
  )
}

/* ─── QUIZ TAB ─────────────────────────────────────────────── */
function QuizTab({ accent, sessions, lang }) {
  const [questions, setQuestions] = useState([])  // [{q, options[4], answer (idx)}]
  const [idx, setIdx]         = useState(0)
  const [picked, setPicked]   = useState(null)
  const [score, setScore]     = useState(0)
  const [done, setDone]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const subjectsList = [...new Set(sessions.map(s => s.subject))].filter(Boolean)
  const noSubjects = subjectsList.length === 0

  const labels = lang === 'jp'
    ? {
      title: '知識テスト', sub: '記録した科目から5問のクイズを生成。',
      generate: 'クイズを生成', regenerate: 'もう一度', generating: '作成中…',
      noSubjects: 'まだ科目がない。セッションを記録したらクイズが生成できるで。',
      score: 'スコア', next: '次へ', finish: '結果を見る',
      result: '結果', retake: 'もう一度挑戦', restart: 'リスタート',
      perfect: '完璧や！', great: 'ええやん！', ok: 'もうちょい頑張ろ。', bad: '復習タイムや。',
      genFail: 'クイズの生成に失敗。再試行してや。',
      basedOn: '対象科目',
    }
    : {
      title: 'Knowledge Quiz', sub: 'Generate a 5-question quiz from what you\'ve studied.',
      generate: 'Generate quiz', regenerate: 'New quiz', generating: 'Generating…',
      noSubjects: 'No subjects logged yet. Log a session and a quiz will be generated from it.',
      score: 'Score', next: 'Next', finish: 'See results',
      result: 'Result', retake: 'Try again', restart: 'Restart',
      perfect: 'Perfect!', great: 'Nice work!', ok: 'Could be sharper.', bad: 'Review time.',
      genFail: 'Failed to generate quiz. Try again.',
      basedOn: 'Subjects',
    }

  const generate = async () => {
    if (noSubjects) return
    setLoading(true); setError(''); setQuestions([]); setIdx(0); setPicked(null); setScore(0); setDone(false)
    try {
      const subjLines = sessions.slice(0, 12).map(s => {
        return `- ${s.subject} (${s.duration} min)${s.notes ? `: ${s.notes}` : ''}`
      }).join('\n')
      const prompt = lang === 'jp'
        ? `次の学習履歴に基づいて、ユーザーの知識を試す日本語の四択クイズを5問作成してください。各問題は記録された科目に関連していること。\n\n学習履歴:\n${subjLines}\n\n以下の純粋なJSONだけを返答せよ（前後に説明や\`\`\`は不要）:\n{"questions":[{"q":"問題文","options":["A","B","C","D"],"answer":0}]}\nanswerは正解のオプションのインデックス（0-3）。`
        : `Based on the following study history, generate exactly 5 multiple-choice quiz questions to test the user's knowledge. Questions should relate to subjects they've actually studied. Vary difficulty.\n\nStudy history:\n${subjLines}\n\nRespond with ONLY valid JSON, no markdown, no commentary:\n{"questions":[{"q":"...","options":["A","B","C","D"],"answer":0}]}\nThe "answer" field must be the index (0-3) of the correct option.`
      const response = await callGemini({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      })
      const data = JSON.parse(response.text)
      if (!data?.questions?.length) throw new Error('No questions returned')
      const cleaned = data.questions.slice(0, 5).map(q => ({
        q: String(q.q || ''),
        options: Array.isArray(q.options) ? q.options.slice(0, 4).map(String) : [],
        answer: Math.max(0, Math.min(3, parseInt(q.answer || 0, 10))),
      })).filter(q => q.q && q.options.length === 4)
      if (!cleaned.length) throw new Error('Bad format')
      setQuestions(cleaned)
    } catch (e) {
      console.error('Quiz generation failed:', e)
      setError(formatGeminiError(e, lang))
    } finally {
      setLoading(false)
    }
  }

  const pick = (i) => {
    if (picked !== null) return
    setPicked(i)
    if (i === questions[idx].answer) setScore(s => s + 1)
  }
  const next = () => {
    if (idx < questions.length - 1) {
      setIdx(i => i + 1); setPicked(null)
    } else {
      setDone(true)
    }
  }
  const restart = () => {
    setQuestions([]); setIdx(0); setPicked(null); setScore(0); setDone(false); setError('')
  }

  // No subjects logged
  if (noSubjects) {
    return (
      <div className="anim-fadeup" style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(148,163,184,0.5)', fontSize: 13.5 }}>
        <Brain size={32} color={`${accent}66`} style={{ marginBottom: 10 }} />
        <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>{labels.title}</div>
        <div>{labels.noSubjects}</div>
      </div>
    )
  }

  // Initial / regenerate state
  if (questions.length === 0) {
    return (
      <div className="anim-fadeup" style={{ padding: '24px 22px', borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${accent}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Brain size={18} color={accent} />
          </div>
          <div>
            <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{labels.title}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(148,163,184,0.6)', marginTop: 4, lineHeight: 1.5 }}>{labels.sub}</div>
          </div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.45)', marginBottom: 8 }}>{labels.basedOn}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
          {subjectsList.slice(0, 8).map(s => (
            <span key={s} style={{
              fontSize: 11.5, padding: '4px 10px', borderRadius: 999,
              background: `${accent}10`, border: `1px solid ${accent}26`, color: 'rgba(203,213,225,0.85)',
            }}>{s}</span>
          ))}
        </div>
        {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{error}</div>}
        <button onClick={generate} disabled={loading} style={{
          width: '100%', padding: '12px', borderRadius: 10,
          background: loading ? `${accent}66` : accent, color: 'white',
          border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: loading ? 'none' : `0 6px 24px -6px ${accent}70`,
        }}>
          {loading
            ? <><Loader2 size={14} style={{ animation: 'spinAnim 1s linear infinite' }} /> {labels.generating}</>
            : <><Sparkles size={14} /> {labels.generate}</>}
        </button>
      </div>
    )
  }

  // Results screen
  if (done) {
    const pct = Math.round(score / questions.length * 100)
    const verdict = pct === 100 ? labels.perfect
      : pct >= 80 ? labels.great
      : pct >= 50 ? labels.ok
      : labels.bad
    return (
      <div className="anim-fadeup" style={{ padding: '32px 24px', borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: `1px solid ${accent}33`, textAlign: 'center', boxShadow: `0 16px 48px -16px ${accent}40` }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: accent, marginBottom: 12 }}>{labels.result}</div>
        <div className="font-display" style={{ fontSize: 56, fontWeight: 700, color: '#f8fafc', lineHeight: 1, marginBottom: 6 }}>
          {score}<span style={{ color: 'rgba(148,163,184,0.4)', fontSize: 28 }}> / {questions.length}</span>
        </div>
        <div style={{ fontSize: 14, color: 'rgba(203,213,225,0.85)', marginBottom: 24 }}>{verdict}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={() => { setIdx(0); setPicked(null); setScore(0); setDone(false) }} style={{
            padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)', color: 'rgba(203,213,225,0.85)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>{labels.retake}</button>
          <button onClick={restart} style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: accent, color: 'white',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: `0 4px 16px -4px ${accent}80`,
          }}>{labels.restart}</button>
        </div>
      </div>
    )
  }

  // Active quiz
  const cur = questions[idx]
  const correct = picked !== null && picked === cur.answer
  return (
    <div className="anim-fadeup">
      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.45)' }}>
          {idx + 1} / {questions.length}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)' }}>{labels.score}: <span style={{ color: accent, fontWeight: 700 }}>{score}</span></div>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginBottom: 22, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(idx+1)/questions.length*100}%`, background: accent, borderRadius: 2, transition: 'width 0.35s' }} />
      </div>
      {/* Question */}
      <div style={{ padding: '20px 22px', borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 14 }}>
        <div className="font-display" style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.5 }}>{cur.q}</div>
      </div>
      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {cur.options.map((opt, i) => {
          const isPicked = picked === i
          const isAnswer = i === cur.answer
          let bg = 'rgba(255,255,255,0.025)'
          let border = 'rgba(255,255,255,0.07)'
          let color = '#e2e8f0'
          if (picked !== null) {
            if (isAnswer) { bg = 'rgba(34,197,94,0.1)'; border = 'rgba(34,197,94,0.5)' }
            else if (isPicked) { bg = 'rgba(239,68,68,0.1)'; border = 'rgba(239,68,68,0.5)' }
            else { color = 'rgba(148,163,184,0.5)' }
          }
          return (
            <button key={i} onClick={() => pick(i)} disabled={picked !== null} style={{
              padding: '12px 16px', borderRadius: 10,
              background: bg, border: `1px solid ${border}`,
              color, textAlign: 'left',
              cursor: picked === null ? 'pointer' : 'default',
              fontFamily: 'inherit', fontSize: 13.5,
              display: 'flex', alignItems: 'center', gap: 10,
              transition: 'all 0.18s',
            }}
            onMouseEnter={e => { if (picked === null) e.currentTarget.style.borderColor = `${accent}55` }}
            onMouseLeave={e => { if (picked === null) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}>
              <span style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                background: picked !== null && isAnswer ? '#22c55e'
                  : picked !== null && isPicked && !isAnswer ? '#ef4444'
                  : 'rgba(255,255,255,0.05)',
                color: picked !== null && (isAnswer || isPicked) ? 'white' : 'rgba(148,163,184,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
              }}>
                {picked !== null && isAnswer ? <Check size={11} strokeWidth={3} />
                  : picked !== null && isPicked && !isAnswer ? <X size={11} strokeWidth={3} />
                  : String.fromCharCode(65 + i)}
              </span>
              <span style={{ flex: 1 }}>{opt}</span>
            </button>
          )
        })}
      </div>
      {/* Next */}
      {picked !== null && (
        <button onClick={next} className="anim-fadein" style={{
          width: '100%', padding: '12px', borderRadius: 10,
          background: accent, color: 'white', border: 'none', cursor: 'pointer',
          fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
          boxShadow: `0 6px 24px -6px ${accent}70`,
        }}>
          {idx < questions.length - 1 ? labels.next : labels.finish} →
        </button>
      )}
    </div>
  )
}

/* ─── ASK AI TAB ───────────────────────────────────────────── */
const ASK_KEY = 'savage-sensei-ask'

function AskAITab({ sessions, accent, lang, chatMessages, setChatMessages, openFullChat }) {
  /* selectedSensei = null means Analyst (generic). Otherwise a personality key. */
  const [selectedSensei, setSelectedSensei] = useState(null)

  /* Generic Analyst thread (separate from per-personality chat). */
  const analystGreeting = lang === 'jp'
    ? "やぁ！君の専属学習アシスタントや。過去のセッションについて何でも聞いてみ — パターン、弱点、次に何をやるべきか、調子はどうか、全部わかる。"
    : "Hey! I'm your personal study assistant. Ask me anything about your sessions — patterns, weak spots, what to study next, or how you're trending. I have full context of your history."

  const [analystMsgs, setAnalystMsgs] = useState([{ role: 'ai', text: analystGreeting }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem(ASK_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length) setAnalystMsgs(parsed)
      } catch {}
    }
  }, [])
  useEffect(() => { localStorage.setItem(ASK_KEY, JSON.stringify(analystMsgs)) }, [analystMsgs])

  /* Active conversation = analyst thread OR shared chat thread for the sensei */
  const senseiThread = selectedSensei ? (chatMessages[selectedSensei] || []) : null
  /* Normalize the sensei thread (uses {role:'user'|'model', text, ts}) into our shape */
  const visibleMsgs = selectedSensei
    ? senseiThread.map(m => ({ role: m.role === 'user' ? 'user' : 'ai', text: m.text }))
    : analystMsgs

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollTop = bottomRef.current.scrollHeight
  }, [visibleMsgs.length, loading])

  const personality = selectedSensei ? PERSONALITIES[selectedSensei] : null
  const senseiAccent = personality?.accent || accent
  const senseiLabel = personality?.label[lang] || (lang === 'jp' ? 'アナリスト' : 'Analyst')

  const send = async (text) => {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setInput('')
    setLoading(true)

    try {
      if (!selectedSensei) {
        /* Analyst path */
        const updated = [...analystMsgs, { role: 'user', text: q }]
        setAnalystMsgs(updated)
        const ctx = buildContextString(sessions, lang)
        const sys = lang === 'jp'
          ? `あなたはユーザーの個人的なAI学習アシスタントです。過去のセッションを分析し、パターン・弱点・進捗を見抜く。直接的で、データに基づいて、簡潔に答える（2〜5文）。${ctx || '\n\nまだセッションが記録されていない。'}`
          : `You are the user's personal AI study assistant. You analyze their past sessions to spot patterns, weak spots, and progress. Be direct, data-driven, and concise (2-5 sentences). Use the session history below as context.${ctx || "\n\nNo sessions logged yet."}`
        const response = await callGemini({
          model: 'gemini-2.5-flash',
          contents: toGeminiContents(updated),
          config: { systemInstruction: sys },
        })
        const replyText = safeResponseText(response)
        if (!replyText) throw new Error('Empty response from model')
        setAnalystMsgs(m => [...m, { role: 'ai', text: replyText }])
      } else {
        /* Per-sensei path — writes into the SAME chatMessages store as the chat panel */
        const current = chatMessages[selectedSensei] || []
        const updated = [...current, { role: 'user', text: q, ts: Date.now() }]
        setChatMessages(prev => ({ ...prev, [selectedSensei]: updated }))
        const sys =
          PERSONALITIES[selectedSensei].prompt[lang] +
          buildContextString(sessions, lang) +
          CHAT_MODE_ADDON[lang]
        const response = await callGemini({
          model: 'gemini-2.5-flash',
          contents: toGeminiContents(updated),
          config: { systemInstruction: sys },
        })
        const replyText = safeResponseText(response)
        if (!replyText) throw new Error('Empty response from model')
        setChatMessages(prev => ({
          ...prev,
          [selectedSensei]: [...updated, { role: 'model', text: replyText, ts: Date.now() }],
        }))
      }
    } catch (err) {
      console.error('Ask AI error:', err)
      const errText = formatGeminiError(err, lang)
      if (selectedSensei) {
        setChatMessages(prev => ({
          ...prev,
          [selectedSensei]: [...(prev[selectedSensei] || []), { role: 'model', text: errText, ts: Date.now() }],
        }))
      } else {
        setAnalystMsgs(m => [...m, { role: 'ai', text: errText }])
      }
    } finally {
      setLoading(false)
    }
  }

  const totalMins = sessions.reduce((a, s) => a + parseInt(s.duration || 0, 10), 0)
  const ctxLabel = lang === 'jp'
    ? <>分析中：<strong style={{color:'#e2e8f0'}}>{sessions.length}セッション</strong> · 計{totalMins}分</>
    : <>Analyzing <strong style={{color:'#e2e8f0'}}>{sessions.length} sessions</strong> · {totalMins} minutes total</>

  /* Personality-tinted suggestion chips */
  const suggestionsByKey = {
    null: lang === 'jp'
      ? ['弱点はどこ？', '一貫性はどう？', '次は何を勉強すべき？', '進捗をまとめて']
      : ['What are my weak spots?', 'How consistent am I?', 'What should I study next?', 'Summarize my progress'],
    demonCoach: lang === 'jp'
      ? ['今日の課題は？', 'なぜ伸びへんのや？', 'どこを鍛えるべき？']
      : ['What\'s today\'s drill?', 'Why am I not improving?', 'Where do I need to grind?'],
    osakaAuntie: lang === 'jp'
      ? ['今日はどない？', 'ちょっと褒めて', 'おばちゃん、コツ教えて']
      : ['How am I doing today?', 'Hype me up a little', 'Auntie, give me a tip'],
    techBro: lang === 'jp'
      ? ['KPIどう？', '次のスプリント計画', 'どうやって10xする？']
      : ['How are my KPIs?', 'Plan my next sprint', 'How do I 10x this?'],
  }
  const suggestions = suggestionsByKey[selectedSensei] || suggestionsByKey.null
  const placeholder = selectedSensei
    ? (lang === 'jp' ? `${senseiLabel}に聞いてみ…` : `Ask ${senseiLabel}…`)
    : (lang === 'jp' ? 'セッションやパターンについて聞いてみ…' : 'Ask about your sessions, patterns, goals…')

  /* Pick options: Analyst + each personality */
  const options = [
    { key: null, image: null, label: lang === 'jp' ? 'アナリスト' : 'Analyst', accent: '#94a3b8' },
    ...Object.entries(PERSONALITIES).map(([key, p]) => ({
      key, image: p.image, label: p.label[lang], accent: p.accent,
    })),
  ]

  return (
    <div className="anim-fadeup" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 280px)', minHeight: 480 }}>
      {/* Sensei selector strip */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 12,
        overflowX: 'auto', paddingBottom: 4,
      }}>
        {options.map(opt => {
          const active = selectedSensei === opt.key
          return (
            <button key={opt.key || 'analyst'} onClick={() => setSelectedSensei(opt.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '6px 12px 6px 6px', borderRadius: 999,
                background: active ? `${opt.accent}1a` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? `${opt.accent}55` : 'rgba(255,255,255,0.07)'}`,
                color: active ? '#f1f5f9' : 'rgba(148,163,184,0.75)',
                cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                transition: 'all 0.18s', flexShrink: 0,
              }}>
              {opt.image ? (
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', overflow: 'hidden',
                  border: `1.5px solid ${active ? opt.accent : 'transparent'}`, flexShrink: 0,
                }}>
                  <img src={opt.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </span>
              ) : (
                <span style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: `${opt.accent}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Bot size={11} color={opt.accent} />
                </span>
              )}
              {opt.label}
            </button>
          )
        })}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', borderRadius: 10,
        background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
        marginBottom: 14, justifyContent: 'space-between',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={12} color={senseiAccent} />
          <span style={{ fontSize: 11, color: 'rgba(148,163,184,.6)' }}>{ctxLabel}</span>
        </span>
        {selectedSensei && openFullChat && (
          <button onClick={() => openFullChat(selectedSensei)} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 999,
            background: `${senseiAccent}14`,
            border: `1px solid ${senseiAccent}33`,
            color: senseiAccent, fontFamily: 'inherit',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            cursor: 'pointer', flexShrink: 0,
          }}>
            <MessageCircle size={10} />
            {lang === 'jp' ? 'フルチャット' : 'Full chat'} →
          </button>
        )}
      </div>

      <div ref={bottomRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 10 }}>
        {visibleMsgs.length === 0 && selectedSensei && (
          <div style={{
            textAlign: 'center', padding: '40px 12px',
            color: 'rgba(148,163,184,0.5)', fontSize: 13,
          }}>
            <div style={{ marginBottom: 8 }}>
              <img src={personality.image} alt="" style={{
                width: 48, height: 48, borderRadius: 12, objectFit: 'cover',
                border: `2px solid ${senseiAccent}40`,
              }} />
            </div>
            {lang === 'jp' ? `${senseiLabel}に話しかけてみ。` : `Start a chat with ${senseiLabel}.`}
          </div>
        )}
        {visibleMsgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'ai' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                {personality?.image ? (
                  <span style={{ width: 20, height: 20, borderRadius: 6, overflow: 'hidden', border: `1.5px solid ${senseiAccent}40`, flexShrink: 0 }}>
                    <img src={personality.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </span>
                ) : (
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: `${senseiAccent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bot size={11} color={senseiAccent} />
                  </div>
                )}
                <span style={{ fontSize: 10, fontWeight: 700, color: senseiAccent, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  {senseiLabel}
                </span>
              </div>
            )}
            <div className={`msg-bubble ${m.role === 'user' ? 'msg-user' : 'msg-ai'}`}
              style={{
                color: m.role === 'user' ? '#e2e8f0' : 'rgba(203,213,225,.9)',
                ...(m.role === 'ai' && selectedSensei
                  ? { background: `${senseiAccent}0e`, borderColor: `${senseiAccent}22` }
                  : null),
              }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              {personality?.image ? (
                <span style={{ width: 20, height: 20, borderRadius: 6, overflow: 'hidden', border: `1.5px solid ${senseiAccent}40` }}>
                  <img src={personality.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </span>
              ) : (
                <div style={{ width: 20, height: 20, borderRadius: 6, background: `${senseiAccent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={11} color={senseiAccent} />
                </div>
              )}
              <span style={{ fontSize: 10, fontWeight: 700, color: senseiAccent, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                {senseiLabel}
              </span>
            </div>
            <div className="msg-bubble msg-ai" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(148,163,184,.5)' }}>
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          </div>
        )}
      </div>

      {visibleMsgs.length < 2 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {suggestions.map(s => (
            <button key={s} onClick={() => send(s)} style={{
              padding: '6px 12px', borderRadius: 20, border: `1px solid ${senseiAccent}30`,
              background: `${senseiAccent}0c`, color: 'rgba(148,163,184,.8)',
              fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${senseiAccent}60`; e.currentTarget.style.color = '#e2e8f0' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = `${senseiAccent}30`; e.currentTarget.style.color = 'rgba(148,163,184,.8)' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <input type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={placeholder}
          className="input-field"
          style={{ flex: 1 }}
          onFocus={e => { e.target.style.borderColor = `${senseiAccent}60`; e.target.style.boxShadow = `0 0 0 3px ${senseiAccent}18` }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,.08)'; e.target.style.boxShadow = 'none' }}
        />
        <button onClick={() => send()} disabled={!input.trim() || loading} aria-label="Send" style={{
          width: 44, height: 44, borderRadius: 10,
          background: input.trim() && !loading ? senseiAccent : 'rgba(255,255,255,.06)',
          border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          transition: 'background .18s',
          boxShadow: input.trim() && !loading ? `0 4px 16px -4px ${senseiAccent}70` : 'none',
        }}>
          {loading
            ? <Loader2 size={14} color={senseiAccent} style={{ animation: 'spinAnim 1s linear infinite' }} />
            : <Send size={15} color={input.trim() ? 'white' : 'rgba(148,163,184,.4)'} />}
        </button>
      </div>
    </div>
  )
}

export default App
