import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { sendMessage, getMyMessages, addMessageReply, markMyMessagesReadByUser } from '../../lib/db'
import { MessageSquare, Send, CheckCircle2, Loader2 } from 'lucide-react'
import clsx from 'clsx'

function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function MessageThread({ msg, onReply }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async () => {
    if (!text.trim()) return
    setSending(true)
    try { await onReply(msg.id, text.trim()); setText('') }
    finally { setSending(false) }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{formatDate(msg.createdAt)}</span>
        <h3 className="font-semibold text-gray-800 text-sm dark:text-gray-100">{msg.subject}</h3>
      </div>
      {/* Original message (from the parent) */}
      <div className="bg-gray-100 text-gray-800 rounded-2xl px-3.5 py-2 max-w-[85%] dark:bg-gray-700 dark:text-gray-100">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.body}</p>
      </div>
      {/* Replies */}
      <div className="space-y-2 mt-2">
        {(msg.replies || []).map((r, i) => (
          <div key={i} className={clsx('max-w-[85%] rounded-2xl px-3.5 py-2',
            r.fromAdmin ? 'bg-primary-600 text-white ms-auto' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100')}>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.body}</p>
            <div className={clsx('text-[10px] mt-0.5', r.fromAdmin ? 'text-primary-100' : 'text-gray-400')}>
              {r.fromAdmin ? (r.byName || 'צוות בית הספר') : 'את/ה'}
            </div>
          </div>
        ))}
      </div>
      {/* Reply box */}
      <div className="flex items-end gap-2 mt-3">
        <textarea value={text} onChange={e => setText(e.target.value)} rows={1}
          placeholder="כתבו תשובה..." className="input flex-1 text-right text-sm resize-none py-2" />
        <button onClick={submit} disabled={sending || !text.trim()}
          className="btn-primary p-2.5 rounded-xl disabled:opacity-50" aria-label="שלח">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  )
}

export default function ContactPage() {
  const { user } = useAuth()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [myMessages, setMyMessages] = useState([])

  const loadMine = async () => {
    if (!user?.uid) return
    try {
      const msgs = await getMyMessages(user.uid)
      setMyMessages(msgs)
      const unread = msgs.filter(m => m.userUnread).map(m => m.id)
      if (unread.length) markMyMessagesReadByUser(unread)
    } catch (e) { /* first-time users have none */ }
  }

  useEffect(() => { loadMine() }, [user?.uid])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!subject.trim() || !body.trim()) return
    setLoading(true)
    setError('')
    try {
      await sendMessage({
        userId: user.uid, userName: user.name, userEmail: user.email, userRole: user.role,
        subject: subject.trim(), body: body.trim(), replies: [], userUnread: false,
      })
      setSent(true)
      loadMine()
    } catch {
      setError('שגיאה בשליחה, נסה שוב')
    } finally {
      setLoading(false)
    }
  }

  const handleReply = async (id, text) => {
    const entry = await addMessageReply(id, { body: text, fromAdmin: false, byName: user?.name || '' })
    setMyMessages(prev => prev.map(m => m.id === id ? { ...m, replies: [...(m.replies || []), entry] } : m))
  }

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 dark:text-primary-300">
          <span className="text-2xl leading-none">💬</span>
          צור קשר
        </h1>
        <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">שלחו הודעה לצוות בית הספר</p>
      </div>

      {sent ? (
        <div className="card p-8 text-center mb-6">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="font-bold text-gray-800 text-lg mb-2 dark:text-gray-100">ההודעה נשלחה!</h2>
          <p className="text-sm text-gray-500 mb-5 dark:text-gray-400">נחזור אליכם בהקדם — התשובה תופיע כאן.</p>
          <button onClick={() => { setSent(false); setSubject(''); setBody('') }}
            className="btn-primary py-2 px-6 text-sm">שלח הודעה נוספת</button>
        </div>
      ) : (
        <div className="card p-5 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label block mb-1 text-right">נושא</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} required maxLength={200}
                className="input w-full text-right" placeholder="במה נוכל לעזור?" />
            </div>
            <div>
              <label className="label block mb-1 text-right">הודעה</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} required
                rows={5} maxLength={5000} className="input w-full text-right resize-none"
                placeholder="כתבו את הודעתכם כאן..." />
            </div>
            {error && <p className="text-sm text-red-500 text-right">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2">
              {loading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Send size={16} />שלח הודעה</>}
            </button>
          </form>
        </div>
      )}

      {/* My message threads */}
      {myMessages.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-gray-700 text-sm dark:text-gray-200">ההודעות שלי</h2>
          {myMessages.map(msg => (
            <MessageThread key={msg.id} msg={msg} onReply={handleReply} />
          ))}
        </div>
      )}
    </div>
  )
}
