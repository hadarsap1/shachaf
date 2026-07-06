import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUsers, updateUserProfile, createMember, getClasses, deleteUserCompletely, removeClassAdmin, getChildrenByParent, getUsersByUids } from '../../lib/db'
import { toast } from '../../components/ui/Toaster'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import {
  Users, UserPlus, MessageCircle, Search, X, Check,
  Link2, Loader2, RefreshCw, Upload, MapPin, Phone, Trash2, Baby,
} from 'lucide-react'
import clsx from 'clsx'

const INVITE_URL = typeof window !== 'undefined' ? `${window.location.origin}/login` : ''

const DEFAULT_MESSAGES = {
  new_family: `היי, קהילת שחף 👋
קהילת שחף מזמינה אתכם להצטרף לפלטפורמה הקהילתית שלנו.
כאן תמצאו את כל המשימות, האירועים והמידע שתצטרכו לקראת תחילת הלימודים.

להרשמה:
${INVITE_URL}`,
  host_family: `היי, קהילת שחף 👋
קהילת שחף מזמינה אתכם להצטרף לפלטפורמה הקהילתית כמשפחה מארחת.
דרכה תוכלו לעקוב אחר המשפחות שבאחריותכם ולהישאר מעודכנים.

להרשמה:
${INVITE_URL}`,
  community: `היי, קהילת שחף 👋
קהילת שחף מזמינה אתכם להצטרף לפלטפורמה הקהילתית שלנו.
כאן תמצאו אירועים, מידע שימושי ועדכונים מהקהילה.

להרשמה:
${INVITE_URL}`,
}

const ROLES = [
  { value: 'community',   label: 'חבר קהילה' },
  { value: 'new_family',  label: 'משפחה חדשה' },
  { value: 'host_family', label: 'משפחה מארחת' },
  { value: 'admin',       label: 'מנהל' },
  { value: 'super_admin', label: 'מנהל ראשי' },
]

// Additional roles that can be stacked on top of the primary role
const EXTRA_ROLES = [
  { value: 'new_family',  label: 'משפחה חדשה' },
  { value: 'host_family', label: 'משפחה מארחת' },
]

const ROLE_STYLE = {
  community:   'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600',
  new_family:  'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800',
  host_family: 'bg-secondary-50 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-300 border-secondary-200 dark:border-secondary-800',
  admin:       'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600',
  super_admin: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
}

const STATUSES = [
  { value: 'active',   label: 'פעיל' },
  { value: 'inactive', label: 'לא פעיל' },
  { value: 'frozen',   label: 'בהקפאה' },
  { value: 'pending',  label: 'ממתין לאישור' },
  { value: 'alumni',   label: 'בוגרים' },
]

const STATUS_STYLE = {
  active:   'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  inactive: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600',
  frozen:   'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  pending:  'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  alumni:   'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
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
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right dark:bg-gray-800" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 flex items-center gap-2 dark:text-gray-100">
            <Link2 size={16} className="text-primary-600" />
            הזמנת משפחות
          </h2>
        </div>

        <div className="flex border-b border-gray-100 dark:border-gray-700">
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
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">הודעת הזמנה</label>
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
          <div className="border-t border-gray-100 pt-4 dark:border-gray-700">
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

// ── Add member panel ──────────────────────────────────────────────────────────

// Derive primary role + extra roles[] from a flat Set of selected role values.
// Priority: super_admin > admin > host_family > new_family > community
const ROLE_PRIORITY = ['super_admin', 'admin', 'host_family', 'new_family', 'community']
function deriveRoles(selected) {
  const primary = ROLE_PRIORITY.find(r => selected.has(r)) || 'community'
  const extras  = [...selected].filter(r => r !== primary && r !== 'community')
  return { role: primary, roles: extras }
}

// Checkboxes shown in the add/edit forms (community is the implicit default, not shown)
const ROLE_CHIPS = [
  { value: 'new_family',  label: 'משפחה חדשה' },
  { value: 'host_family', label: 'משפחה מארחת' },
  { value: 'admin',       label: 'מנהל' },
  { value: 'super_admin', label: 'מנהל ראשי' },
]

function RoleChips({ selected, onChange, disabled }) {
  const toggle = (v) => {
    const next = new Set(selected)
    next.has(v) ? next.delete(v) : next.add(v)
    onChange(next)
  }
  return (
    <div className="flex flex-wrap gap-2">
      {ROLE_CHIPS.map(r => {
        const on = selected.has(r.value)
        return (
          <button key={r.value} type="button" disabled={disabled}
            onClick={() => toggle(r.value)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-all select-none',
              on
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-primary-400 hover:text-primary-600',
              disabled && 'opacity-50 cursor-not-allowed'
            )}>
            {r.label}
          </button>
        )
      })}
    </div>
  )
}

