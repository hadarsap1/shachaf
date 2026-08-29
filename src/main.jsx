import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'
import { startUpdateWatch } from './lib/appUpdate'
import { isStaleBuildError, recoverFromStaleBuild } from './lib/chunkRecovery'
import { canAutoReload, noteAutoReload, clearAutoReloads } from './lib/reloadBudget'
import { clearAppCaches, reloadFresh } from './lib/hardReload'

const healStaleBuild = () => recoverFromStaleBuild({ clearCaches: clearAppCaches })

// A deploy replaces every chunk hash, and the production alias stops serving
// the previous build's files. A page still holding the old index then asks for
// a chunk that no longer exists and dies on a page it could render fine. Vite
// announces exactly that, so heal instead of crashing: drop the worker and its
// caches, reload once, and the app comes back on the current build.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault?.()
  healStaleBuild()
})
window.addEventListener('unhandledrejection', (e) => {
  if (isStaleBuildError(e?.reason)) healStaleBuild()
})

// PWA: the service worker updates with skipWaiting+clientsClaim, so a new
// deploy takes over a RUNNING page mid-session. That silently breaks the
// Firestore WebChannel — in-flight queries hang forever (endless spinners)
// and lazy chunks with old hashes 404. Reload when a NEW worker takes control
// so the app restarts cleanly on the new bundle. The hadController guard skips
// the very first install (no takeover → nothing to restart onto).
//
// hadController alone is not enough. A worker that keeps re-taking control —
// two builds behind one alias, an install that never settles — hands this
// listener the same event on every load, and an unguarded reload there is an
// app that blinks forever without ever coming up. So the takeover spends from
// the shared budget too; once it is out, the page stays put and whatever is
// wrong gets to be visible instead of being reloaded away.
if ('serviceWorker' in navigator) {
  let hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const takeover = hadController
    hadController = true
    if (!takeover) return
    if (!canAutoReload()) return
    noteAutoReload()
    window.location.reload()
  })

  // An installed app can stay open for days without ever checking for a new
  // deploy — that is how a phone ends up on last week's build while the
  // website is current. Ask the browser to look, every time the app comes back
  // to the foreground and on a slow timer while it is open.
  navigator.serviceWorker.ready
    .then(reg => startUpdateWatch(reg))
    .catch(() => {})
}

// Error monitoring — no-op unless a DSN is configured
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Errors only — no session replay or tracing (privacy: school families app)
    sendDefaultPii: false,
  })
}

class ErrorBoundary extends Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err, info) {
    // A missing chunk is a stale client, not a bug in the page — reload onto
    // the current build instead of showing a dead end.
    if (isStaleBuildError(err)) { healStaleBuild(); return }
    console.error('App crashed:', err, info)
    Sentry.captureException(err, { extra: { componentStack: info?.componentStack } })
    // Best-effort record; dynamic import so a broken bundle path can't block it
    import('./lib/db')
      .then(m => m.logCrash({ message: err?.message || String(err), stack: err?.stack, componentStack: info?.componentStack, route: location.pathname }))
      .catch(() => {})
  }
  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>משהו השתבש</h1>
          <p style={{ color: '#6b7280' }}>נסו לרענן את הדף. אם הבעיה נמשכת, פנו אלינו.</p>
          <button onClick={() => { clearAutoReloads(); reloadFresh() }} style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontSize: 15, cursor: 'pointer' }}>
            רענון
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
