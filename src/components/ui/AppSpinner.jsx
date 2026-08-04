import { useEffect, useState } from 'react'
import { clearAppCaches } from '../../lib/hardReload'

// The full-screen loader shown while auth and the user profile resolve.
//
// It admits defeat. When that resolution stalls — a wedged service worker, a
// Firestore channel that never answers — the user used to sit here forever with
// nothing to do, which is what "it just loads and loads" means in a bug report.
// After a few seconds we say so and offer the one thing that reliably unwedges a
// client: drop the service worker and its caches, then start over.
export const STUCK_AFTER_MS = 12000

export default function AppSpinner() {
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setStuck(true), STUCK_AFTER_MS)
    return () => clearTimeout(t)
  }, [])

  const hardReload = async () => {
    await clearAppCaches()
    window.location.replace('/login')
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 px-6" dir="rtl">
      <div className="bg-white/95 rounded-2xl px-5 py-3 mb-6 shadow-sm">
        <img src="/logo.png" alt="שחף+" className="h-14 w-auto" />
      </div>
      <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      {stuck && (
        <div className="mt-6 text-center max-w-xs">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            הטעינה לוקחת יותר מהרגיל. אפשר לרענן ולנסות שוב.
          </p>
          <button
            onClick={hardReload}
            className="mt-3 text-sm font-medium px-4 py-2 rounded-xl bg-primary-600 text-white hover:bg-primary-700"
          >
            רענון וניקוי מטמון
          </button>
        </div>
      )}
    </div>
  )
}
