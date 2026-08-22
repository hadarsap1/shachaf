import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth, GOOGLE_PENDING_KEY } from '../../context/AuthContext'
import { AUTH_HANDLER_IS_FIRST_PARTY } from '../../lib/firebase'
import { safeNextPath } from '../../lib/eventShare'
import LoginHelpButton from '../../components/LoginHelpButton'
import { hebrewNameError, normalizeName } from '../../lib/hebrewName'
import { Users, Shield, Home, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import clsx from 'clsx'

const DEMO_ROLES = [
  { key: 'newFamily',  label: 'משפחה חדשה',  sub: 'צפייה במשימות, אירועים ועזר', icon: Home,   iconBg: 'bg-primary-100',   iconColor: 'text-primary-600' },
  { key: 'hostFamily', label: 'משפחה קולטת', sub: 'ניהול משפחות מוקצות',         icon: Users,  iconBg: 'bg-secondary-100', iconColor: 'text-secondary-600' },
  { key: 'admin',      label: 'מנהל / ועד',  sub: 'ניהול משימות, טפסים ואירועים', icon: Shield, iconBg: 'bg-accent-100',    iconColor: 'text-accent-600' },
  { key: 'superAdmin', label: 'מנהל ראשי',   sub: 'הרשאות מלאות כולל ניהול מנהלים', icon: Shield, iconBg: 'bg-red-100', iconColor: 'text-red-600', subtle: true },
]

const ROLE_PATH = { newFamily: '/dashboard', hostFamily: '/dashboard', admin: '/admin', superAdmin: '/admin' }

const GOOGLE_PENDING_TTL = 2 * 60 * 1000   // a redirect that takes longer than this is gone
const GOOGLE_WAIT_GIVEUP_MS = 30 * 1000    // stop waiting for a redirect and say so
const GOOGLE_CALL_TIMEOUT_MS = 90 * 1000   // generous: the user may be typing a password
const RELOAD_GUARD_KEY = 'shachaf_google_reloaded'

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
  const { user, authError, clearAuthError, loginDemo, loginWithEmail, loginWithGoogle, registerWithEmail, resetPassword } = useAuth()
  const navigate = useNavigate()

  // Descriptive page title (WCAG 2.4.2)
  useEffect(() => {
    document.title = 'התחברות — שחף+'
    return () => { document.title = 'שחף+' }
  }, [])

  // Redirect when user becomes authenticated (handles iOS redirect return).
  // A ?next carried in from a shared link wins over the default landing page —
  // that is what makes an event link open the event and not the dashboard.
  useEffect(() => {
    if (user) {
      localStorage.removeItem(GOOGLE_PENDING_KEY)
      sessionStorage.removeItem(RELOAD_GUARD_KEY)
      setAwaitingGoogleReturn(false)
      const home = user.role === 'admin' || user.role === 'super_admin' ? '/admin' : '/dashboard'
      const next = new URLSearchParams(window.location.search).get('next')
      navigate(safeNextPath(next, home), { replace: true })
    }
  }, [user])

  // iOS (both standalone and Safari): when user returns from Google auth in Safari,
  // reload so Firebase re-reads IndexedDB.
  // On iOS 16.4+ the PWA and Safari share the same origin's IndexedDB, so after
  // completing Google auth in Safari the standalone app picks up the session on reload.
  useEffect(() => {
    if (!isIOS() || !localStorage.getItem(GOOGLE_PENDING_KEY)) return
    const onVisible = () => {
      if (document.hidden) return
      // Reload at most once per attempt. Reloading on every return turned a
      // failed sign-in into an endless refresh loop that reads as "stuck".
      if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return
      sessionStorage.setItem(RELOAD_GUARD_KEY, '1')
      window.location.reload()
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
  const [regRoles, setRegRoles]   = useState(new Set())
  const [error, setError]         = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  // Coming back from a Google redirect: any installed app, not just iOS. On
  // Android the redirect state used to be lost on return, so a failed sign-in
  // simply redrew the login screen with no explanation and no way forward.
  const [awaitingGoogleReturn, setAwaitingGoogleReturn] = useState(
    () => isStandalone() && consumeStaleGooglePending()
  )
  // Sign-in gave up inside the installed app — offer the browser as a way in
  // rather than leaving the user staring at the same screen.
  const [offerBrowserFallback, setOfferBrowserFallback] = useState(false)

  // Never wait forever. If the session has not arrived by now it is not coming,
  // and the user needs to be told rather than left watching a spinner.
  useEffect(() => {
    if (!awaitingGoogleReturn) return
    const t = setTimeout(() => {
      localStorage.removeItem(GOOGLE_PENDING_KEY)
      sessionStorage.removeItem(RELOAD_GUARD_KEY)
      setAwaitingGoogleReturn(false)
      setOfferBrowserFallback(isStandalone())
      setError('לא הצלחנו להשלים את הכניסה עם Google. נסו שוב, או היכנסו עם מייל וסיסמה.')
    }, GOOGLE_WAIT_GIVEUP_MS)
    return () => clearTimeout(t)
  }, [awaitingGoogleReturn])

  // Opened from the installed app ("המשך עם Google" hands off to the browser):
  // start the Google flow immediately instead of showing the same login screen
  // again and expecting the user to find the button a second time.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.get('google')) return
    // Keep ?next through the hand-off, otherwise a shared link that needed a
    // Google sign-in forgets where it was going.
    const keep = params.get('next')
    window.history.replaceState({}, '', keep ? `/login?next=${encodeURIComponent(keep)}` : '/login')
    handleGoogle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Called by the standalone anchor tag's onClick — sets state but lets the
  // default anchor navigation open Safari (window.open is blocked in WKWebView)
  const handleGoogleStandaloneClick = () => {
    localStorage.setItem(GOOGLE_PENDING_KEY, String(Date.now()))
    setAwaitingGoogleReturn(true)
  }

  const handleGoogle = async () => {
    setError('')
    clearAuthError?.()
    setGoogleLoading(true)
    try {
      // signInWithPopup never settles if the popup is swallowed by an in-app
      // browser, or if the device cannot reach Google. Without a deadline the
      // button just spins — which is exactly what "it loads forever" looks like.
      const res = await Promise.race([
        loginWithGoogle(),
        new Promise((_, reject) => setTimeout(
          () => reject(Object.assign(new Error('timeout'), { code: 'app/google-timeout' })),
          GOOGLE_CALL_TIMEOUT_MS)),
      ])
      // Only a redirect leaves this page; a popup resolves right here and the
      // effect on `user` does the navigating.
      if (res?.redirected) setAwaitingGoogleReturn(true)
    } catch (err) {
      localStorage.removeItem(GOOGLE_PENDING_KEY)
      sessionStorage.removeItem(RELOAD_GUARD_KEY)
      setAwaitingGoogleReturn(false)
      setOfferBrowserFallback(isStandalone())
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
    const nameError = hebrewNameError(name)
    if (nameError) { setError(nameError); return }
    setLoading('register')
    // Persist role selection so fetchUserProfile can pick it up after auth state change
    if (regRoles.size > 0) {
      const priority = ['host_family', 'new_family']
      const primary = priority.find(r => regRoles.has(r)) || 'community'
      const extras  = [...regRoles].filter(r => r !== primary)
      try { localStorage.setItem('shachaf_reg_role', JSON.stringify({ role: primary, roles: extras })) } catch {}
    }
    try {
      await registerWithEmail(email, password, normalizeName(name))
      // useEffect on user handles navigation
    } catch (err) {
      localStorage.removeItem('shachaf_reg_role')
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
            <img src="/logo.png" alt="שחף+" className="h-20 w-auto mx-auto" />
          </div>
          <p className="text-white/90 text-sm">הפלטפורמה הקהילתית שלנו</p>
        </div>

        <div className="bg-white rounded-3xl shadow-modal p-6 sm:p-8 dark:bg-gray-800" dir="rtl">
          {mode === 'demo' ? (
            <>
              <div className="flex items-center gap-2 mb-5">
                <button onClick={() => setMode('login')} className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-300">
                  <ArrowRight size={18} />
                </button>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">כניסת דמו</h2>
              </div>
              <div className="space-y-3">
                {DEMO_ROLES.map(role => {
                  const Icon = role.icon
                  return (
                    <button key={role.key} onClick={() => handleDemoLogin(role.key)}
                      disabled={loading !== null}
                      className={clsx(
                        'w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-[background-color,border-color,scale] duration-150 active:scale-[0.96] group',
                        role.subtle
                          ? 'border-dashed border-gray-200 hover:border-red-200 hover:bg-red-50/30'
                          : 'border-gray-100 hover:border-primary-200 hover:bg-primary-50/50'
                      )}>
                      <div className={`p-2.5 rounded-xl ${role.iconBg} group-hover:scale-105 transition-transform`}>
                        <Icon size={20} className={role.iconColor} />
                      </div>
                      <div className="text-right flex-1">
                        <div className={`font-semibold text-sm ${role.subtle ? 'text-gray-600 dark:text-gray-300' : 'text-gray-800 dark:text-gray-100'}`}>{role.label}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{role.sub}</div>
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
                <button onClick={() => { setMode('login'); setResetSent(false); setError('') }} className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-300">
                  <ArrowRight size={18} />
                </button>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">איפוס סיסמה</h2>
              </div>
              {resetSent ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">📬</div>
                  <p className="font-semibold text-gray-800 dark:text-gray-100">נשלח מייל לאיפוס</p>
                  <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">בדוק את תיבת הדואר שלך</p>
                  <button onClick={() => { setMode('login'); setResetSent(false) }} className="mt-4 text-sm text-primary-600 dark:text-primary-200 hover:underline">
                    חזרה לכניסה
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 text-right mb-1 dark:text-gray-200">כתובת מייל</label>
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
              <h2 className="text-xl font-bold text-gray-800 mb-1 text-center dark:text-gray-100">
                {mode === 'register' ? 'יצירת חשבון' : 'כניסה לחשבון'}
              </h2>
              <p className="text-sm text-gray-500 text-center mb-6 dark:text-gray-400">
                {mode === 'register' ? 'הצטרפו לשחף+' : 'ברוכים הבאים לשחף+'}
              </p>

              {authError && (
                <p className="text-sm text-red-600 dark:text-red-300 text-right mb-3 bg-red-50 dark:bg-red-900/30 rounded-xl px-3 py-2">
                  {authError}
                </p>
              )}

              {/* Google */}
              {awaitingGoogleReturn ? (
                <div className="w-full flex flex-col items-center gap-2 border border-primary-200 bg-primary-50 rounded-xl py-3 px-4 text-sm text-primary-700 mb-4 dark:text-primary-300 dark:bg-primary-900/30">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <span className="font-medium">ממתין לכניסה ב-Google...</span>
                  </div>
                  <p className="text-xs text-primary-500 text-center">
                    {AUTH_HANDLER_IS_FIRST_PARTY
                      ? 'משלימים את הכניסה מול Google — זה ייקח רגע'
                      : isStandalone()
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
              ) : (isIOS() && isStandalone() && !AUTH_HANDLER_IS_FIRST_PARTY) ? (
                // Last resort, and only while the sign-in handler is served by
                // firebaseapp.com: a standalone WKWebView cannot finish a
                // cross-site redirect, but a real <a target="_blank"> tap opens
                // Safari, which shares this origin's auth storage with the app.
                // Once /__/auth is proxied through our own host the redirect
                // completes inside the app and this detour disappears.
                <a
                  href={`${window.location.origin}/login?google=1${
                    new URLSearchParams(window.location.search).get('next')
                      ? `&next=${encodeURIComponent(new URLSearchParams(window.location.search).get('next'))}`
                      : ''}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={handleGoogleStandaloneClick}
                  className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 px-4 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 mb-4 no-underline dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700/50"
                >
                  <GoogleIcon />
                  המשך עם Google
                </a>
              ) : (
                <button type="button" onClick={handleGoogle} disabled={googleLoading || loading !== null}
                  className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 px-4 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 mb-4 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700/50 disabled:opacity-70">
                  {googleLoading
                    ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    : <GoogleIcon />
                  }
                  {googleLoading ? 'ממתין לחלון Google…' : 'המשך עם Google'}
                </button>
              )}
              {googleLoading ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-4">
                  השלימו את הכניסה בחלון של Google.{' '}
                  <button type="button" onClick={() => setGoogleLoading(false)}
                    className="underline hover:text-gray-700 dark:hover:text-gray-200">
                    לא נפתח חלון? חזרה לכניסה עם מייל
                  </button>
                </p>
              ) : null}

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-600 dark:text-gray-300">או</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>

              <form onSubmit={mode === 'register' ? handleRegister : handleLogin} className="space-y-4">
                {mode === 'register' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 text-right mb-1 dark:text-gray-200">שם מלא</label>
                      <input value={name} onChange={e => setName(e.target.value)} required
                        placeholder="שם מלא בעברית" className="input w-full text-right" />
                      <p className="text-xs text-gray-400 mt-1 text-right">בעברית — כך חברי הקהילה יזהו אתכם</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 text-right mb-2 dark:text-gray-200">
                        מה הקשר שלך לקהילה? <span className="text-gray-400 font-normal text-xs">(אופציונלי)</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[{ value: 'new_family', label: 'משפחה חדשה' }, { value: 'host_family', label: 'משפחה קולטת' }].map(r => {
                          const on = regRoles.has(r.value)
                          return (
                            <button key={r.value} type="button"
                              onClick={() => setRegRoles(prev => {
                                const next = new Set(prev)
                                on ? next.delete(r.value) : next.add(r.value)
                                return next
                              })}
                              className={clsx(
                                'px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                                on ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-400 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                              )}>
                              {r.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 text-right mb-1 dark:text-gray-200">כתובת מייל</label>
                  <div className="relative">
                    <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                      placeholder="כתובת מייל" className="input w-full pr-9 text-right" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 text-right mb-1 dark:text-gray-200">סיסמה</label>
                  <div className="relative">
                    <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                      placeholder="סיסמה" className="input w-full pr-9 pl-9 text-right" />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      aria-label={showPass ? 'הסתר סיסמה' : 'הצג סיסמה'}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-300"
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm text-red-500 text-right">{error}</p>}

                {/* Installed app, sign-in did not complete: the browser shares
                    this origin's auth storage, so finishing there gets the user
                    in. A dead end otherwise. */}
                {offerBrowserFallback && (
                  <a
                    href={`${window.location.origin}/login?google=1${
                    new URLSearchParams(window.location.search).get('next')
                      ? `&next=${encodeURIComponent(new URLSearchParams(window.location.search).get('next'))}`
                      : ''}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={handleGoogleStandaloneClick}
                    className="w-full flex items-center justify-center gap-2 border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/30 rounded-xl py-2.5 px-4 text-sm font-medium text-primary-700 dark:text-primary-300 no-underline"
                  >
                    <GoogleIcon />
                    המשך את הכניסה בדפדפן
                  </a>
                )}

                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('reset'); setError('') }}
                    className="w-full text-right py-1 text-sm text-primary-600 dark:text-primary-200 hover:underline"
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
                  className="text-sm text-primary-600 dark:text-primary-200 hover:underline">
                  {mode === 'login' ? 'אין לך חשבון? הירשם' : 'יש לך חשבון? היכנס'}
                </button>

                <div className="text-xs text-gray-300">—</div>

                {import.meta.env.DEV && (
                  <button onClick={() => { setMode('demo'); setError('') }}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-300">
                    כניסת דמו (בדיקות)
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <p className="text-center text-white/90 text-xs mt-4">
          בהצטרפות תתבקשו לאשר את{' '}
          <Link to="/legal/privacy" className="underline hover:text-white font-medium">מדיניות הפרטיות</Link>
          {' ואת '}
          <Link to="/legal/terms" className="underline hover:text-white font-medium">תנאי השימוש</Link>
        </p>
        <p className="text-center text-white/90 text-xs mt-2">
          <Link to="/legal/accessibility" className="underline hover:text-white font-medium">הצהרת נגישות</Link>
        </p>

        {/* The only report channel for someone who cannot get past this screen.
            Carries whatever error they just hit, so the report arrives with the
            actual failure instead of "it doesn't work". */}
        <div className="mt-4">
          <LoginHelpButton context="login" lastError={error || authError || ''} />
        </div>
        <p className="text-center text-white/90 text-xs mt-2">
          שחף+ © {new Date().getFullYear()}
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
    'auth/cancelled-popup-request': null,  // a second click — ignore
    'auth/popup-closed-by-user':  'חלון Google נסגר לפני סיום הכניסה — נסו שוב',
    'auth/user-cancelled':        null,
    'auth/account-exists-with-different-credential':
      'קיים כבר חשבון עם כתובת המייל הזו. היכנסו עם מייל וסיסמה.',
    'app/google-timeout':
      'הכניסה עם Google לא הסתיימה. בדקו שהדפדפן לא חוסם חלונות קופצים, ' +
      'או היכנסו עם מייל וסיסמה.',
    'auth/network-request-failed': 'בעיית רשת — בדוק את החיבור לאינטרנט',
  }
  if (code in map) return map[code]  // null = silent
  return `שגיאה (${code || 'unknown'})`
}
