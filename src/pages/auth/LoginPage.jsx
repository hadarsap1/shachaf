import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Users, Shield, Home, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import clsx from 'clsx'

const DEMO_ROLES = [
  { key: 'newFamily',  label: 'משפחה חדשה',  sub: 'צפייה במשימות, אירועים ועזר', icon: Home,   iconBg: 'bg-primary-100',   iconColor: 'text-primary-600' },
  { key: 'hostFamily', label: 'משפחה מארחת', sub: 'ניהול משפחות מוקצות',         icon: Users,  iconBg: 'bg-secondary-100', iconColor: 'text-secondary-600' },
  { key: 'admin',      label: 'מנהל / ועד',  sub: 'ניהול משימות, טפסים ואירועים', icon: Shield, iconBg: 'bg-accent-100',    iconColor: 'text-accent-600' },
  { key: 'superAdmin', label: 'מנהל ראשי',   sub: 'הרשאות מלאות כולל ניהול מנהלים', icon: Shield, iconBg: 'bg-red-100', iconColor: 'text-red-600', subtle: true },
]

const ROLE_PATH = { newFamily: '/dashboard', hostFamily: '/dashboard', admin: '/admin', superAdmin: '/admin' }

const GOOGLE_PENDING_KEY = 'shachaf_google_pending'
const GOOGLE_PENDING_TTL = 2 * 60 * 1000 // 2 minutes

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function isStandalone() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

function consumeStaleGooglePending() {
  const ts = localStorage.getItem(GOOGLE_PENDING_KEY)
  if (!ts) return false
  if (Date.now() - Number(ts) > GOOGLE_PENDING_TTL) {
    localStorage.removeItem(GOOGLE_PENDING_KEY)
    return false
  }
  return true
}

