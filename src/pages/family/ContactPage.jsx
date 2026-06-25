import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { sendMessage } from '../../lib/db'
import { MessageSquare, Send, CheckCircle2 } from 'lucide-react'

export default function ContactPage() {
  const { user } = useAuth()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!subject.trim() || !body.trim()) return
    setLoading(true)
    setError('')
    try {
      await sendMessage({
        userId: user.uid,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        subject: subject.trim(),
        body: body.trim(),
      })
      setSent(true)
    } catch {
      setError('שגיאה בשליחה, נסה שוב')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2">
          <span className="text-2xl leading-none">💬</span>
          צור קשר
        </h1>
        <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">שלחו הודעה לצוות בית הספר</p>
      </div>

      {sent ? (
        <div className="card p-8 text-center">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="font-bold text-gray-800 text-lg mb-2 dark:text-gray-100">ההודעה נשלחה!</h2>
          <p className="text-sm text-gray-500 mb-5 dark:text-gray-400">נחזור אליכם בהקדם האפשרי.</p>
          <button onClick={() => { setSent(false); setSubject(''); setBody('') }}
            className="btn-primary py-2 px-6 text-sm">
            שלח הודעה נוספת
          </button>
          <Link to="/dashboard" className="mt-3 block text-sm text-primary-600 text-center hover:underline">
            חזרה לדף הבית
          </Link>
        </div>
      ) : (
        <div className="card p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label block mb-1 text-right">נושא</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} required
                maxLength={200}
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
                : <><Send size={16} />שלח הודעה</>
              }
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
