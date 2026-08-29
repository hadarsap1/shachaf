// Unwedging a stuck client.
//
// A service worker that has claimed the page can keep serving a broken mix of
// cached assets, and a plain refresh will not shake it off. Dropping the
// registrations and every cache entry does. Best effort by design: if any step
// fails we still want the caller to reload.
export async function clearAppCaches(nav = typeof navigator !== 'undefined' ? navigator : null,
                                     cacheStore = typeof caches !== 'undefined' ? caches : null) {
  const results = { serviceWorkers: 0, caches: 0 }
  try {
    if (nav && 'serviceWorker' in nav) {
      const regs = await nav.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
      results.serviceWorkers = regs.length
    }
  } catch { /* ignore */ }
  try {
    if (cacheStore) {
      const keys = await cacheStore.keys()
      await Promise.all(keys.map(k => cacheStore.delete(k)))
      results.caches = keys.length
    }
  } catch { /* ignore */ }
  return results
}

// Reload onto a freshly fetched document.
//
// Dropping the worker and its caches still leaves the browser's own HTTP cache,
// and location.reload() is allowed to answer from it. When the thing that is
// stale IS the index — it names chunk URLs the server no longer has — that
// reload lands on the same broken page, which is how "refresh and it fixes
// itself" turns into a refresh that changes nothing. Re-fetching the document
// with cache:'reload' replaces the cached entry first, so the reload gets the
// current index. Best effort: if the fetch fails we reload regardless.
export async function reloadFresh(win = typeof window !== 'undefined' ? window : null,
                                  doFetch = typeof fetch !== 'undefined' ? fetch : null) {
  if (!win) return
  try {
    if (doFetch) await doFetch(win.location.href, { cache: 'reload', credentials: 'same-origin' })
  } catch { /* offline or blocked — reload anyway */ }
  win.location.reload()
}
