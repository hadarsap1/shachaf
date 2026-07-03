import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

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
    console.error('App crashed:', err, info)
    Sentry.captureException(err, { extra: { componentStack: info?.componentStack } })
  }
  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>משהו השתבש</h1>
          <p style={{ color: '#6b7280' }}>נסו לרענן את הדף. אם הבעיה נמשכת, פנו אלינו.</p>
          <button onClick={() => window.location.reload()} style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontSize: 15, cursor: 'pointer' }}>
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
