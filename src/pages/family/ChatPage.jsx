import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { MOCK_TASKS, MOCK_EVENTS } from '../../lib/mockData'
import { Send, Bot, User, Sparkles, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

const INITIAL_SUGGESTIONS = [
  'מה המשימה הבאה שלי?',
  'מתי האירוע הקרוב?',
  'איך יוצרים קשר עם המשפחה המארחת?',
  'אילו מסמכים צריך להכין?',
]

const FOLLOWUP_POOLS = {
  task: [
    'איך מסמנים משימה כהושלמה?',
    'מה קורה אם לא השלמתי בזמן?',
    'יש עוד משימות שממתינות?',
    'מה הצעד הבא אחרי זה?',
  ],
  event: [
    'איך מוסיפים את זה ליומן?',
    'האם נדרשת הרשמה מוקדמת?',
    'מה אחרי האירוע הזה?',
    'עם מי כדאי להגיע?',
  ],
  contact: [
    'איך שולחים הודעת WhatsApp?',
    'מה שעות הזמינות?',
    'יש מספר חירום לפנייה?',
    'למי פונים בשאלות על בית הספר?',
  ],
  general: [
    'מה החדשות האחרונות בקהילה?',
    'יש פעילויות לילדים בקרוב?',
    'איך מצטרפים לקבוצות WhatsApp?',
    'מה ה-FAQ של המשפחות החדשות?',
  ],
}

function getFollowups(reply) {
  if (!reply) return INITIAL_SUGGESTIONS
  const r = reply.toLowerCase()
  if (r.includes('משימ') || r.includes('task')) return FOLLOWUP_POOLS.task
  if (r.includes('אירוע') || r.includes('ערב') || r.includes('event')) return FOLLOWUP_POOLS.event
  if (r.includes('קשר') || r.includes('whatsapp') || r.includes('וואטסאפ') || r.includes('טלפון')) return FOLLOWUP_POOLS.contact
  return FOLLOWUP_POOLS.general
}

function buildSystemPrompt(user, tasks, events) {
  const safeName = String(user?.name || 'משתמש').slice(0, 50).replace(/[`"\\]/g, '')
  const safeRole = ['new_family', 'host_family', 'admin', 'super_admin'].includes(user?.role)
    ? user.role : 'new_family'
  const roleLabel = safeRole === 'new_family' ? 'משפחה חדשה' : 'משפחה מארחת'
  return `אתה עוזר חכם ואדיב של פלטפורמת הקליטה "שחף" לבית הספר שחף.
[CONTEXT]
name: "${safeName}"
role: "${roleLabel}"
open_tasks: ${JSON.stringify(tasks.filter(t => t.status !== 'done').map(t => ({ title: t.title, due: t.dueDate })))}
events: ${JSON.stringify(events.map(e => ({ title: e.title, date: e.date, location: e.location })))}
[/CONTEXT]

הנחיות:
- ענה רק על בסיס המידע שסופק לך.
- אם שאלה חורגת מהמידע הזמין, ציין זאת ויעץ לפנות למשפחה המארחת או לוועד.
- ענה בעברית בצורה ידידותית, קצרה וברורה.
- אל תדמיין מידע שלא ניתן לך.`
}

async function callChat(messages) {
  const token = await import('../../lib/firebase').then(m => m.auth.currentUser?.getIdToken())
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages }),
  })
  if (res.status === 401) throw Object.assign(new Error('auth'), { status: 401 })
  if (res.status === 429) throw Object.assign(new Error('rate_limit'), { status: 429 })
  if (!res.ok) throw new Error('chat error')
  const data = await res.json()
  return data.reply || 'אין תשובה זמינה.'
}

export default function ChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: `שלום ${user?.name}! 👋\nאני העוזר החכם של שחף. אני יכול לעזור לך עם משימות, אירועים ומידע על הקהילה.\nמה תרצה לדעת?`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const userMsg = text || input.trim()
    if (!userMsg || loading) return
    setInput('')

    const newMessages = [...messages, { id: Date.now(), role: 'user', content: userMsg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const reply = await callChat(
        newMessages.filter(m => m.role !== 'assistant' || m.id !== 1)
      )
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: reply }])
      setSuggestions(getFollowups(reply))
    } catch (err) {
      let content = 'מצטער, אירעה שגיאה. נסה שוב או פנה למשפחה המארחת.'
      if (err.status === 401) content = 'יש להתחבר מחדש.'
      if (err.status === 429) content = 'שלחת יותר מדי הודעות, המתן דקה.'
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content,
      }])
      setSuggestions(FOLLOWUP_POOLS.general)
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full max-h-screen" dir="rtl">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <div className="p-2 bg-primary-600 rounded-xl">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-800 text-sm">עוזר חכם</h1>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse-dot" />
              מחובר
            </p>
          </div>
          <button
            onClick={() => {
              setMessages([{ id: 1, role: 'assistant', content: `שלום ${user?.name}! 👋\nאיך אוכל לעזור?` }])
              setSuggestions(INITIAL_SUGGESTIONS)
            }}
            className="mr-auto p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="שיחה חדשה"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={clsx('flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
            >
              <div className={clsx(
                'w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mt-0.5',
                msg.role === 'user' ? 'bg-accent-400' : 'bg-primary-600'
              )}>
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div
                className={clsx(
                  'max-w-xs sm:max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white rounded-tr-sm'
                    : 'bg-white shadow-card border border-gray-100 text-gray-800 rounded-tl-sm'
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-white" />
              </div>
              <div className="bg-white shadow-card border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggested follow-up questions */}
      {!loading && (
        <div className="px-4 pb-2">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs text-gray-400 text-right mb-1.5">המשך לשאול:</p>
            <div className="flex flex-wrap gap-2 justify-end">
              {suggestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="text-xs bg-white text-primary-600 border border-primary-200 px-3 py-1.5 rounded-full hover:bg-primary-50 hover:border-primary-300 transition-colors shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 bg-white border-t border-gray-100">
        <div className="max-w-2xl mx-auto flex gap-2">
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="p-2.5 bg-primary-600 text-white rounded-xl disabled:opacity-40 hover:bg-primary-700 transition-colors flex-shrink-0"
          >
            <Send size={16} />
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="שאל שאלה..."
            rows={1}
            className="flex-1 input resize-none py-2.5 text-right"
          />
        </div>
      </div>
    </div>
  )
}