export default function LoginPage() {
  const { user, loginDemo, loginWithEmail, loginWithGoogle, registerWithEmail, resetPassword } = useAuth()
  const navigate = useNavigate()

  // Redirect when user becomes authenticated (handles iOS redirect return)
  useEffect(() => {
    if (user) {
      localStorage.removeItem(GOOGLE_PENDING_KEY)
      setAwaitingGoogleReturn(false)
      navigate(
        user.role === 'admin' || user.role === 'super_admin' ? '/admin' : '/dashboard',
        { replace: true }
      )
    }
  }, [user])

  // iOS (both standalone and Safari): when user returns from Google auth in Safari,
  // reload so Firebase re-reads IndexedDB.
  // On iOS 16.4+ the PWA and Safari share the same origin's IndexedDB, so after
  // completing Google auth in Safari the standalone app picks up the session on reload.
  useEffect(() => {
    if (!isIOS() || !localStorage.getItem(GOOGLE_PENDING_KEY)) return
    const onVisible = () => {
      if (!document.hidden) window.location.reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const [mode, setMode]           = useState('login')   // 'login' | 'register' | 'reset' | 'demo'
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [name, setName]           = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(null)
  const [error, setError]         = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [awaitingGoogleReturn, setAwaitingGoogleReturn] = useState(
    () => isIOS() && consumeStaleGooglePending()
  )

  // Called by the standalone anchor tag's onClick — sets state but lets the
  // default anchor navigation open Safari (window.open is blocked in WKWebView)
  const handleGoogleStandaloneClick = () => {
    localStorage.setItem(GOOGLE_PENDING_KEY, String(Date.now()))
    setAwaitingGoogleReturn(true)
  }

  const handleGoogle = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      if (isIOS()) {
        localStorage.setItem(GOOGLE_PENDING_KEY, String(Date.now()))
        setAwaitingGoogleReturn(true)
      }
      await loginWithGoogle()
      // useEffect on user handles navigation (admin → /admin, others → /dashboard)
    } catch (err) {
      localStorage.removeItem(GOOGLE_PENDING_KEY)
      setAwaitingGoogleReturn(false)
      const msg = firebaseError(err.code)
      if (msg) setError(msg)
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleDemoLogin = async (roleKey) => {
    setLoading(roleKey)
    await new Promise(r => setTimeout(r, 300))
    loginDemo(roleKey)
    navigate(ROLE_PATH[roleKey] || '/dashboard')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading('login')
    try {
      await loginWithEmail(email, password)
      // useEffect on user handles navigation
    } catch (err) {
      setError(firebaseError(err.code))
    } finally {
      setLoading(null)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('נא להזין שם'); return }
    setLoading('register')
    try {
      await registerWithEmail(email, password, name.trim())
      // useEffect on user handles navigation
    } catch (err) {
      setError(firebaseError(err.code))
    } finally {
      setLoading(null)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setError('')
    setLoading('reset')
    try {
      await resetPassword(email)
      setResetSent(true)
    } catch (err) {
      setError(firebaseError(err.code))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-700 via-primary-600 to-secondary-500 flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-white/5" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="bg-white rounded-3xl shadow-modal px-8 py-5 inline-block mb-3">
            <img src="/logo.png" alt="שחף" className="h-20 w-auto mx-auto" />
          </div>
          <p className="text-primary-100 text-sm">פלטפורמת קליטה של הקהילה</p>
        </div>

        <div className="bg-white rounded-3xl shadow-modal p-6 sm:p-8" dir="rtl">
          {mode === 'demo' ? (
            <>
              <div className="flex items-center gap-2 mb-5">
                <button onClick={() => setMode('login')} className="p-1 text-gray-400 hover:text-gray-600">
                  <ArrowRight size={18} />
                </button>
                <h2 className="text-lg font-bold text-gray-800">כניסת דמו</h2>
              </div>
              <div className="space-y-3">
                {DEMO_ROLES.map(role => {
                  const Icon = role.icon
                  return (
                    <button key={role.key} onClick={() => handleDemoLogin(role.key)}
                      disabled={loading !== null}
                      className={clsx(
                        'w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all group',
                        role.subtle
                          ? 'border-dashed border-gray-200 hover:border-red-200 hover:bg-red-50/30'
                          : 'border-gray-100 hover:border-primary-200 hover:bg-primary-50/50'
                      )}>
                      <div className={`p-2.5 rounded-xl ${role.iconBg} group-hover:scale-105 transition-transform`}>
                        <Icon size={20} className={role.iconColor} />
                      </div>
                      <div className="text-right flex-1">
                        <div className={`font-semibold text-sm ${role.subtle ? 'text-gray-600' : 'text-gray-800'}`}>{role.label}</div>
                        <div className="text-xs text-gray-500">{role.sub}</div>
                      </div>
                      {loading === role.key && <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />}
                    </button>
                  )
                })}
              </div>
            </>
          ) : mode === 'reset' ? (
            <>
              <div className="flex items-center gap-2 mb-5">
                <button onClick={() => { setMode('login'); setResetSent(false); setError('') }} className="p-1 text-gray-400 hover:text-gray-600">
                  <ArrowRight size={18} />
                </button>
                <h2 className="text-lg font-bold text-gray-800">איפוס סיסמה</h2>
              </div>
              {resetSent ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">📬</div>
                  <p className="font-semibold text-gray-800">נשלח מייל לאיפוס</p>
                  <p className="text-sm text-gray-500 mt-1">בדוק את תיבת הדואר שלך</p>
                  <button onClick={() => { setMode('login'); setResetSent(false) }} className="mt-4 text-sm text-primary-600 hover:underline">
                    חזרה לכניסה
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 text-right mb-1">כתובת מייל</label>
                    <div className="relative">
                      <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                        placeholder="כתובת מייל" className="input w-full pr-9 text-right" />
                    </div>
                  </div>
                  {error && <p className="text-sm text-red-500 text-right">{error}</p>}
                  <button type="submit" disabled={loading === 'reset'} className="w-full btn-primary py-3 flex items-center justify-center gap-2">
                    {loading === 'reset' ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'שלח מייל לאיפוס'}
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-1 text-center">
                {mode === 'register' ? 'יצירת חשבון' : 'כניסה לחשבון'}
              </h2>
              <p className="text-sm text-gray-500 text-center mb-6">
                {mode === 'register' ? 'הצטרף לפלטפורמת הקליטה של שחף' : 'ברוכים הבאים לשחף'}
              </p>

              {/* Google */}
              {awaitingGoogleReturn ? (
                <div className="w-full flex flex-col items-center gap-2 border border-primary-200 bg-primary-50 rounded-xl py-3 px-4 text-sm text-primary-700 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <span className="font-medium">ממתין לכניסה ב-Google...</span>
                  </div>
                  <p className="text-xs text-primary-500 text-center">
                    {isStandalone()
                      ? 'השלם כניסה עם Google בדפדפן שנפתח — לאחר מכן חזור לאפליקציה'
                      : 'חזור לאפליקציה לאחר הכניסה בדפדפן'}
                  </p>
                  <button
                    type="button"
                    onClick={() => { localStorage.removeItem(GOOGLE_PENDING_KEY); setAwaitingGoogleReturn(false) }}
                    className="text-xs text-primary-400 hover:text-primary-600 underline mt-1"
                  >
                    ביטול
                  </button>
                </div>
              ) : isStandalone() ? (
                // window.open is blocked in standalone WKWebView.
                // A real <a target="_blank"> tap IS honored by iOS and opens in Safari.
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={handleGoogleStandaloneClick}
                  className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 px-4 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 mb-4 no-underline"
                >
                  <GoogleIcon />
                  המשך עם Google
                </a>
              ) : (
                <button type="button" onClick={handleGoogle} disabled={googleLoading || loading !== null}
                  className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 px-4 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 mb-4">
                  {googleLoading
                    ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    : <GoogleIcon />
                  }
                  המשך עם Google
                </button>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">או</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <form onSubmit={mode === 'register' ? handleRegister : handleLogin} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 text-right mb-1">שם מלא</label>
                    <input value={name} onChange={e => setName(e.target.value)} required
                      placeholder="שם מלא" className="input w-full text-right" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 text-right mb-1">כתובת מייל</label>
                  <div className="relative">
                    <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                      placeholder="כתובת מייל" className="input w-full pr-9 text-right" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 text-right mb-1">סיסמה</label>
                  <div className="relative">
                    <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                      placeholder="סיסמה" className="input w-full pr-9 pl-9 text-right" />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      aria-label={showPass ? 'הסתר סיסמה' : 'הצג סיסמה'}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm text-red-500 text-right">{error}</p>}

                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('reset'); setError('') }}
                    className="w-full text-right py-1 text-sm text-primary-600 hover:underline"
                  >
                    שכחת סיסמה?
                  </button>
                )}

                <button type="submit"
                  disabled={loading === 'login' || loading === 'register'}
                  className="w-full btn-primary py-3 flex items-center justify-center gap-2">
                  {(loading === 'login' || loading === 'register')
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : mode === 'register' ? 'הרשמה' : 'כניסה'
                  }
                </button>
              </form>

              <div className="mt-5 text-center space-y-3">
                <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
                  className="text-sm text-primary-600 hover:underline">
                  {mode === 'login' ? 'אין לך חשבון? הירשם' : 'יש לך חשבון? כנס'}
                </button>

                <div className="text-xs text-gray-300">—</div>

                {import.meta.env.DEV && (
                  <button onClick={() => { setMode('demo'); setError('') }}
                    className="text-xs text-gray-400 hover:text-gray-600">
                    כניסת דמו (בדיקות)
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <p className="text-center text-primary-200 text-xs mt-4">
          בית הספר שחף © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function firebaseError(code) {
  const map = {
    'auth/user-not-found':        'מייל או סיסמה שגויים',
    'auth/wrong-password':        'מייל או סיסמה שגויים',
    'auth/invalid-credential':    'מייל או סיסמה שגויים',
    'auth/email-already-in-use':  'כתובת המייל כבר בשימוש',
    'auth/weak-password':         'הסיסמה חלשה מדי (מינימום 6 תווים)',
    'auth/invalid-email':         'כתובת מייל לא תקינה',
    'auth/too-many-requests':     'יותר מדי ניסיונות — נסה שוב מאוחר יותר',
    'auth/popup-blocked':         'הדפדפן חסם את חלון Google — אפשר חלונות קופצים ונסה שוב',
    'auth/unauthorized-domain':   'הדומיין לא מורשה ב-Firebase — פנה למנהל',
    'auth/cancelled-popup-request': null, // silently ignore
    'auth/network-request-failed': 'בעיית רשת — בדוק את החיבור לאינטרנט',
  }
  if (code in map) return map[code]  // null = silent
  return `שגיאה (${code || 'unknown'})`
}
