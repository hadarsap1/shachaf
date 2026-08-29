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
// stale index from its cache, and so can the browser's own HTTP cache. The way
// out is to drop the worker and its caches and re-fetch the document, which is
// what clearAppCaches + reloadFresh do; this module is the decision of WHEN.
//
// This decision is NOT the module's own to make twice. Every automatic reload
// in the app draws on the shared budget in reloadBudget.js, so a build that is
// genuinely broken costs the user a couple of flashes and then gets an error
// screen, instead of an app that reloads itself forever.

import { canAutoReload, noteAutoReload } from './reloadBudget'
import { reloadFresh } from './hardReload'

// Every browser words it differently, and the wording is all we get.
const CHUNK_ERROR = /(failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|failed to load module script|chunkloaderror|loading chunk \S+ failed|dynamically imported module)/i

export function isStaleBuildError(err) {
  if (!err) return false
  const text = `${err.message || ''} ${err.name || ''} ${typeof err === 'string' ? err : ''}`
  return CHUNK_ERROR.test(text)
}

// Returns true if it took over (caller should stop rendering its error state).
export async function recoverFromStaleBuild({
  storage = typeof localStorage !== 'undefined' ? localStorage : null,
  now = () => Date.now(),
  clearCaches,
  reload = () => reloadFresh(),
} = {}) {
  if (!canAutoReload(storage, now())) return false
  noteAutoReload(storage, now())
  try { await clearCaches?.() } catch { /* best effort — reload anyway */ }
  reload()
  return true
}
