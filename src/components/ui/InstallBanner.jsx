import { useState, useEffect } from 'react'
import { Share, Download, X } from 'lucide-react'

const DISMISSED_KEY = 'shachaf_install_dismissed'

function isStandalone() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    if (sessionStorage.getItem(DISMISSED_KEY)) return

    if (isIOS()) {
      setIos(true)
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
    sessionStorage.setItem(DISMISSED_KEY, '1')
    setShow(false)
  }

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  if (!show) return null

  return (
    <div
      className="fixed bottom-20 md:bottom-6 left-4 right-4 z-50 max-w-sm mx-auto"
      dir="rtl"
    >
      <div className="bg-primary-700 text-white rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <img src="/apple-touch-icon.png" alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-snug">התקן את האפליקציה</p>
          {ios ? (
            <p className="text-xs text-primary-200 mt-0.5 leading-relaxed">
              לחץ על{' '}
              <Share size={12} className="inline-block mx-0.5 -mt-0.5" />
              {' '}שיתוף ← <strong className="text-white">הוסף למסך הבית</strong>
            </p>
          ) : (
            <p className="text-xs text-primary-200 mt-0.5">
              גישה מהירה ישירות מהמסך הראשי
            </p>
          )}

          {!ios && (
            <button
              onClick={install}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold bg-white text-primary-700 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
            >
              <Download size={13} />
              התקן עכשיו
            </button>
          )}
        </div>

        <button
          onClick={dismiss}
          aria-label="סגור"
          className="p-1 rounded-lg hover:bg-primary-600 text-primary-200 flex-shrink-0 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
