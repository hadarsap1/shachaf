import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import {
  getUnlinkedChildren,
  linkChildToParent,
  getChildrenByParent,
  getClasses,
  registerCoParent,
} from '../../lib/db'
import { CheckCircle, Search, Loader2, Plus } from 'lucide-react'
import clsx from 'clsx'

const STEP_LABELS = ['פרטים', 'ילדים', 'בן/ת זוג', 'סיום']

export default function OnboardingPage() {
  const { user, markOnboardingComplete, updateUserState } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  // Step 0
  const [name, setName]   = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')

  // Step 1
  const [unlinked, setUnlinked]             = useState([])
  const [linked, setLinked]                 = useState([])
  const [classNames, setClassNames]         = useState({})
  const [search, setSearch]                 = useState('')
  const [loadingChildren, setLoadingChildren] = useState(false)
  const [linkingId, setLinkingId]           = useState(null)

  // Step 2
  const [coName, setCoName]   = useState('')
  const [coEmail, setCoEmail] = useState('')
  const [coPhone, setCoPhone] = useState('')
  const [coError, setCoError] = useState('')
  const [coDone, setCoDone]   = useState(!!user?.coParent)

  // ── Step 0 → 1 ────────────────────────────────────────────────────────────
  const goStep1 = async () => {
    setBusy(true)
    try {
      const trimmed = { name: name.trim(), phone: phone.trim() }
      await updateDoc(doc(db, 'users', user.uid), trimmed)
      updateUserState(trimmed)
      setStep(1)
      setLoadingChildren(true)
      const [ul, ll, cls] = await Promise.all([
        // Non-imported accounts aren't allowed to browse the unlinked-children
        // roster (privacy) — show an empty list instead of failing the step
        getUnlinkedChildren().catch(() => []),
        getChildrenByParent(user.uid),
        getClasses(),
      ])
      setUnlinked(ul)
      setLinked(ll)
      setClassNames(Object.fromEntries(cls.map(c => [c.id, c.name])))
    } finally {
      setBusy(false)
      setLoadingChildren(false)
    }
  }

  // ── Step 1 child linking ───────────────────────────────────────────────────
  const linkChild = async (child) => {
    setLinkingId(child.id)
    try {
      await linkChildToParent(child.id, user.uid)
      setUnlinked(prev => prev.filter(c => c.id !== child.id))
      setLinked(prev => [...prev, child])
    } finally {
      setLinkingId(null)
    }
  }

  // ── Step 2 co-parent ──────────────────────────────────────────────────────
  const inviteCoParent = async () => {
    setBusy(true)
    setCoError('')
    try {
      await registerCoParent(user, { name: coName.trim(), phone: coPhone.trim(), email: coEmail.trim() })
      setCoDone(true)
    } catch (err) {
      setCoError(err.message || 'שגיאה ביצירת חשבון')
    } finally {
      setBusy(false)
    }
  }

  // ── Step 3 finish ─────────────────────────────────────────────────────────
  const finish = async () => {
    setBusy(true)
    try {
      await markOnboardingComplete()
      navigate('/dashboard', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  const filtered = search
    ? unlinked.filter(c => c.name?.includes(search))
    : unlinked

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-8 dark:bg-gray-900" dir="rtl">
      <img src="/logo.png" alt="שחף" className="h-12 w-auto mb-6 opacity-80" />

      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-8">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                i < step  ? 'bg-green-500 text-white' :
                i === step ? 'bg-primary-600 text-white' :
                             'bg-gray-200 text-gray-400'
              )}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={clsx('text-xs', i === step ? 'text-primary-600 font-medium' : 'text-gray-400')}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={clsx('w-8 h-0.5 mb-4', i < step ? 'bg-green-500' : 'bg-gray-200')} />
            )}
          </div>
        ))}
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-card border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">

        {/* ── Step 0: Profile ────────────────────────────────────────────── */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1 dark:text-white">ברוכים הבאים!</h2>
            <p className="text-sm text-gray-500 mb-5 dark:text-gray-400">נתחיל בכמה פרטים בסיסיים</p>

            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">שם מלא</label>
            <input
              className="input-field mb-4"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="שם פרטי ומשפחה"
              dir="rtl"
            />

            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">טלפון</label>
            <input
              className="input-field mb-6"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="050-0000000"
              type="tel"
              dir="ltr"
            />

            <button
              onClick={goStep1}
              disabled={!name.trim() || busy}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              המשך
            </button>
          </div>
        )}

        {/* ── Step 1: Children ───────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1 dark:text-white">חיבור ילדים</h2>
            <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">חפשו את שם ילדכם ולחצו "זה הילד שלי"</p>

            {linked.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-green-700 mb-2 dark:text-green-300">ילדים מחוברים</p>
                <div className="space-y-2">
                  {linked.map(c => (
                    <div key={c.id} className="flex items-center gap-3 bg-green-50 rounded-xl px-3 py-2 dark:bg-green-900/20">
                      <CheckCircle size={16} className="text-green-600 flex-shrink-0 dark:text-green-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{c.name}</p>
                        {c.classId && classNames[c.classId] && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{classNames[c.classId]}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="relative mb-3">
              <Search size={14} className="absolute top-3 right-3 text-gray-400 pointer-events-none" />
              <input
                className="input-field pr-9"
                placeholder="חיפוש לפי שם..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                dir="rtl"
              />
            </div>

            {loadingChildren ? (
              <div className="flex justify-center py-6">
                <Loader2 size={24} className="animate-spin text-primary-400" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                {search ? 'לא נמצאו ילדים התואמים לחיפוש' : 'כל הילדים כבר מחוברים'}
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto mb-4">
                {filtered.map(c => (
                  <div key={c.id} className="flex items-center gap-3 border border-gray-100 rounded-xl px-3 py-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{c.name}</p>
                      {c.classId && classNames[c.classId] && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{classNames[c.classId]}</p>
                      )}
                    </div>
                    <button
                      onClick={() => linkChild(c)}
                      disabled={!!linkingId}
                      className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
                    >
                      {linkingId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                      זה הילד שלי
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setStep(2)} className="btn-primary w-full mb-2">
              המשך
            </button>
            <button onClick={() => setStep(2)} className="w-full text-sm text-gray-400 hover:text-gray-600 py-1">
              אחר כך
            </button>
          </div>
        )}

        {/* ── Step 2: Co-parent ──────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1 dark:text-white">הזמנת בן/ת זוג</h2>
            <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">הזמינו את בן/ת הזוג להצטרף לאפליקציה</p>

            {coDone ? (
              <div className="flex flex-col items-center py-6 gap-3">
                <CheckCircle size={40} className="text-green-500" />
                <p className="font-semibold text-green-700 dark:text-green-300">ההזמנה נשלחה בהצלחה</p>
                <button onClick={() => setStep(3)} className="btn-primary w-full mt-2">
                  המשך
                </button>
              </div>
            ) : (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">שם</label>
                <input
                  className="input-field mb-3"
                  value={coName}
                  onChange={e => setCoName(e.target.value)}
                  placeholder="שם בן/ת הזוג"
                  dir="rtl"
                />
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">אימייל</label>
                <input
                  className="input-field mb-3"
                  value={coEmail}
                  onChange={e => setCoEmail(e.target.value)}
                  placeholder="email@example.com"
                  type="email"
                  dir="ltr"
                />
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">טלפון (אופציונלי)</label>
                <input
                  className="input-field mb-4"
                  value={coPhone}
                  onChange={e => setCoPhone(e.target.value)}
                  placeholder="050-0000000"
                  type="tel"
                  dir="ltr"
                />
                {coError && <p className="text-sm text-red-600 mb-3 dark:text-red-400">{coError}</p>}
                <button
                  onClick={inviteCoParent}
                  disabled={!coName.trim() || !coEmail.trim() || busy}
                  className="btn-primary w-full mb-2 flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 size={16} className="animate-spin" />}
                  שלחו הזמנה
                </button>
                <button onClick={() => setStep(3)} className="w-full text-sm text-gray-400 hover:text-gray-600 py-1">
                  דלג
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Step 3: Done ───────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="text-center py-4">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 dark:text-white">הכל מוכן!</h2>
            <p className="text-sm text-gray-500 mb-6 dark:text-gray-400">
              ברוכים הבאים לקהילת שחף.<br />
              המשיכו ללוח הבית שלכם.
            </p>
            <button
              onClick={finish}
              disabled={busy}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              כניסה לאפליקציה
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
