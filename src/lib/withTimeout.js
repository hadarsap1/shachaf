// A deadline for anything a screen waits on.
//
// Firestore's channel can stall without ever answering AND without ever
// failing: the promise simply never settles. Every `.finally(() => setLoading
// (false))` in the app is then never reached, and the page sits on a spinning
// circle with no error, no retry and nothing to press — which is exactly what
// "האפליקציה נתקעת" looks like from the outside. AuthContext has guarded its
// own reads this way since the login hang; page loads need the same guard, so
// the rule lives in one place.

export const PAGE_LOAD_TIMEOUT_MS = 15000

// Rejects with code 'app/timeout' if `promise` has not settled in time. The
// underlying request is NOT cancelled — Firestore may still answer later and
// fill its cache; we simply stop the screen from waiting on it forever.
export function withTimeout(promise, ms = PAGE_LOAD_TIMEOUT_MS) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(Object.assign(new Error('timeout'), { code: 'app/timeout' })),
        ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

export function isTimeout(err) {
  return err?.code === 'app/timeout'
}
