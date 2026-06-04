// In-memory rate limiter: uid -> { count, resetAt }
const rateLimitMap = new Map()
const RATE_LIMIT_MAX = 5        // per minute per user
const RATE_LIMIT_WINDOW_MS = 60_000
const DAILY_LIMIT = 30          // per user per day

function checkRateLimit(uid) {
  const now = Date.now()
  const entry = rateLimitMap.get(uid)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(uid, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

async function getDailyCount(uid, idToken, projectId) {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
  try {
    const res = await fetch(`${base}/aiUsage/${uid}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
    if (res.status === 404) return { date: todayStr(), count: 0 }
    if (!res.ok) return null
    const doc = await res.json()
    const docDate = doc.fields?.date?.stringValue
    const docCount = parseInt(doc.fields?.count?.integerValue || '0', 10)
    if (docDate !== todayStr()) return { date: todayStr(), count: 0 }
    return { date: docDate, count: docCount }
  } catch {
    return null // fail open — don't block users if Firestore is unavailable
  }
}

async function incrementDailyCount(uid, idToken, projectId, date, newCount) {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
  try {
    await fetch(
      `${base}/aiUsage/${uid}?updateMask.fieldPaths=date&updateMask.fieldPaths=count`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            date:  { stringValue: date },
            count: { integerValue: String(newCount) },
          },
        }),
      }
    )
  } catch {
    // non-critical
  }
}

const systemPrompt = `אתה עוזר קליטה של בית הספר שחף. תפקידך לעזור למשפחות חדשות בתהליך הקליטה — משימות, אירועים, ושאלות על בית הספר. ענה בשפה שבה המשתמש פונה אליך. אל תסטה מנושא הקליטה לבית הספר.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const contentType = req.headers['content-type'] || ''
  if (!contentType.includes('application/json')) {
    return res.status(400).json({ error: 'Content-Type must be application/json' })
  }

  // Auth: require Firebase ID token
  const authHeader = req.headers['authorization'] || ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!idToken) return res.status(401).json({ error: 'Missing authorization token' })

  const firebaseApiKey = process.env.FIREBASE_API_KEY
  if (!firebaseApiKey) return res.status(500).json({ error: 'Server misconfigured' })

  let uid
  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    )
    if (!verifyRes.ok) return res.status(401).json({ error: 'Invalid or expired token' })
    const verifyData = await verifyRes.json()
    uid = verifyData.users?.[0]?.localId
    if (!uid) return res.status(401).json({ error: 'Invalid or expired token' })
  } catch {
    return res.status(401).json({ error: 'Token verification failed' })
  }

  // Per-minute rate limit (in-memory, fast)
  if (!checkRateLimit(uid)) {
    return res.status(429).json({ error: 'Rate limit exceeded', code: 'rate_limit' })
  }

  // Daily limit (Firestore)
  const projectId = process.env.FIREBASE_PROJECT_ID
  let usage = null
  if (projectId) {
    usage = await getDailyCount(uid, idToken, projectId)
    if (usage && usage.count >= DAILY_LIMIT) {
      return res.status(429).json({ error: 'Daily limit reached', code: 'daily_limit' })
    }
  }

  // Validate body
  const { messages } = req.body || {}
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request' })
  }

  const cappedMessages = messages.slice(0, 20).map(m => ({
    role: m.role,
    content: String(m.content).slice(0, 2000),
  }))

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'AI not configured' })

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: cappedMessages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      }),
    }
  )
  if (!upstream.ok) return res.status(502).json({ error: 'AI service error' })
  const data = await upstream.json()
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'אין תשובה זמינה.'

  // Increment daily counter after successful response
  if (projectId && usage) {
    await incrementDailyCount(uid, idToken, projectId, usage.date, usage.count + 1)
  }

  res.status(200).json({ reply })
}
