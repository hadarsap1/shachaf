// How many times the app is allowed to reload ITSELF before it stops and says
// something.
//
// Four different places can decide to reload the page on their own: the
// service-worker takeover in main.jsx, the stale-build recovery in
// chunkRecovery.js, the boot rescue in public/rescue.js, and the manual
// buttons. Each of them used to guard itself — or, in the takeover's case, not
// at all — and a per-place, per-session guard is no guard: the condition comes
// back on the next launch, every launch, and the app spends its life blinking
// through reloads without ever admitting that it is not coming up. That is what
// "כל הזמן קופץ ומרצד" is.
//
// So there is one budget, shared by all of them, and it lives in localStorage
// rather than sessionStorage: a relaunched installed app is exactly the case a
// per-session guard misses. A genuine self-heal costs one reload and the budget
// refills on its own; a loop burns through it in seconds and then has to show
// the user a real screen instead of another flash.
//
// public/rescue.js runs before the bundle and cannot import this file. It
// reimplements read/note against the SAME key and format — change one, change
// the other.

export const BUDGET_KEY = 'shachaf_auto_reloads'

// Enough for a real recovery (worker takeover, then a stale-build heal) with
// one to spare; far short of a loop.
export const MAX_AUTO_RELOADS = 3
export const WINDOW_MS = 10 * 60 * 1000

const store = () => (typeof localStorage !== 'undefined' ? localStorage : null)

// Timestamps of the automatic reloads still inside the window, oldest first.
export function recentReloads(storage = store(), now = Date.now()) {
  if (!storage) return []
  try {
    const raw = JSON.parse(storage.getItem(BUDGET_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter(t => typeof t === 'number' && now - t < WINDOW_MS && t <= now)
  } catch {
    return []
  }
}

// No storage means no way to count, and an uncounted auto-reload is how a
// broken build becomes an endless refresh — so the answer is no.
export function canAutoReload(storage = store(), now = Date.now()) {
  if (!storage) return false
  return recentReloads(storage, now).length < MAX_AUTO_RELOADS
}

export function noteAutoReload(storage = store(), now = Date.now()) {
  if (!storage) return
  try {
    storage.setItem(BUDGET_KEY, JSON.stringify(recentReloads(storage, now).concat(now)))
  } catch { /* private mode — canAutoReload already refuses without storage */ }
}

// The user pressed something. A person watching the screen is the one guard
// a counter cannot improve on, so hand the budget back.
export function clearAutoReloads(storage = store()) {
  try { storage?.removeItem(BUDGET_KEY) } catch { /* ignore */ }
}
