import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  sendMessage, getMyMessages, addMessageReply, markMyMessagesReadByUser,
  getMyFeedback, markMyFeedbackRead, addFeedbackReply,
} from '../../lib/db'
import { hasAdminReply, unreadIds, reportThread } from '../../lib/replies'
import { ReplyBubbles, ReplyBox } from '../../components/ui/ReplyThread'
import { Send, CheckCircle2, Bug, Clock3, AlertTriangle } from 'lucide-react'

function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function MessageThread({ msg, onReply }) {
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
      <div className="mt-2">
        <ReplyBubbles entries={msg.replies || []} />
      </div>
      {/* Reply box */}
      <div className="mt-3">
        <ReplyBox onSend={text => onReply(msg.id, text)} />
      </div>
    </div>
  )
}

// דיווח תקלה שחבר הקהילה פתח, עם התשובה של הצוות אם הגיעה. אותו שרשור כמו
// פנייה, כולל תיבת תשובה: דיווח שנענה בלי דרך להגיב עליו הוא מבוי סתום, וזה
// מה שהחזיר אנשים לפתוח פנייה חדשה רק כדי לכתוב "זה עדיין לא עובד".
function ReportCard({ report, onReply }) {
  const answered = hasAdminReply(report)
  const thread = reportThread(report)
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{formatDate(report.createdAt)}</span>
        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-1.5 dark:text-gray-100">
          <Bug size={13} className="text-accent-500" />
          דיווח על תקלה
        </h3>
      </div>
      <div className="bg-gray-100 text-gray-800 rounded-2xl px-3.5 py-2 max-w-[85%] dark:bg-gray-700 dark:text-gray-100">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.text}</p>
      </div>
      <div className="mt-2">
        <ReplyBubbles entries={thread} />
      </div>
      {!answered && (
        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5 justify-end">
          <Clock3 size={12} />
          הדיווח התקבל, נעדכן אותך כאן כשנטפל בו
        </p>
      )}
      <div className="mt-3">
        <ReplyBox
          onSend={text => onReply(report.id, text)}
          placeholder={answered ? 'להשיב לצוות...' : 'להוסיף פרטים לדיווח...'}
        />
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
  const [loadError, setLoadError] = useState('')
  const [myMessages, setMyMessages] = useState([])
  const [myReports, setMyReports] = useState([])

  const loadMine = async () => {
    if (!user?.uid) return
    // Opening this page IS reading the answers, both channels clear here, so
    // the badge and the dashboard banner cannot outlive what the member saw.
    // שאילתה ריקה מחזירה [], לכן כל שגיאה כאן היא שגיאה אמיתית ולא "אין לי
    // הודעות" - ובולעים אותה בשקט זה בדיוק מה שנראה למשתמש כמו שרשור שנעלם.
    let failed = false
    try {
      const msgs = await getMyMessages(user.uid)
      setMyMessages(msgs)
      const unread = unreadIds(msgs)
      if (unread.length) markMyMessagesReadByUser(unread)
    } catch (e) {
      console.error('loading my messages failed', e)
      failed = true
    }
    try {
      const reports = await getMyFeedback(user.uid)
      setMyReports(reports)
      const unread = unreadIds(reports)
      if (unread.length) markMyFeedbackRead(unread)
    } catch (e) {
      console.error('loading my reports failed', e)
      failed = true
    }
    setLoadError(failed ? 'לא הצלחנו לטעון את ההתכתבויות הקודמות. רענון הדף בדרך כלל פותר את זה.' : '')
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

  // השגיאה לא נבלעת כאן: ReplyBox מציג אותה למשתמש, ולכן חייבים לזרוק אותה הלאה.
  const handleReply = async (id, text) => {
    const entry = await addMessageReply(id, { body: text, fromAdmin: false, byName: user?.name || '' })
    setMyMessages(prev => prev.map(m => m.id === id ? { ...m, replies: [...(m.replies || []), entry] } : m))
  }

  const handleReportReply = async (id, text) => {
    const entry = await addFeedbackReply(id, { body: text, fromAdmin: false, byName: user?.name || '' })
    setMyReports(prev => prev.map(r => r.id === id
      ? { ...r, replies: [...(r.replies || []), entry], status: 'new' }
      : r))
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
          <p className="text-sm text-gray-500 mb-5 dark:text-gray-400">נחזור אליכם בהקדם, התשובה תופיע כאן.</p>
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

      {loadError && (
        <div role="alert" className="card p-4 mb-6 flex items-start gap-2 border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600 dark:text-gray-300">{loadError}</p>
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

      {/* Bug reports I filed, and what the team answered */}
      {myReports.length > 0 && (
        <div className="space-y-3 mt-6">
          <h2 className="font-bold text-gray-700 text-sm dark:text-gray-200">הדיווחים שלי</h2>
          {myReports.map(report => (
            <ReportCard key={report.id} report={report} onReply={handleReportReply} />
          ))}
        </div>
      )}
    </div>
  )
}
