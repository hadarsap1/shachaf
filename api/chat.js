export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, systemPrompt } = req.body || {}
  if (!Array.isArray(messages) || typeof systemPrompt !== 'string') {
    return res.status(400).json({ error: 'Invalid request' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'AI not configured' })

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content).slice(0, 2000) }],
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
