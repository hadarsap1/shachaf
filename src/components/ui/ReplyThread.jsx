import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import clsx from 'clsx'

// שיחה בין חבר קהילה לצוות. שלושה מסכים מציגים בדיוק את אותו שרשור: "צור קשר"
// של ההורה, תיבת הפניות בניהול ותיבת דיווחי התקלה. לכן הבועות ותיבת התשובה
// יושבות כאן ולא משוכפלות בכל מסך - ובעיקר כדי שכשל שליחה ייראה אותו דבר
// בכל מקום, במקום להיבלע בשקט כפי שקרה עד היום.

export function ReplyBubbles({ entries = [], viewer = 'member' }) {
  if (!entries.length) return null
  return (
    <div className="space-y-2">
      {entries.map((r, i) => (
        <div
          key={r.at || i}
          className={clsx('max-w-[85%] rounded-2xl px-3.5 py-2',
            r.fromAdmin
              ? 'bg-primary-600 text-white ms-auto'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100')}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.body}</p>
          <div className={clsx('text-[10px] mt-0.5', r.fromAdmin ? 'text-primary-100' : 'text-gray-400')}>
            {r.fromAdmin
              ? (r.byName || 'צוות שחף')
              : (viewer === 'admin' ? (r.byName || 'חבר קהילה') : 'את/ה')}
          </div>
        </div>
      ))}
    </div>
  )
}

// תיבת תשובה. onSend מקבל את הטקסט ומחזיר Promise - אם הוא נכשל, המשתמש
// רואה למה. בלי זה כפתור השליחה פשוט לא עושה כלום, וזה בדיוק הדיווח שהגיע
// מהקהילה ("אני לא מצליחה להשיב").
export function ReplyBox({
  onSend,
  placeholder = 'כתבו תשובה...',
  label = 'שלח תשובה',
  compact = true,
  children,
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    try {
      await onSend(body)
      setText('')
    } catch (e) {
      console.error('reply failed', e)
      setError('השליחה נכשלה. בדקו חיבור לאינטרנט ונסו שוב.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      {compact ? (
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={1}
            aria-label={placeholder}
            placeholder={placeholder}
            className="input flex-1 text-right text-sm resize-none py-2"
          />
          <button
            onClick={submit}
            disabled={sending || !text.trim()}
            className="btn-primary p-2.5 rounded-xl disabled:opacity-50"
            aria-label={label}
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={2}
            aria-label={placeholder}
            placeholder={placeholder}
            className="input w-full text-right text-sm resize-none"
          />
          <div className="flex items-center justify-between mt-2 gap-2">
            {children || <span />}
            <button
              onClick={submit}
              disabled={sending || !text.trim()}
              className="btn-primary text-sm py-1.5 px-4 inline-flex items-center gap-2 disabled:opacity-50"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {label}
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-500 mt-1.5 text-right">{error}</p>
      )}
    </div>
  )
}
