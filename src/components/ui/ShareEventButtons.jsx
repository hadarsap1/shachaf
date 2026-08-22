import { useState } from 'react'
import { Share2, Link2, Mail, Check } from 'lucide-react'
import clsx from 'clsx'
import { eventShareUrl, eventShareText, whatsappShareUrl, mailtoShareUrl } from '../../lib/eventShare'

// "שיתוף האירוע" — one implementation for the two places it is wanted: the
// event panel, and the moment right after someone opens an event (there is no
// worse time to hide a share button than the second the invitation exists).
//
// The phone's own share sheet handles WhatsApp/mail/anything installed. Where
// there is no share sheet — desktop, mostly — the explicit targets appear.
export default function ShareEventButtons({ event, compact = false }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const url = eventShareUrl(event?.id)
  const text = eventShareText(event, { url })
  if (!event?.id) return null

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text })
        return
      } catch (e) {
        // A cancelled share is not a failure — only a real one falls through.
        if (e?.name === 'AbortError') return
      }
    }
    setOpen(o => !o)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked — WhatsApp and mail still work */ }
  }

  const targetClass = 'flex flex-col items-center gap-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 no-underline hover:bg-gray-50 dark:hover:bg-gray-700/50'

  return (
    <div>
      <button
        type="button"
        onClick={share}
        className={clsx(
          'w-full flex items-center justify-center gap-1.5 font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 rounded-xl hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-[background-color] duration-150 active:scale-[0.98]',
          compact ? 'text-xs px-3 py-2' : 'text-sm px-3 py-2.5'
        )}
      >
        <Share2 size={14} />
        שיתוף האירוע
      </button>

      {open && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <a href={whatsappShareUrl(text)} target="_blank" rel="noreferrer" className={targetClass}>
            <Share2 size={15} className="text-green-600" />
            WhatsApp
          </a>
          <a href={mailtoShareUrl(event, text)} className={targetClass}>
            <Mail size={15} className="text-primary-500" />
            מייל
          </a>
          <button type="button" onClick={copy} className={targetClass}>
            {copied ? <Check size={15} className="text-green-600" /> : <Link2 size={15} className="text-gray-500" />}
            {copied ? 'הועתק' : 'העתקת קישור'}
          </button>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center mt-2">
        הקישור פותח את האירוע באפליקציה — רק לחברי הקהילה שהאירוע מיועד להם
      </p>
    </div>
  )
}
