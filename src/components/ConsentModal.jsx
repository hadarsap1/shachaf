import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { recordConsent } from '../lib/db'
import {
  CONSENT_VERSION, CONSENT_PURPOSES, CONSENT_EXPOSURE,
  CONSENT_POINTS, CONSENT_CHECKBOX_LABEL,
} from '../lib/consent'

// Blocking informed-consent dialog. Shown to every signed-in user (new,
// existing, and co-parents) until they approve the CURRENT consent version —
// bumping CONSENT_VERSION re-prompts everyone. Approval is stored on the
// user doc (consentVersion + consentAt) as evidence; declining signs out.
export default function ConsentModal() {
  const { user, updateUserState, logout } = useAuth()
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleApprove = async () => {
    if (!checked || saving) return
    setSaving(true)
    setError('')
    try {
      // Demo users (dev mode) have no Firestore doc — local state only
      if (user.uid) await recordConsent(user.uid, CONSENT_VERSION)
      updateUserState({ consentVersion: CONSENT_VERSION })
    } catch (e) {
      console.error('recordConsent failed', e)
      setError('שמירת האישור נכשלה — נסו שוב')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
      <div role="dialog" aria-modal="true" aria-label="הסכמה לאיסוף ושימוש במידע"
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={20} className="text-primary-600 dark:text-primary-300" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">הסכמה לאיסוף ושימוש במידע</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">גרסה {CONSENT_VERSION} · נדרש אישור חד-פעמי</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-right">
          <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
            המידע שתמסור/י (שם, טלפון, אימייל, וכן — לפי בחירתך בלבד — כתובת, תמונה,
            ושם וכיתת ילדיך) נאסף וישמש <strong>אך ורק</strong> למטרות הבאות:
          </p>
          <ol className="space-y-1.5 pe-1">
            {CONSENT_PURPOSES.map((p, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-gray-200 flex gap-2">
                <span className="font-bold text-primary-600 dark:text-primary-400 flex-shrink-0">{i + 1}.</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>

          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">מי חשוף למידע שלך</p>
            <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">{CONSENT_EXPOSURE}</p>
          </div>

          {CONSENT_POINTS.map((pt, i) => (
            <div key={i}>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{pt.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{pt.body}</p>
            </div>
          ))}

          <p className="text-xs text-gray-400 dark:text-gray-500">
            הנוסח המלא:{' '}
            <Link to="/legal/privacy" target="_blank" className="underline hover:text-primary-600">מדיניות הפרטיות</Link>
            {' · '}
            <Link to="/legal/terms" target="_blank" className="underline hover:text-primary-600">תנאי השימוש</Link>
          </p>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-primary-600 flex-shrink-0" />
            <span className="text-sm text-gray-700 dark:text-gray-200">{CONSENT_CHECKBOX_LABEL}</span>
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleApprove} disabled={!checked || saving}
              className={clsx(
                'flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors',
                checked
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
              )}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : 'מאשר/ת — המשך'}
            </button>
            <button onClick={logout} disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 border border-gray-200 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700">
              לא מאשר/ת
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
