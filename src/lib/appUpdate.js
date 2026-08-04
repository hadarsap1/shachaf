// Keeping an installed app on the current version.
//
// A browser tab picks up a new deploy on the next navigation. An installed PWA
// does not: it can stay open for days, and the browser only looks for a new
// service worker when it feels like it. That is how a phone ends up running
// last week's code while the website is perfectly current — the exact split
// between "the app is broken" and "it works in the browser".
//
// So we check on purpose: whenever the app is brought back to the foreground,
// and on a slow timer while it stays open. When a new worker takes over,
// main.jsx reloads the page onto it.

export const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000   // 30 minutes
export const FOREGROUND_THROTTLE_MS = 60 * 1000          // don't hammer on tab flips

// Build stamp injected by Vite. Surfaced in Settings so a user can tell us
// which version they are actually on.
/* global __APP_VERSION__ */
export const APP_VERSION =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'

export function startUpdateWatch(registration, {
  doc = typeof document !== 'undefined' ? document : null,
  win = typeof window !== 'undefined' ? window : null,
  now = () => Date.now(),
  interval = UPDATE_CHECK_INTERVAL_MS,
} = {}) {
  if (!registration || typeof registration.update !== 'function') return () => {}

  let last = -Infinity          // "never checked" — the first call must go through
  const check = () => {
    if (now() - last < FOREGROUND_THROTTLE_MS) return
    last = now()
    // A failed check isn't worth surfacing — the next one tries again.
    try { Promise.resolve(registration.update()).catch(() => {}) } catch { /* ignore */ }
  }

  const onVisible = () => { if (!doc?.hidden) check() }
  doc?.addEventListener?.('visibilitychange', onVisible)
  win?.addEventListener?.('focus', check)
  const timer = setInterval(check, interval)
  check()

  return () => {
    doc?.removeEventListener?.('visibilitychange', onVisible)
    win?.removeEventListener?.('focus', check)
    clearInterval(timer)
  }
}
