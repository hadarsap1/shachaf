import { useState } from 'react'
import { Loader2, Users } from 'lucide-react'
import clsx from 'clsx'

// Explicit-consent step before joining a committee / community group:
// membership makes the member's name (and presence) visible to the other
// members, so the join runs only after the user ticked the consent checkbox.
// The caller logs the consent (logConsent) as part of onConfirm.
export default function JoinConsentModal({ kind, name, onConfirm, onClose }) {
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const kindLabel = kind === 'committee' ? 'הוועדה' : 'הקבוצה'

  const handleConfirm = async () => {
    if (!checked || saving) return
    setSaving(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      console.error('join failed', e)
      setError('ההצטרפות נכשלה — נסו שוב')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
      <div role="dialog" aria-modal="true" aria-label={`אישור הצטרפות ל${kindLabel}`}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
            <Users size={19} className="text-primary-600 dark:text-primary-300" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">הצטרפות ל{kindLabel} "{name}"</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">נדרש אישור חד-פעמי</p>
          </div>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-primary-600 flex-shrink-0" />
          <span className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
            אני מאשר/ת את הצטרפותי ל{kindLabel}, ומאשר/ת ששמי והצטרפותי יוצגו
            לחברי {kindLabel} ולחברי הקהילה, בהתאם לתקנון. ניתן לעזוב בכל עת.
          </span>
        </label>

        {error && <p className="text-xs text-red-500 text-right">{error}</p>}

        <div className="flex gap-2">
          <button onClick={handleConfirm} disabled={!checked || saving}
            className={clsx(
              'flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors',
              checked
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
            )}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : 'מאשר/ת — הצטרפות'}
          </button>
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 border border-gray-200 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700">
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
