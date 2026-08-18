import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'
import { resolveAuthDomain, selfHostedAuthEnabled, usingSelfHostedAuth } from './authDomain'

// See lib/authDomain.js: when the /__/auth proxy is live, the sign-in handler
// is served from our own host, which is what lets an INSTALLED app finish a
// Google sign-in instead of bouncing the user to the browser.
export const AUTH_SELF_HOSTED = selfHostedAuthEnabled(import.meta.env)

export const authDomain = resolveAuthDomain({
  hostname: typeof window !== 'undefined' ? window.location.hostname : '',
  envAuthDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  selfHosted: AUTH_SELF_HOSTED,
})

// True when the handler really is served from this host — the login screen
// asks this before deciding whether an installed app must hand the sign-in over
// to the system browser.
export const AUTH_HANDLER_IS_FIRST_PARTY = usingSelfHostedAuth({
  hostname: typeof window !== 'undefined' ? window.location.hostname : '',
  envAuthDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  selfHosted: AUTH_SELF_HOSTED,
})

export const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app  = initializeApp(firebaseConfig)
export const auth    = getAuth(app)
export const db      = getFirestore(app)
export const storage = getStorage(app)

// ── Local emulators (E2E only) ───────────────────────────────────────────────
// Enabled by `VITE_USE_EMULATORS=1` in a dev server only. The `DEV` guard means
// a production bundle can never point at localhost, whatever the env holds.
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
}
