// Where Firebase Auth's sign-in handler is served from — the reason an
// installed app could not sign in at all.
//
// signInWithRedirect parks its pending state in storage that belongs to the
// `authDomain`. With Firebase's default (`<project>.firebaseapp.com`) that
// storage is THIRD-PARTY to us: Safari's ITP and Chrome's storage partitioning
// throw it away, so the app comes back from Google signed out and lands on the
// login screen again. A browser tab papers over this with signInWithPopup — the
// popup talks to its opener directly — which is exactly why "it works in the
// browser but not in the installed app".
//
// The documented fix is to stop being third-party: vercel.json proxies
// /__/auth/* to the Firebase handler, so the entire flow runs on our own host
// and no cross-site storage is involved. Two things must both be true:
//   1. the proxy is deployed (vercel.json), and
//   2. https://<host>/__/auth/handler is listed as an authorized redirect URI
//      on the project's Google OAuth client (Google Cloud → Credentials), and
//      <host> is an authorized domain in Firebase Auth.
// (2) can only be done in the console. Until it is, Google answers
// redirect_uri_mismatch — so this stays an explicit switch rather than an
// assumption: VITE_AUTH_SELF_HOSTED=1 turns it on, and clearing it turns it
// back off with a redeploy and no code change.

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]']

// Reads the flag the way Vite hands it over — '1'/'true' on, anything else off.
export function selfHostedAuthEnabled(env = {}) {
  const raw = String(env.VITE_AUTH_SELF_HOSTED ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true'
}

// The host serving /__/auth/* for this page load. Falls back to the project's
// firebaseapp.com domain whenever the proxy cannot be there: the switch is off,
// or we're on localhost, where nothing proxies.
export function resolveAuthDomain({ hostname = '', envAuthDomain = '', selfHosted = false } = {}) {
  if (!selfHosted) return envAuthDomain
  if (!hostname || LOCAL_HOSTS.includes(hostname)) return envAuthDomain
  return hostname
}

// True when this page load actually runs the first-party flow — the login
// screen uses it to decide whether an installed app can finish sign-in itself
// or still needs the hand-off to the system browser.
export function usingSelfHostedAuth({ hostname = '', envAuthDomain = '', selfHosted = false } = {}) {
  return resolveAuthDomain({ hostname, envAuthDomain, selfHosted }) === hostname && !!hostname
}
