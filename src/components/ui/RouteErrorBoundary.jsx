import { Component } from 'react'
import * as Sentry from '@sentry/react'
import { logCrash } from '../../lib/db'

// Per-route error boundary. Unlike the single root boundary, this resets
// automatically whenever `resetKey` (the pathname) changes — so a transient
// crash on one page recovers the moment you navigate away, with no full
// refresh. Shows a localized retry instead of a white screen.
export default class RouteErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() { return { hasError: true } }

  componentDidUpdate(prevProps) {
    // Navigated to a different route → clear the error and re-render the page
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  componentDidCatch(err, info) {
    console.error('Route crashed:', err, info?.componentStack)
    Sentry.captureException(err, { extra: { componentStack: info?.componentStack, route: this.props.resetKey } })
    logCrash({
      message: err?.message || String(err),
      stack: err?.stack,
      componentStack: info?.componentStack,
      route: this.props.resetKey,
      uid: this.props.uid,
      name: this.props.userName,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-6 text-center">
          <div className="text-4xl">🙈</div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">משהו השתבש בעמוד הזה</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">אפשר לנסות שוב או לעבור לעמוד אחר.</p>
          <div className="flex gap-2 mt-1">
            <button onClick={() => this.setState({ hasError: false })}
              className="btn-primary px-5 py-2 text-sm">נסו שוב</button>
            <button onClick={() => { window.location.href = '/' }}
              className="px-5 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">
              לדף הבית
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
