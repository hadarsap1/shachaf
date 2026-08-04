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
