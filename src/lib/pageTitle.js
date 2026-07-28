// Lets a page publish a live title that overrides the nav-derived one.
//
// The header title normally comes from the matching nav link's label, which is
// static — so /class showed "הכיתות שלי — ג, א׳" (every class) even while the
// user was viewing one specific class. ClassPage publishes the class actually
// on screen instead, and clears it on unmount.
//
// A module-level store + useSyncExternalStore keeps this to a few lines with no
// extra provider around the tree.

let current = ''
const listeners = new Set()

export function setPageTitleOverride(value) {
  const next = value || ''
  if (next === current) return
  current = next
  listeners.forEach(fn => fn())
}

export function subscribePageTitle(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getPageTitleOverride() {
  return current
}
