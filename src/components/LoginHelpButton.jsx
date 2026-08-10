import { useState } from 'react'
import { LifeBuoy, X, Loader2, Check } from 'lucide-react'
import { saveLoginReport } from '../lib/db'
import { useEscapeToClose } from '../hooks/useEscapeToClose'

// The report channel for people the normal one cannot reach: the feedback
// button lives inside AppShell, so anyone stuck on the login screen, on the
// consent dialog, on the "waiting for approval" screen or mid-onboarding has
// no way to tell us anything. This button is rendered outside AppShell for
// exactly those states.

// What we would otherwise have to ask for over the phone, one question at a
// time. Collected automatically so the reporter only writes what happened.
/* global __APP_VERSION__ */
function collectDiagnostics(context) {
  const bits = []
  bits.push(context || 'login')
  try {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    bits.push(standalone ? 'מותקן' : 'דפדפן')
  } catch { /* matchMedia missing — not worth failing the report over */ }
  if (typeof __APP_VERSION__ === 'string') bits.push(`v${__APP_VERSION__}`)
  try { bits.push(navigator.userAgent) } catch { /* ignore */ }
  return bits.join(' · ').slice(0, 500)
}

export default function LoginHelpButton({ context = 'login', lastError = '' }) {
  const [open, setOpen]     = useState(false)
  const [text, setText]     = useState('')
  const [email, setEmail]   = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone]     = useState(false)
  const [error, setError]   = useState('')

  const close = () => { setOpen(false); setText(''); setEmail(''); setDone(false); setError('') }
  useEscapeToClose(close, open && !saving)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    setError('')
    try {
      const diagnostics = [collectDiagnostics(context), lastError].filter(Boolean).join(' | ')
      await saveLoginReport({ text: text.trim(), email: email.trim(), diagnostics })
      setDone(true)
      setTimeout(close, 2600)
    } catch (err) {
      console.error('login report failed', err)
      setError('לא הצלחנו לשלוח את הדיווח. בדקו את החיבור לאינטרנט ונסו שוב.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 mx-auto text-white/90 text-xs underline hover:text-white transition-colors"
      >
        <LifeBuoy size={13} />
        לא מצליחים להיכנס? דווחו לנו
      </button>

      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
          <div role="dialog" aria-modal="true" aria-label="דיווח על בעיית התחברות"
            className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-modal">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <button onClick={close} disabled={saving} aria-label="סגור"
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
                <X size={18} />
              </button>
              <h2 className="font-bold text-gray-800 dark:text-gray-100">בעיה בהתחברות?</h2>
            </div>

            {done ? (
              <div className="px-5 py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                  <Check size={24} className="text-green-600 dark:text-green-400" />
                </div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">הדיווח נשלח</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  נטפל בזה ונחזור אליכם. תודה!
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ספרו לנו מה קרה ונחזור אליכם. פרטי הדפדפן והמכשיר נשלחים
                  אוטומטית כדי שנוכל לאתר את התקלה.
                </p>
                <div>
                  <label htmlFor="login-report-text" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    מה קרה?
                  </label>
                  <textarea
                    id="login-report-text"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    required
                    maxLength={1000}
                    rows={4}
                    placeholder="לדוגמה: לחצתי על כניסה עם Google והמסך נתקע בטעינה"
                    className="input w-full text-right resize-none"
                  />
                </div>
                <div>
                  <label htmlFor="login-report-email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    מייל או טלפון לחזרה <span className="text-gray-400 font-normal text-xs">(אופציונלי)</span>
                  </label>
                  <input
                    id="login-report-email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    maxLength={200}
                    placeholder="איך נחזור אליכם?"
                    className="input w-full text-right"
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button type="submit" disabled={saving || !text.trim()}
                  className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : 'שליחת הדיווח'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
