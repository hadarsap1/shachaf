import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUsers, updateUserProfile } from '../../lib/db'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import {
  Users, UserPlus, MessageCircle, Search, X, Check,
  Link2, Loader2, RefreshCw, Upload, MapPin, Phone,
} from 'lucide-react'
import clsx from 'clsx'

const INVITE_URL = typeof window !== 'undefined' ? `${window.location.origin}/login` : ''

const DEFAULT_MESSAGES = {
  new_family: `היי, קהילת שחף 👋
בית הספר שחף מזמין אתכם להצטרף לפלטפורמת הקליטה שלנו.
כאן תמצאו את כל המשימות, האירועים והמידע שתצטרכו לקראת תחילת הלימודים.

להרשמה:
${INVITE_URL}`,
  host_family: `היי, קהילת שחף 👋
בית הספר שחף מזמין אותך להצטרף לפלטפורמת הקליטה כמשפחה מארחת.
דרכה תוכלו לעקוב אחר המשפחות שבאחריותכם ולהישאר מעודכנים.

להרשמה:
${INVITE_URL}`,
  community: `היי, קהילת שחף 👋
בית הספר שחף מזמין אתכם להצטרף לפלטפורמת הקהילה שלנו.
כאן תמצאו אירועים, מידע שימושי ועדכונים מהקהילה.

להרשמה:
${INVITE_URL}`,
}

const ROLES = [
  { value: 'new_family',  label: 'משפחה חדשה' },
  { value: 'host_family', label: 'משפחה מארחת' },
  { value: 'community',   label: 'קהילה' },
  { value: 'admin',       label: 'מנהל' },
  { value: 'super_admin', label: 'מנהל ראשי' },
]

// Additional roles that can be stacked on top of the primary role
const EXTRA_ROLES = [
  { value: 'new_family',  label: 'משפחה חדשה' },
  { value: 'host_family', label: 'משפחה מארחת' },
]

const ROLE_STYLE = {
  new_family:  'bg-primary-50 text-primary-700 border-primary-200',
  host_family: 'bg-secondary-50 text-secondary-700 border-secondary-200',
  community:   'bg-amber-50 text-amber-700 border-amber-200',
  admin:       'bg-gray-100 text-gray-600 border-gray-200',
  super_admin: 'bg-red-50 text-red-700 border-red-200',
}

// ── Invite panel ────────────────────────────────────────────────────────────

