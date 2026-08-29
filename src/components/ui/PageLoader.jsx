import { useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { clearAppCaches, reloadFresh } from '../../lib/hardReload'
import { clearAutoReloads } from '../../lib/reloadBudget'

// The in-app version of AppSpinner: a page-level loader that admits defeat.
//
// AppSpinner already does this for the login/profile stage, but once inside the
// app every page had its own bare spinner with nothing behind it. A stalled
// Firestore read left that circle turning with no error and nothing to press.
// Now the page says so and offers a retry that refetches (the caller drops the
// read cache first — a hung request would otherwise be awaited a second time).
export const STUCK_AFTER_MS = 10000
// A refetch fixes a slow network; it cannot fix a client wedged on a stale
// build (a deploy landed while the app was open). After a second wait, offer
// the thing that does: drop the worker and its caches, then reload.
export const WEDGED_AFTER_MS = 22000

async function hardReload() {
  // A person pressed this. That is a better guard than any counter, so give
  // the automatic-reload budget back before spending a reload of our own.
  clearAutoReloads()
  await clearAppCaches()
  await reloadFresh()
}

export default function PageLoader({ onRetry, label = 'טוען…' }) {
  const [stuck, setStuck] = useState(false)
  const [wedged, setWedged] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setStuck(true), STUCK_AFTER_MS)
    const t2 = setTimeout(() => setWedged(true), WEDGED_AFTER_MS)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6" dir="rtl">
      <Loader2 size={32} className="animate-spin text-primary-400" />
      <span className="sr-only">{label}</span>
      {stuck && (
        <div className="mt-5 text-center max-w-xs">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            הטעינה לוקחת יותר מהרגיל. בדקו את החיבור לאינטרנט.
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-primary-600 text-white hover:bg-primary-700"
            >
              <RefreshCw size={14} />
              נסו שוב
            </button>
          )}
          {wedged && (
            <button
              onClick={hardReload}
              className="mt-3 block mx-auto text-xs text-gray-500 dark:text-gray-400 underline"
            >
              עדיין תקוע? רענון וניקוי מטמון
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// The same message once the load has actually failed (or timed out) — a dead
// end otherwise, since a failed load leaves an empty page behind it.
export function PageLoadError({ onRetry, timedOut = false }) {
  return (
    <div className="text-center py-16 px-6" dir="rtl">
      <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">
        {timedOut ? 'לא הצלחנו לטעון את הנתונים בזמן' : 'לא הצלחנו לטעון את הנתונים'}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        בדקו את החיבור לאינטרנט ונסו שוב
      </p>
      {onRetry && (
        <button onClick={onRetry}
          className="inline-flex items-center gap-1.5 btn-primary px-6 py-2.5 text-sm">
          <RefreshCw size={14} />
          נסו שוב
        </button>
      )}
    </div>
  )
}
