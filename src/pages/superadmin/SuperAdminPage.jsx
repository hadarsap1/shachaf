import { useState, useEffect } from 'react'
import { MOCK_NEW_FAMILIES, MOCK_HOST_FAMILIES, MOCK_USERS } from '../../lib/mockData'
import { getAdminOverrides, setAdminOverride } from '../../lib/formsStorage'
import { Shield, ShieldOff, UserCog, Plus, Check, X } from 'lucide-react'
import clsx from 'clsx'

const BASE_ROLE_LABEL = {
  new_family:  'משפחה חדשה',
  host_family: 'משפחה מארחת',
  admin:       'מנהל',
  super_admin: 'מנהל ראשי',
}

const ROLE_COLOR = {
  admin:       'bg-accent-50 text-accent-700 border-accent-200',
  super_admin: 'bg-red-50 text-red-700 border-red-200',
  new_family:  'bg-primary-50 text-primary-700 border-primary-200',
  host_family: 'bg-secondary-50 text-secondary-700 border-secondary-200',
}

function buildUserList(overrides) {
  const all = [
    ...Object.values(MOCK_USERS),
    ...MOCK_NEW_FAMILIES.filter(f => !Object.values(MOCK_USERS).find(u => u.id === f.id)),
    ...MOCK_HOST_FAMILIES.filter(f => !Object.values(MOCK_USERS).find(u => u.id === f.id)),
  ]
  return all.map(u => ({
    ...u,
    effectiveRole: overrides[u.id] || u.role,
  }))
}

export default function SuperAdminPage() {
  const [overrides, setOverrides] = useState({})
  const [users, setUsers] = useState([])
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', open: false })
  const [saved, setSaved] = useState(null)

  useEffect(() => {
    const ov = getAdminOverrides()
    setOverrides(ov)
    setUsers(buildUserList(ov))
  }, [])

  const refreshUsers = (ov) => {
    setOverrides(ov)
    setUsers(buildUserList(ov))
  }

  const toggleAdmin = (user) => {
    const current = overrides[user.id] || user.role
    const next = (current === 'admin' || current === 'super_admin')
      ? user.role === 'admin' ? 'admin' : (user.role || 'new_family')
      : 'admin'
    setAdminOverride(user.id, next)
    const ov = getAdminOverrides()
    refreshUsers(ov)
    setSaved(user.id)
    setTimeout(() => setSaved(null), 2000)
  }

  const demoteAdmin = (user) => {
    const fallback = ['admin', 'super_admin'].includes(user.role) ? user.role : (user.role || 'new_family')
    setAdminOverride(user.id, fallback === 'admin' ? 'admin' : fallback)
    const ov = getAdminOverrides()
    refreshUsers(ov)
  }

  const admins = users.filter(u => u.effectiveRole === 'admin' || u.effectiveRole === 'super_admin')
  const others = users.filter(u => u.effectiveRole !== 'admin' && u.effectiveRole !== 'super_admin')

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2">
          <Shield size={22} />
          ניהול מנהלים
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">קביעת הרשאות מנהל ועריכת תפקידים</p>
      </div>

      {/* Current admins */}
      <section className="mb-6">
        <h2 className="font-bold text-gray-600 text-xs uppercase tracking-wide mb-3 px-1">
          מנהלים פעילים ({admins.length})
        </h2>
        <div className="space-y-2">
          {admins.map(u => (
            <div key={u.id} className="card p-4 flex items-center gap-3">
              <div className="avatar w-10 h-10 bg-accent-100 text-accent-700 flex-shrink-0">
                {u.avatar || u.name?.[0]}
              </div>
              <div className="flex-1 text-right min-w-0">
                <div className="flex items-center gap-2 justify-end flex-wrap">
                  <span className="font-semibold text-gray-800 text-sm">{u.name}</span>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-medium', ROLE_COLOR[u.effectiveRole])}>
                    {BASE_ROLE_LABEL[u.effectiveRole]}
                  </span>
                  {saved === u.id && <Check size={14} className="text-green-500" />}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{u.email}</p>
              </div>
              {u.effectiveRole !== 'super_admin' && (
                <button
                  onClick={() => demoteAdmin(u)}
                  className="flex items-center gap-1 text-xs text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
                >
                  <ShieldOff size={13} />
                  הסר
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Promote from existing users */}
      <section className="mb-6">
        <h2 className="font-bold text-gray-600 text-xs uppercase tracking-wide mb-3 px-1">
          הוסף מנהל מהמשתמשים הקיימים
        </h2>
        <div className="space-y-2">
          {others.slice(0, 10).map(u => (
            <div key={u.id} className="card p-3 flex items-center gap-3">
              <div className="avatar w-9 h-9 bg-gray-100 text-gray-600 text-sm flex-shrink-0">
                {u.avatar || u.name?.[0]}
              </div>
              <div className="flex-1 text-right min-w-0">
                <div className="font-medium text-gray-800 text-sm">{u.name}</div>
                <div className="text-xs text-gray-400">{BASE_ROLE_LABEL[u.effectiveRole]}</div>
              </div>
              <button
                onClick={() => toggleAdmin(u)}
                className="flex items-center gap-1 text-xs text-primary-600 bg-primary-50 hover:bg-primary-100 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
              >
                {saved === u.id ? <Check size={13} className="text-green-500" /> : <Shield size={13} />}
                {saved === u.id ? 'נשמר' : 'מנה כמנהל'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Add new admin by email */}
      <section>
        <h2 className="font-bold text-gray-600 text-xs uppercase tracking-wide mb-3 px-1">
          הזמן מנהל חדש
        </h2>
        {newAdmin.open ? (
          <div className="card p-4 space-y-3">
            <input
              value={newAdmin.name}
              onChange={e => setNewAdmin(n => ({ ...n, name: e.target.value }))}
              placeholder="שם מלא"
              className="input w-full text-right"
            />
            <input
              type="email"
              value={newAdmin.email}
              onChange={e => setNewAdmin(n => ({ ...n, email: e.target.value }))}
              placeholder="כתובת אימייל"
              className="input w-full"
              dir="ltr"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (newAdmin.name && newAdmin.email) {
                    setNewAdmin({ name: '', email: '', open: false })
                  }
                }}
                className="flex-1 btn-primary py-2 text-sm"
              >
                שלח הזמנה
              </button>
              <button
                onClick={() => setNewAdmin({ name: '', email: '', open: false })}
                className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center">ההזמנה תישלח במייל (זמין לאחר חיבור Supabase)</p>
          </div>
        ) : (
          <button
            onClick={() => setNewAdmin(n => ({ ...n, open: true }))}
            className="card p-4 w-full flex items-center justify-center gap-2 text-primary-600 hover:bg-primary-50 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            הזמן מנהל חדש במייל
          </button>
        )}
      </section>
    </div>
  )
}
