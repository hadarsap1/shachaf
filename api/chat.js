// In-memory rate limiter: uid -> { count, resetAt }
const rateLimitMap = new Map()
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60_000

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

  // Rate limiting
  if (!checkRateLimit(uid)) {
    return res.status(429).json({ error: 'Rate limit exceeded' })
  }

  // Destructure — ignore any systemPrompt from client
  const { messages } = req.body || {}
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request' })
  }

  // Cap messages array and content length
  const cappedMessages = messages.slice(0, 20).map(m => ({
    role: m.role,
    content: String(m.content).slice(0, 2000),
  }))

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'AI not configured' })

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: cappedMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  }

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!upstream.ok) return res.status(502).json({ error: 'AI service error' })
  const data = await upstream.json()
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'אין תשובה זמינה.'
  res.status(200).json({ reply })
}
