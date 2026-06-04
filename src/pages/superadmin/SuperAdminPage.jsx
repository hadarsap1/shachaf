import { useState, useEffect } from 'react'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { Shield, ShieldOff, ChevronDown, Check, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

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
  const [open, setOpen] = useState(false)
  const current = ROLES.find(r => r.value === user.role) || ROLES[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all',
          ROLE_COLOR[user.role] || ROLE_COLOR.new_family
        )}
      >
        {saving === user.uid
          ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          : <span>{current.label}</span>
        }
        <ChevronDown size={12} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-modal z-20 min-w-36 overflow-hidden">
            {ROLES.map(role => (
              <button key={role.value} onClick={() => { onSave(user, role.value); setOpen(false) }}
                className={clsx(
                  'w-full text-right px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between gap-2',
                  user.role === role.value && 'font-semibold text-primary-700'
                )}>
                {role.label}
                {user.role === role.value && <Check size={13} className="text-primary-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function SuperAdminPage() {
  const { user: me } = useAuth()
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]  = useState(null)
  const [saved, setSaved]    = useState(null)

  const loadUsers = async () => {
    setLoading(true)
    const snap = await getDocs(collection(db, 'users'))
    setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const changeRole = async (user, newRole) => {
    if (user.role === newRole) return
    setSaving(user.uid)
    await updateDoc(doc(db, 'users', user.uid), { role: newRole })
    setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, role: newRole } : u))
    setSaving(null)
    setSaved(user.uid)
    setTimeout(() => setSaved(null), 2000)
  }

  const admins  = users.filter(u => u.role === 'admin' || u.role === 'super_admin')
  const members = users.filter(u => u.role !== 'admin' && u.role !== 'super_admin')

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <button onClick={loadUsers} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500" title="רענן">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
        <div>
          <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 justify-end">
            <Shield size={22} />
            ניהול הרשאות
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 text-right">{users.length} משתמשים רשומים</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">טוען משתמשים...</p>
        </div>
      ) : (
        <>
          {/* Admins section */}
          {admins.length > 0 && (
            <section className="mb-6">
              <h2 className="font-bold text-gray-500 text-xs uppercase tracking-wide mb-3 px-1 text-right">
                מנהלים פעילים ({admins.length})
              </h2>
              <div className="space-y-2">
                {admins.map(u => (
                  <div key={u.uid} className="card p-4 flex items-center gap-3">
                    {u.avatar
                      ? <img src={u.avatar} alt="" className="w-10 h-10 rounded-full flex-shrink-0" />
                      : <div className="avatar w-10 h-10 bg-accent-100 text-accent-700 flex-shrink-0">{u.name?.[0]}</div>
                    }
                    <div className="flex-1 text-right min-w-0">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="font-semibold text-gray-800 text-sm">{u.name}</span>
                        {saved === u.uid && <Check size={13} className="text-green-500" />}
                        {u.uid === me?.uid && <span className="text-xs text-gray-400">(אני)</span>}
                      </div>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                    <RoleSelect user={u} onSave={changeRole} saving={saving} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* All members */}
          <section>
            <h2 className="font-bold text-gray-500 text-xs uppercase tracking-wide mb-3 px-1 text-right">
              כל המשתמשים ({members.length})
            </h2>
            <div className="space-y-2">
              {members.map(u => (
                <div key={u.uid} className="card p-3 flex items-center gap-3">
                  {u.avatar
                    ? <img src={u.avatar} alt="" className="w-9 h-9 rounded-full flex-shrink-0" />
                    : <div className="avatar w-9 h-9 bg-gray-100 text-gray-600 text-sm flex-shrink-0">{u.name?.[0]}</div>
                  }
                  <div className="flex-1 text-right min-w-0">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="font-medium text-gray-800 text-sm">{u.name}</span>
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