function InvitePanel({ onClose }) {
  const [tab, setTab]           = useState('new_family')
  const [messages, setMessages] = useState({ ...DEFAULT_MESSAGES })
  const [copied, setCopied]     = useState(false)
  const [msgCopied, setMsgCopied] = useState(false)

  const setMsg = (v) => setMessages(m => ({ ...m, [tab]: v }))
  const reset  = () => setMessages(m => ({ ...m, [tab]: DEFAULT_MESSAGES[tab] }))

  const copyText = async (text, setter) => {
    try { await navigator.clipboard.writeText(text) } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    setter(true); setTimeout(() => setter(false), 2500)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Link2 size={16} className="text-primary-600" />
            הזמנת משפחות
          </h2>
        </div>

        <div className="flex border-b border-gray-100">
          {[{ key: 'new_family', label: 'משפחה חדשה' }, { key: 'host_family', label: 'משפחה מארחת' }, { key: 'community', label: 'קהילה' }].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setCopied(false); setMsgCopied(false) }}
              className={clsx('flex-1 py-3 text-sm font-medium transition-all border-b-2',
                tab === t.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700')}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <button onClick={reset} className="text-xs text-gray-400 hover:text-primary-600">איפוס לברירת מחדל</button>
              <label className="text-xs font-medium text-gray-600">הודעת הזמנה</label>
            </div>
            <textarea value={messages[tab]} onChange={e => setMsg(e.target.value)}
              rows={9} className="input w-full text-right text-sm resize-none leading-relaxed" />
          </div>
          <button onClick={() => copyText(messages[tab], setMsgCopied)}
            className={clsx('w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all',
              msgCopied ? 'bg-green-500 text-white' : 'bg-primary-600 text-white hover:bg-primary-700')}>
            {msgCopied ? <Check size={16} /> : <Link2 size={16} />}
            {msgCopied ? '✓ ההודעה הועתקה!' : 'העתק הודעה'}
          </button>
          <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(messages[tab])}`, '_blank')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-green-500 hover:bg-green-600 text-white transition-colors">
            <MessageCircle size={16} />
            שלח בWhatsApp
          </button>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 text-right mb-2">רק הקישור:</p>
            <div className="flex gap-2 items-center">
              <button onClick={() => copyText(INVITE_URL, setCopied)}
                className={clsx('flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all',
                  copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                {copied ? '✓ הועתק' : 'העתק'}
              </button>
              <span className="text-xs text-primary-600 font-mono truncate flex-1 text-left" dir="ltr">{INVITE_URL}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── User detail panel ────────────────────────────────────────────────────────

function UserDetailPanel({ user, onClose, onRoleChange, onRolesChange, saving, onProfileSaved }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: user.name || '', phone: user.phone || '', address: user.address || '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  const isUrl = (s) => typeof s === 'string' && s.startsWith('http')
  const rawDigits = (user.phone || '').replace(/\D/g, '')
  const waPhone = rawDigits.length > 3 ? (rawDigits.startsWith('972') ? rawDigits : '972' + rawDigits.replace(/^0/, '')) : null

  const handleSaveProfile = async () => {
    setProfileSaving(true)
    try {
      await updateUserProfile(user.uid, { name: draft.name.trim(), phone: draft.phone.trim(), address: draft.address.trim() })
      setProfileSaved(true)
      setEditing(false)
      onProfileSaved({ ...user, ...draft })
      setTimeout(() => setProfileSaved(false), 2500)
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col animate-slide-from-right" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
          <h2 className="font-bold text-gray-800">פרטי משתמש</h2>
          <button
            onClick={() => { setEditing(e => !e); setDraft({ name: user.name || '', phone: user.phone || '', address: user.address || '' }) }}
            className={clsx('text-xs px-2.5 py-1 rounded-lg border transition-colors font-medium', editing ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-primary-50 text-primary-600 border-primary-200 hover:bg-primary-100')}
          >
            {editing ? 'ביטול' : 'עריכה'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-3">
            {isUrl(user.avatar)
              ? <img src={user.avatar} alt="" className="w-16 h-16 rounded-full object-cover" />
              : <div className="avatar w-16 h-16 text-2xl bg-primary-100 text-primary-700">{(draft.name || user.name)?.[0] || '?'}</div>
            }
            <div className="text-center">
              <div className="font-bold text-gray-800 text-base">{editing ? draft.name || '—' : user.name}</div>
              <div className="text-sm text-gray-500">{user.email}</div>
            </div>
          </div>

          {/* Edit form */}
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1 text-right">שם מלא</label>
                <input
                  value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  className="input w-full text-right text-sm"
                  placeholder="שם מלא"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1 text-right flex items-center gap-1.5 justify-end">
                  <Phone size={12} />טלפון
                </label>
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))}
                  className="input w-full text-right text-sm"
                  placeholder="050-0000000"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1 text-right flex items-center gap-1.5 justify-end">
                  <MapPin size={12} />כתובת
                </label>
                <input
                  value={draft.address}
                  onChange={e => setDraft(d => ({ ...d, address: e.target.value }))}
                  className="input w-full text-right text-sm"
                  placeholder="רחוב, עיר"
                />
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="w-full py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
              >
                {profileSaving ? <Loader2 size={14} className="animate-spin" /> : profileSaved ? <Check size={14} /> : null}
                {profileSaving ? 'שומר...' : profileSaved ? 'נשמר!' : 'שמור שינויים'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {user.phone ? (
                <div className="flex items-center gap-2 justify-end text-sm text-gray-600">
                  <span dir="ltr">{user.phone}</span>
                  <Phone size={14} className="text-gray-400 flex-shrink-0" />
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-end text-sm text-gray-400">
                  <span>אין מספר טלפון</span>
                  <Phone size={14} className="flex-shrink-0" />
                </div>
              )}
              {user.address ? (
                <div className="flex items-center gap-2 justify-end text-sm text-gray-600">
                  <span>{user.address}</span>
                  <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-end text-sm text-gray-400">
                  <span>אין כתובת</span>
                  <MapPin size={14} className="flex-shrink-0" />
                </div>
              )}
            </div>
          )}

          {/* Role */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5 text-right">הרשאה ראשית</label>
            <select
              value={user.role || 'new_family'}
              disabled={saving === user.uid}
              onChange={e => onRoleChange(user, e.target.value)}
              className={clsx(
                'text-sm px-3 py-2 rounded-xl border font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400 w-full disabled:opacity-50',
                ROLE_STYLE[user.role] || ROLE_STYLE.new_family
              )}
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Extra roles */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5 text-right">תפקידים נוספים</label>
            <div className="flex flex-wrap gap-2">
              {EXTRA_ROLES.map(r => {
                const extraRoles = user.roles || []
                const checked = extraRoles.includes(r.value) || user.role === r.value
                const isPrimary = user.role === r.value
                return (
                  <label key={r.value} className={clsx(
                    'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border cursor-pointer select-none transition-colors',
                    isPrimary
                      ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400'
                      : checked
                        ? 'bg-primary-50 border-primary-300 text-primary-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'
                  )}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      disabled={saving === user.uid || isPrimary}
                      checked={checked}
                      onChange={() => {
                        const current = user.roles || []
                        const next = checked
                          ? current.filter(v => v !== r.value)
                          : [...current, r.value]
                        onRolesChange(user, next)
                      }}
                    />
                    {r.label}
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        {/* WhatsApp — only when there's an actual phone number */}
        {waPhone && (
          <div className="px-5 py-4 border-t border-gray-100">
            <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors border border-green-200">
              <MessageCircle size={15} />
              שלח הודעה ב-WhatsApp
            </a>
          </div>
        )}
      </div>
    </>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const navigate = useNavigate()
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showInvite, setShowInvite] = useState(false)
  const [saving, setSaving]     = useState(null)
  const [error, setError]       = useState('')
  const [selectedUser, setSelectedUser] = useState(null)

  const loadUsers = async () => {
    setLoading(true)
    const data = await getUsers()
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const changeRole = async (user, newRole) => {
    if (user.role === newRole) return
    setError('')
    setSaving(user.uid)
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: newRole })
      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, role: newRole } : u))
      setSelectedUser(prev => prev?.uid === user.uid ? { ...prev, role: newRole } : prev)
    } catch (err) {
      console.error('changeRole error:', err)
      setError(`שגיאה בשינוי הרשאה: ${err.code || err.message}`)
      setSelectedUser(prev => prev?.uid === user.uid ? { ...prev, role: user.role } : prev)
    } finally {
      setSaving(null)
    }
  }

  const changeRoles = async (user, newRoles) => {
    setError('')
    setSaving(user.uid)
    try {
      await updateDoc(doc(db, 'users', user.uid), { roles: newRoles })
      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, roles: newRoles } : u))
      setSelectedUser(prev => prev?.uid === user.uid ? { ...prev, roles: newRoles } : prev)
    } catch (err) {
      console.error('changeRoles error:', err)
      setError(`שגיאה בעדכון תפקידים: ${err.code || err.message}`)
    } finally {
      setSaving(null)
    }
  }

  const filtered = users.filter(u => {
    const matchRole   = roleFilter === 'all' || u.role === roleFilter
    const q = search.toLowerCase()
    const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    return matchRole && matchSearch
  })

  const isUrl = (s) => typeof s === 'string' && s.startsWith('http')

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowInvite(true)} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
            <UserPlus size={16} />
            הזמן משפחה
          </button>
          <button onClick={() => navigate('/admin/import')}
            className="flex items-center gap-1.5 text-sm py-2 px-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            <Upload size={15} />
            ייבוא
          </button>
          <button onClick={loadUsers} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500" title="רענן">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div>
          <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 justify-end">
            <Users size={22} />
            ניהול משתמשים
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 text-right">{users.length} משתמשים רשומים</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-right">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש..." className="input w-full pr-9 text-right py-2 text-sm" />
        </div>
        {['all', 'new_family', 'host_family', 'community', 'admin'].map(r => (
          <button key={r} onClick={() => setRoleFilter(r)}
            className={clsx('px-3 py-1.5 rounded-full text-sm font-medium transition-all flex-shrink-0',
              roleFilter === r ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300')}>
            {r === 'all' ? 'הכל' : ROLES.find(x => x.value === r)?.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-primary-400" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(user => {
            const phone = (() => { const d = (user.phone || '').replace(/\D/g, ''); return d.startsWith('972') ? d : '972' + d.replace(/^0/, '') })()
            return (
              <div key={user.uid}
                className="card p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setSelectedUser(user)}>
                {isUrl(user.avatar)
                  ? <img src={user.avatar} alt="" className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />
                  : <div className="avatar w-10 h-10 text-sm bg-primary-100 text-primary-700 flex-shrink-0">
                      {user.name?.[0] || '?'}
                    </div>
                }
                <div className="flex-1 min-w-0 text-right">
                  <div className="font-semibold text-gray-800 text-sm">{user.name}</div>
                  <div className="text-xs text-gray-400 truncate">{user.email}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {saving === user.uid && <Loader2 size={14} className="animate-spin text-gray-400" />}
                  <select
                    value={user.role || 'new_family'}
                    disabled={saving === user.uid}
                    onChange={e => changeRole(user, e.target.value)}
                    className={clsx(
                      'text-xs px-2.5 py-1.5 rounded-lg border font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50',
                      ROLE_STYLE[user.role] || ROLE_STYLE.new_family
                    )}
                  >
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                {phone && (
                  <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="p-2 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors flex-shrink-0">
                    <MessageCircle size={15} />
                  </a>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">לא נמצאו משתמשים</p>
            </div>
          )}
        </div>
      )}

      {showInvite && <InvitePanel onClose={() => setShowInvite(false)} />}
      {selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          saving={saving}
          onRoleChange={(user, role) => changeRole(user, role)}
          onRolesChange={(user, roles) => changeRoles(user, roles)}
          onClose={() => setSelectedUser(null)}
          onProfileSaved={(updated) => {
            setUsers(prev => prev.map(u => u.uid === updated.uid ? { ...u, ...updated } : u))
            setSelectedUser(prev => ({ ...prev, ...updated }))
          }}
        />
      )}
    </div>
  )
}
