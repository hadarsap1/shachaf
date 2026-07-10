import { useState, useEffect } from 'react'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { getClasses, logAudit } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import { Shield, Check, RefreshCw, Loader2, Eye, Home, Users, GraduationCap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'

const VIEW_AS_OPTIONS = [
  { role: 'new_family',  label: 'משפחה חדשה',  sub: 'לוח בית, כיתה, משימות',       icon: Home,           bg: 'bg-primary-50',   text: 'text-primary-700',   border: 'border-primary-200' },
  { role: 'host_family', label: 'משפחה מארחת', sub: 'ניהול משפחות מוקצות',          icon: Users,          bg: 'bg-secondary-50', text: 'text-secondary-700', border: 'border-secondary-200' },
  { role: 'community',   label: 'חבר קהילה',   sub: 'אירועים, ועדות, קבוצות',      icon: GraduationCap,  bg: 'bg-green-50',     text: 'text-green-700',     border: 'border-green-200' },
  { role: 'admin',       label: 'מנהל',         sub: 'פאנל ניהול, הודעות, דוחות',   icon: Shield,         bg: 'bg-accent-50',    text: 'text-accent-700',    border: 'border-accent-200' },
]

const ROLES = [
  { value: 'new_family',  label: 'משפחה חדשה' },
  { value: 'host_family', label: 'משפחה מארחת' },
  { value: 'admin',       label: 'מנהל' },
  { value: 'super_admin', label: 'מנהל ראשי' },
]

const ROLE_COLOR = {
  new_family:  'bg-primary-50 text-primary-700 border-primary-200',
  host_family: 'bg-secondary-50 text-secondary-700 border-secondary-200',
  admin:       'bg-accent-50 text-accent-700 border-accent-200',
  super_admin: 'bg-red-50 text-red-700 border-red-200',
}

function RoleSelect({ user, onSave, saving }) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {saving === user.uid && <Loader2 size={14} className="animate-spin text-gray-400" />}
      <select
        value={user.role}
        disabled={saving === user.uid}
        onChange={e => onSave(user, e.target.value)}
        className={clsx(
          'text-xs px-2.5 py-1.5 rounded-lg border font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50',
          ROLE_COLOR[user.role] || ROLE_COLOR.new_family
        )}
      >
        {ROLES.map(r => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
    </div>
  )
}

export default function SuperAdminPage() {
  const { user: me, viewAs, activateViewAs, deactivateViewAs } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers]     = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(null)
  const [saved, setSaved]     = useState(null)
  const [error, setError]     = useState('')

  const handleViewAs = (role) => {
    activateViewAs(role)
    navigate(role === 'admin' ? '/admin' : '/dashboard')
  }

  const loadUsers = async () => {
    setLoading(true)
    const [snap, cls] = await Promise.all([
      getDocs(collection(db, 'users')),
      getClasses(),
    ])
    setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
    setClasses(cls)
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const classNameMap = Object.fromEntries(classes.map(c => [c.id, c]))

  const changeRole = async (user, newRole) => {
    if (user.role === newRole) return
    setError('')
    setSaving(user.uid)
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: newRole })
      logAudit(me, 'role_change', { targetUid: user.uid, targetName: user.name || user.email, details: `${user.role} → ${newRole}` })
      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, role: newRole } : u))
      setSaved(user.uid)
      setTimeout(() => setSaved(null), 2000)
    } catch (err) {
      console.error('changeRole error:', err)
      setError(`שגיאה: ${err.code || err.message}`)
    } finally {
      setSaving(null)
    }
  }

  const admins  = users.filter(u => u.role === 'admin' || u.role === 'super_admin')
  const members = users.filter(u => u.role !== 'admin' && u.role !== 'super_admin')

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <button onClick={loadUsers} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700" title="רענן">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
        <div>
          <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 justify-end dark:text-primary-300">
            <span className="text-xl leading-none">🛡️</span>
            ניהול הרשאות
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 text-right dark:text-gray-400">{users.length} משתמשים רשומים</p>
        </div>
      </div>

      {/* View As */}
      <section className="mb-6">
        <h2 className="font-bold text-gray-500 text-xs uppercase tracking-wide mb-3 px-1 text-right flex items-center gap-1.5 justify-end dark:text-gray-400">
          <Eye size={13} />
          צפה באפליקציה בתור
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {VIEW_AS_OPTIONS.map(({ role, label, sub, icon: Icon, bg, text, border }) => {
            const active = viewAs === role
            return (
              <button
                key={role}
                onClick={() => active ? deactivateViewAs() : handleViewAs(role)}
                className={clsx(
                  'rounded-2xl border p-3 text-right transition-all flex items-start gap-3',
                  active ? `${bg} ${border} ring-2 ring-offset-1 ring-current ${text}` : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
                )}
              >
                <Icon size={18} className={clsx('flex-shrink-0 mt-0.5', active ? text : 'text-gray-400')} />
                <div>
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
              </button>
            )
          })}
        </div>
        {viewAs && (
          <button onClick={deactivateViewAs}
            className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 w-full hover:bg-amber-100 transition-colors">
            ← חזרה למצב מנהל ראשי
          </button>
        )}
      </section>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-right dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">טוען משתמשים...</p>
        </div>
      ) : (
        <>
          {/* Authorized-access compliance counter — the data-security
              regulations tier we target assumes ≤10 access holders
              (docs/security-compliance-plan-2026-07.md §5.4) */}
          {(() => {
            const privileged = users.filter(u =>
              u.role === 'admin' || u.role === 'super_admin' || (u.classAdminFor || []).length > 0)
            const over = privileged.length > 10
            return (
              <section className="mb-6">
                <div className={clsx(
                  'rounded-2xl border px-4 py-3 text-right',
                  over
                    ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                    : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                )}>
                  <p className={clsx('text-sm font-semibold', over ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-200')}>
                    מורשי גישה במערכת: {privileged.length} / 10
                  </p>
                  <p className={clsx('text-xs mt-0.5', over ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400')}>
                    {over
                      ? 'חריגה מתקרת 10 מורשי הגישה שהוגדרה בתוכנית אבטחת המידע — חובות מוגברות לפי תקנות אבטחת מידע. יש לצמצם הרשאות.'
                      : 'כל בעלי תפקיד ניהולי או ניהול-כיתה. יש לסקור ולתעד את הרשימה אחת לשנה (תוכנית אבטחת המידע, סעיף 5.4).'}
                  </p>
                </div>
              </section>
            )
          })()}

          {/* Admins section */}
          {admins.length > 0 && (
            <section className="mb-6">
              <h2 className="font-bold text-gray-500 text-xs uppercase tracking-wide mb-3 px-1 text-right dark:text-gray-400">
                מנהלים פעילים ({admins.length})
              </h2>
              <div className="space-y-2">
                {admins.map(u => (
                  <div key={u.uid} className="card p-4 flex items-center gap-3">
                    {u.avatar
                      ? <img src={u.avatar} alt="" className="w-10 h-10 rounded-full flex-shrink-0" />
                      : <div className="avatar w-10 h-10 bg-accent-100 text-accent-700 flex-shrink-0 dark:bg-accent-900/40">{u.name?.[0]}</div>
                    }
                    <div className="flex-1 text-right min-w-0">
                      <div className="flex items-center gap-2 justify-end flex-wrap">
                        <span className="font-semibold text-gray-800 text-sm dark:text-gray-100">{u.name}</span>
                        {saved === u.uid && <Check size={13} className="text-green-500" />}
                        {u.uid === me?.uid && <span className="text-xs text-gray-400">(אני)</span>}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                      {u.classAdminFor?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 justify-end">
                          {u.classAdminFor.map(cid => {
                            const cls = classNameMap[cid]
                            return cls ? (
                              <span key={cid}
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{
                                  backgroundColor: (cls.color || '#1B3B70') + '22',
                                  color: cls.color || '#1B3B70',
                                }}>
                                {cls.name}
                              </span>
                            ) : null
                          })}
                        </div>
                      )}
                    </div>
                    <RoleSelect user={u} onSave={changeRole} saving={saving} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* All members */}
          <section>
            <h2 className="font-bold text-gray-500 text-xs uppercase tracking-wide mb-3 px-1 text-right dark:text-gray-400">
              כל המשתמשים ({members.length})
            </h2>
            <div className="space-y-2">
              {members.map(u => (
                <div key={u.uid} className="card p-3 flex items-center gap-3">
                  {u.avatar
                    ? <img src={u.avatar} alt="" className="w-9 h-9 rounded-full flex-shrink-0" />
                    : <div className="avatar w-9 h-9 bg-gray-100 text-gray-600 text-sm flex-shrink-0 dark:bg-gray-800 dark:text-gray-300">{u.name?.[0]}</div>
                  }
                  <div className="flex-1 text-right min-w-0">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="font-medium text-gray-800 text-sm dark:text-gray-100">{u.name}</span>
                      {u.uid === me?.uid && <span className="text-xs text-gray-400">(אני)</span>}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <RoleSelect user={u} onSave={changeRole} saving={saving} />
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-6">כל המשתמשים הם מנהלים</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
