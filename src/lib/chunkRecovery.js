// Surviving a deploy that lands while the app is open.
//
// The app is code-split: pages arrive as /assets/<name>-<hash>.js, imported on
// demand. Every deploy mints new hashes, and the production alias only serves
// the CURRENT build's files — the previous build's chunk URLs stop existing.
// A phone holding yesterday's index.html (or a service worker that just took
// over mid-session) therefore asks for a file that is gone, the import
// rejects, and the app dies on a page it could render perfectly well: "נתקעת
// ולא נטענת", and then it works "after a few tries" because one of those tries
// happened to fetch a consistent set.
//
// A refresh alone is not enough — the service worker can hand back the same
// stale index from its cache. The way out is to drop the worker and its
// caches, then reload; that is what clearAppCaches does, and this module is
// the decision of WHEN, guarded so a genuinely broken build cannot become a
// reload loop.

export const RECOVERY_KEY = 'shachaf_stale_build_reload'

// Every browser words it differently, and the wording is all we get.
const CHUNK_ERROR = /(failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|failed to load module script|chunkloaderror|loading chunk \S+ failed|dynamically imported module)/i

export function isStaleBuildError(err) {
  if (!err) return false
  const text = `${err.message || ''} ${err.name || ''} ${typeof err === 'string' ? err : ''}`
  return CHUNK_ERROR.test(text)
}

// Once per browsing session. A second failure after a clean reload is not a
// stale build — it is a broken one, and looping would only hide it.
export function canRecover(storage) {
  // No storage means no guard, and an unguarded auto-reload is how a broken
  // build becomes an infinite refresh. The manual escape hatch in AppSpinner
  // still covers that case.
  if (!storage) return false
  try { return !storage.getItem(RECOVERY_KEY) } catch { return false }
}

export function markRecovered(storage) {
  try { storage?.setItem(RECOVERY_KEY, String(Date.now())) } catch { /* private mode */ }
}

// Returns true if it took over (caller should stop rendering its error state).
export async function recoverFromStaleBuild({
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  clearCaches,
  reload = () => window.location.reload(),
} = {}) {
  if (!canRecover(storage)) return false
  markRecovered(storage)
  try { await clearCaches?.() } catch { /* best effort — reload anyway */ }
  reload()
  return true
}