function AddMemberPanel({ onClose, onCreated }) {
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedRoles, setSelectedRoles] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [done, setDone]     = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setSaving(true)
    setError('')
    const { role, roles } = deriveRoles(selectedRoles)
    try {
      const newUser = await createMember({ name: name.trim(), email: email.trim(), phone: phone.trim(), role, roles })
      setDone(true)
      onCreated(newUser)
    } catch (err) {
      setError(err.code === 'auth/email-already-in-use' ? 'כתובת המייל כבר רשומה במערכת' : `שגיאה: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right dark:bg-gray-800" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 flex items-center gap-2 dark:text-gray-100">
            <UserPlus size={16} className="text-primary-600" />
            הוספת חבר ידנית
          </h2>
        </div>

        {done ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center dark:bg-green-900/30">
              <Check size={26} className="text-green-600 dark:text-green-400" />
            </div>
            <p className="font-bold text-gray-800 dark:text-gray-100">המשתמש נוצר בהצלחה!</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">נשלח מייל לאיפוס סיסמה לכתובת {email}</p>
            <button onClick={onClose} className="btn-primary mt-4">סגור</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1 text-right dark:text-gray-300">שם מלא *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="ישראל ישראלי" required className="input w-full text-right" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1 text-right dark:text-gray-300">אימייל *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com" required dir="ltr" className="input w-full text-left" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1 text-right dark:text-gray-300">טלפון</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="050-0000000" dir="ltr" className="input w-full text-right" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2 text-right dark:text-gray-300">
                תפקידים <span className="text-gray-400 font-normal">(אופציונלי, ניתן לבחור כמה)</span>
              </label>
              <RoleChips selected={selectedRoles} onChange={setSelectedRoles} disabled={saving} />
            </div>

            {error && <p className="text-sm text-red-600 text-right bg-red-50 px-3 py-2 rounded-xl dark:bg-red-900/20 dark:text-red-400">{error}</p>}

            <p className="text-xs text-gray-400 text-right">לאחר היצירה יישלח מייל לאיפוס סיסמה לכתובת שהוזנה.</p>

            <button type="submit" disabled={saving || !name.trim() || !email.trim()}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {saving ? 'יוצר...' : 'צור חשבון ושלח מייל'}
            </button>
          </form>
        )}
      </div>
    </>
  )
}

// ── User detail panel ────────────────────────────────────────────────────────

function UserDetailPanel({ user, onClose, onRoleChange, onRolesChange, onStatusChange, saving, onProfileSaved, onDelete, canEditRoles = true }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: user.name || '', phone: user.phone || '', address: user.address || '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [kids, setKids] = useState(null)
  const [classes, setClasses] = useState([])
  const [coParents, setCoParents] = useState([])

  useEscapeToClose(onClose, !profileSaving)

  useEffect(() => {
    Promise.all([getChildrenByParent(user.uid), getClasses()])
      .then(async ([ch, cl]) => {
        setKids(ch); setClasses(cl)
        // Co-parents from the imported phone-book data on each child (always
        // includes the second parent, even if they never registered), plus any
        // registered users linked to the same children. Deduped by email.
        const myEmail = (user.email || '').toLowerCase()
        const linkedUids = [...new Set(ch.flatMap(k => k.parentUids || []).filter(u => u !== user.uid))]
        const linkedUsers = linkedUids.length ? await getUsersByUids(linkedUids) : []
        const byEmail = new Map()
        for (const u of linkedUsers) byEmail.set((u.email || '').toLowerCase(), { name: u.name, phone: u.phone, email: u.email, registered: true })
        for (const k of ch) {
          for (const p of k.parents || []) {
            const e = (p.email || '').toLowerCase()
            if (!e || e === myEmail || byEmail.has(e)) continue
            byEmail.set(e, { name: p.name, phone: p.phone, email: p.email, registered: false })
          }
        }
        setCoParents([...byEmail.values()])
      })
      .catch(() => setKids([]))
  }, [user.uid])

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
      <div role="dialog" aria-modal="true" aria-label="פרטי משתמש" className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col animate-slide-from-right dark:bg-gray-800" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100">פרטי משתמש</h2>
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
              : <div className="avatar w-16 h-16 text-2xl bg-primary-100 text-primary-700 dark:text-primary-300 dark:bg-primary-900/40">{(draft.name || user.name)?.[0] || '?'}</div>
            }
            <div className="text-center">
              <div className="font-bold text-gray-800 text-base dark:text-gray-100">{editing ? draft.name || '—' : user.name}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
            </div>
          </div>

          {/* Edit form */}
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1 text-right dark:text-gray-400">שם מלא</label>
                <input
                  value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  className="input w-full text-right text-sm"
                  placeholder="שם מלא"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1 text-right flex items-center gap-1.5 justify-end dark:text-gray-400">
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
                <label className="text-xs font-medium text-gray-500 block mb-1 text-right flex items-center gap-1.5 justify-end dark:text-gray-400">
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
                <div className="flex items-center gap-2 justify-end text-sm text-gray-600 dark:text-gray-300">
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
                <div className="flex items-center gap-2 justify-end text-sm text-gray-600 dark:text-gray-300">
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

          {/* Roles — unified multi-select chips (global admins only) */}
          {canEditRoles && (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2 text-right dark:text-gray-400">
                תפקידים <span className="text-gray-400 font-normal">(ניתן לבחור כמה)</span>
              </label>
              <RoleChips
                disabled={saving === user.uid}
                selected={new Set([
                  ...(user.role && user.role !== 'community' ? [user.role] : []),
                  ...(user.roles || []),
                ])}
                onChange={(next) => {
                  const { role, roles } = deriveRoles(next)
                  if (role !== user.role) onRoleChange(user, role)
                  onRolesChange(user, roles)
                }}
              />
            </div>
          )}

          {/* Status */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2 text-right dark:text-gray-400">סטטוס חברות</label>
            <select
              value={user.status || 'active'}
              disabled={saving === user.uid}
              onChange={e => onStatusChange(user, e.target.value)}
              className={clsx(
                'w-full text-sm px-3 py-2 rounded-xl border font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50',
                STATUS_STYLE[user.status] || STATUS_STYLE.active
              )}
            >
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Linked children */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2 text-right dark:text-gray-400">ילדים</label>
            {kids === null ? (
              <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-gray-300" /></div>
            ) : kids.length === 0 ? (
              <p className="text-sm text-gray-400 text-right">אין ילדים מקושרים</p>
            ) : (
              <div className="space-y-1.5">
                {kids.map(k => {
                  const cls = classes.find(c => c.id === k.classId)
                  return (
                    <div key={k.id} className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3 py-2 dark:bg-gray-900">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ backgroundColor: cls?.color || '#9CA3AF' }}>
                        {cls?.name || <Baby size={12} />}
                      </div>
                      <span className="flex-1 text-sm font-medium text-gray-700 text-right dark:text-gray-200">{k.name}</span>
                      {cls && <span className="text-xs text-gray-400">כיתה {cls.name}</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Co-parents — other parents linked to the same children */}
          {coParents.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2 text-right dark:text-gray-400">הורה נוסף</label>
              <div className="space-y-1.5">
                {coParents.map((p, i) => (
                  <div key={p.email || i} className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3 py-2 dark:bg-gray-900">
                    <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-[11px] font-bold text-primary-700 flex-shrink-0 dark:bg-primary-900/40 dark:text-primary-300">
                      {p.name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="text-sm font-medium text-gray-700 truncate dark:text-gray-200">{p.name || p.email}</div>
                      {p.phone && <div className="text-xs text-gray-400" dir="ltr">{p.phone}</div>}
                    </div>
                    {p.registered
                      ? <span className="text-[10px] text-secondary-600 flex items-center gap-0.5"><Check size={11} /> רשום</span>
                      : <span className="text-[10px] text-gray-400">לא רשום</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* WhatsApp — only when there's an actual phone number */}
        {waPhone && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700">
            <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors border border-green-200 dark:bg-green-900/20 dark:text-green-300">
              <MessageCircle size={15} />
              שלח הודעה ב-WhatsApp
            </a>
          </div>
        )}

        {/* Danger zone — super admin only */}
        {onDelete && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/20"
              >
                <Trash2 size={15} />
                מחק משתמש לצמיתות
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-red-600 dark:text-red-300 text-right leading-relaxed">
                  המשתמש יימחק לצמיתות ויוסר מכל הילדים המקושרים. פעולה זו אינה הפיכה.
                  כדי לחסום התחברות מחדש יש למחוק את החשבון גם ב-Firebase Console → Authentication.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => { setDeleting(true); try { await onDelete(user) } finally { setDeleting(false) } }}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                  >
                    {deleting ? 'מוחק…' : `כן, מחק את ${user.name || 'המשתמש'}`}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const navigate = useNavigate()
  const { isAdmin, isSuperAdmin, isClassAdmin, user: currentUser } = useAuth()
  const [users, setUsers]       = useState([])
  const [classes, setClasses]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [classFilter, setClassFilter] = useState('all')
  const [showInvite, setShowInvite] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [saving, setSaving]     = useState(null)
  const [error, setError]       = useState('')
  const [selectedUser, setSelectedUser] = useState(null)

  const myClassIds = currentUser?.classAdminFor || []

  const loadUsers = async () => {
    setLoading(true)
    const [data, classData] = await Promise.all([getUsers(), getClasses()])
    const scoped = isClassAdmin && !isAdmin
      ? data.filter(u => (u.classIds || []).some(id => myClassIds.includes(id)))
      : data
    setUsers(scoped)
    setClasses(classData)
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

  const changeStatus = async (user, newStatus) => {
    setError('')
    setSaving(user.uid)
    try {
      // Alumni lose class membership AND class-admin powers — cuts access to
      // class rosters and children data while keeping the account
      const updates = newStatus === 'alumni'
        ? { status: newStatus, classIds: [], classAdminFor: [] }
        : { status: newStatus }
      if (newStatus === 'alumni') {
        for (const classId of user.classAdminFor || []) {
          await removeClassAdmin(classId, user.uid)
        }
      }
      await updateDoc(doc(db, 'users', user.uid), updates)
      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, ...updates } : u))
      setSelectedUser(prev => prev?.uid === user.uid ? { ...prev, ...updates } : prev)
    } catch (err) {
      console.error('changeStatus error:', err)
      setError(`שגיאה בעדכון סטטוס: ${err.code || err.message}`)
    } finally {
      setSaving(null)
    }
  }

  const approve = (user) => changeStatus(user, 'active')
  const deny     = (user) => changeStatus(user, 'inactive')

  const filtered = users.filter(u => {
    const matchRole   = roleFilter === 'all' || u.role === roleFilter
    const matchClass  = classFilter === 'all' || (u.classIds || []).includes(classFilter)
    const q = search.toLowerCase()
    const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    return matchRole && matchClass && matchSearch
  })

  const pendingCount = users.filter(u => u.status === 'pending').length

  const isUrl = (s) => typeof s === 'string' && s.startsWith('http')

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => setShowAddMember(true)} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
              <UserPlus size={16} />
              הוסף חבר
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 text-sm py-2 px-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700/50">
              <Link2 size={15} />
              הזמן בקישור
            </button>
          )}
          <button onClick={() => navigate('/admin/import')}
            className="flex items-center gap-1.5 text-sm py-2 px-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700/50">
            <Upload size={15} />
            ייבוא
          </button>
          <button onClick={loadUsers} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700" title="רענן">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div>
          <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 justify-end dark:text-primary-300">
            <span className="text-xl leading-none">👥</span>
            {isClassAdmin && !isAdmin ? 'חברי הכיתה' : 'ניהול חברים'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 text-right dark:text-gray-400">
            {users.length} חברים רשומים
            {pendingCount > 0 && <span className="text-amber-600 dark:text-amber-400"> · {pendingCount} ממתינים לאישור</span>}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-right dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש..." className="input w-full ps-9 text-right py-2 text-sm" />
        </div>
        {['all', 'community', 'new_family', 'host_family', 'admin'].map(r => (
          <button key={r} onClick={() => setRoleFilter(r)}
            className={clsx('px-3 py-1.5 rounded-full text-sm font-medium transition-all flex-shrink-0',
              roleFilter === r ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary-300')}>
            {r === 'all' ? 'הכל' : ROLES.find(x => x.value === r)?.label}
          </button>
        ))}
        {isAdmin && classes.length > 0 && (
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            <option value="all">כל הכיתות</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-primary-400" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(user => {
            const rawDigits = (user.phone || '').replace(/\D/g, '')
            const phone = rawDigits.length > 3 ? (rawDigits.startsWith('972') ? rawDigits : '972' + rawDigits.replace(/^0/, '')) : null
            return (
              <div key={user.uid}
                className="card p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors dark:hover:bg-gray-700/50"
                onClick={() => setSelectedUser(user)}>
                {isUrl(user.avatar)
                  ? <img src={user.avatar} alt="" className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />
                  : <div className="avatar w-10 h-10 text-sm bg-primary-100 text-primary-700 flex-shrink-0 dark:text-primary-300 dark:bg-primary-900/40">
                      {user.name?.[0] || '?'}
                    </div>
                }
                <div className="flex-1 min-w-0 text-right">
                  <div className="font-semibold text-gray-800 text-sm flex items-center gap-1.5 justify-end dark:text-gray-100">
                    {user.status && user.status !== 'active' && (
                      <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', STATUS_STYLE[user.status])}>
                        {STATUSES.find(s => s.value === user.status)?.label}
                      </span>
                    )}
                    {user.name}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{user.email}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {saving === user.uid && <Loader2 size={14} className="animate-spin text-gray-400" />}
                  {user.status === 'pending' ? (
                    <>
                      <button onClick={() => approve(user)} disabled={saving === user.uid}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                        אשר
                      </button>
                      <button onClick={() => deny(user)} disabled={saving === user.uid}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">
                        דחה
                      </button>
                    </>
                  ) : isAdmin ? (
                    <select
                      value={user.role || 'community'}
                      disabled={saving === user.uid}
                      onChange={e => changeRole(user, e.target.value)}
                      className={clsx(
                        'text-xs px-2.5 py-1.5 rounded-lg border font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50',
                        ROLE_STYLE[user.role] || ROLE_STYLE.community
                      )}
                    >
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  ) : (
                    <span className={clsx('text-xs px-2.5 py-1.5 rounded-lg border font-medium', ROLE_STYLE[user.role] || ROLE_STYLE.community)}>
                      {ROLES.find(r => r.value === user.role)?.label || 'חבר קהילה'}
                    </span>
                  )}
                </div>
                {phone && (
                  <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="p-2 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors flex-shrink-0 dark:bg-green-900/20 dark:text-green-400">
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

      {showAddMember && (
        <AddMemberPanel
          onClose={() => setShowAddMember(false)}
          onCreated={(newUser) => {
            setUsers(prev => [newUser, ...prev])
            setShowAddMember(false)
          }}
        />
      )}
      {showInvite && <InvitePanel onClose={() => setShowInvite(false)} />}
      {selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          saving={saving}
          onRoleChange={(user, role) => changeRole(user, role)}
          onRolesChange={(user, roles) => changeRoles(user, roles)}
          onStatusChange={(user, status) => changeStatus(user, status)}
          canEditRoles={isAdmin}
          onDelete={isSuperAdmin && selectedUser.uid !== currentUser?.uid ? async (u) => {
            try {
              await deleteUserCompletely(u)
              setUsers(prev => prev.filter(x => x.uid !== u.uid))
              setSelectedUser(null)
              toast(`${u.name || 'המשתמש'} נמחק`)
            } catch (err) {
              console.error('deleteUserCompletely failed:', err)
              toast.error('שגיאה במחיקת המשתמש')
            }
          } : undefined}
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
