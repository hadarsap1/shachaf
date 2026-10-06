import { useState, useEffect } from 'react'
import { Share, Download, X, Copy, Check } from 'lucide-react'
import { isIOSDevice, inAppBrowserName } from '../../lib/installHelp'

const DISMISSED_KEY = 'shachaf_install_dismissed'
// Closing the banner keeps it closed across visits for a while — per tab
// (sessionStorage) it came back on every visit and the user had to hunt
// for the X again.
const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY))
    return at > 0 && Date.now() - at < DISMISS_FOR_MS
  } catch {
    return false
  }
}

function isStandalone() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)
  // null in a real browser; the app's name (or '') inside WhatsApp/Instagram/…
  const [inApp, setInApp] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    if (recentlyDismissed()) return

    if (isIOSDevice()) {
      setIos(true)
      setInApp(inAppBrowserName())
      setShow(true)
      return
    }

    // Android / Chrome — wait for browser's install event
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* private mode */ }
    setShow(false)
  }

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  // Inside an app's browser the only way forward is Safari, and the link the
  // user tapped is buried in a chat — hand them one to paste.
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (!show) return null

  return (
    // In the page flow under the top bar, not floating: a fixed card at the
    // bottom sat over the side menu and under the accessibility button, which
    // hid its X — the banner could not be closed.
    <div className="flex-shrink-0 px-4 pt-3" dir="rtl">
      <div className="bg-primary-700 text-white rounded-2xl shadow-md p-3 flex items-start gap-3 max-w-2xl mx-auto">
        <img src="/apple-touch-icon.png" alt="" className="w-9 h-9 rounded-xl flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-snug">התקן את האפליקציה</p>
          {ios && inApp !== null ? (
            <>
              <p className="text-xs text-primary-200 mt-0.5 leading-relaxed">
                {inApp ? `בדפדפן של ${inApp}` : 'בדפדפן שבתוך האפליקציה'} אין אפשרות להתקין.
                {' '}פתח את הקישור ב-<strong className="text-white">Safari</strong> ומשם הוסף למסך הבית.
              </p>
              <button
                onClick={copyLink}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold bg-white text-primary-700 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors dark:bg-gray-800 dark:hover:bg-primary-900/30 dark:text-primary-300"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'הקישור הועתק, הדבק אותו ב-Safari' : 'העתק קישור'}
              </button>
            </>
          ) : ios ? (
            <p className="text-xs text-primary-200 mt-0.5 leading-relaxed">
              ב-Safari לחץ על{' '}
              <Share size={12} className="inline-block mx-0.5 -mt-0.5" />
              {' '}שיתוף (או ••• ← שיתוף), גלול למטה ובחר <strong className="text-white">הוסף למסך הבית</strong>.
              {' '}נכנסת מוואטסאפ? פתח קודם ב-Safari.
            </p>
          ) : (
            <p className="text-xs text-primary-200 mt-0.5">
              גישה מהירה ישירות מהמסך הראשי
            </p>
          )}

          {!ios && (
            <button
              onClick={install}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold bg-white text-primary-700 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors dark:bg-gray-800 dark:hover:bg-primary-900/30 dark:text-primary-300"
            >
              <Download size={13} />
              התקן עכשיו
            </button>
          )}
        </div>

        <button
          onClick={dismiss}
          aria-label="סגור"
          className="p-2 -m-1 rounded-lg hover:bg-primary-600 text-primary-200 flex-shrink-0 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
