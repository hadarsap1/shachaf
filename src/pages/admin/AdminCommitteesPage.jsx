import { useState, useEffect, useRef } from 'react'
import { getCommittees, saveCommittee, deleteCommittee, getUsers, approveCommittee } from '../../lib/db'
import { COMMITTEE_ICONS, CLASS_COLORS } from '../../lib/classColors'
import {
  Users, Plus, Edit2, Trash2, X, Check, Loader2,
  Heart, Star, Music, Book, Globe, Zap, Gift, Coffee,
  Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield, Search, Clock3,
} from 'lucide-react'
import clsx from 'clsx'

const ICON_MAP = {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
}

function CommitteeIcon({ name, size = 20, className }) {
  const Icon = ICON_MAP[name] || Users
  return <Icon size={size} className={className} />
}

const blankCommittee = (order) => ({
  id: 'committee-' + Date.now(),
  name: '',
  description: '',
  members: [],
  icon: 'Users',
  color: CLASS_COLORS[0],
  order,
})

const blankMember = () => ({ name: '', phone: '', email: '', title: '' })

// ── Member search autocomplete ────────────────────────────────────────────────
function MemberSearch({ communityUsers, onSelect }) {
  const [query, setQuery]       = useState('')
  const [open, setOpen]         = useState(false)
  const ref                     = useRef(null)

  const filtered = query.trim().length >= 1
    ? communityUsers.filter(u =>
        u.name?.toLowerCase().includes(query.toLowerCase()) ||
        u.email?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = (u) => {
    onSelect({ name: u.name || '', phone: u.phone || '', email: u.email || '', title: '' })
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus-within:border-primary-400 focus-within:bg-white transition-colors dark:bg-gray-900 dark:border-gray-700">
        <Search size={14} className="text-gray-400 flex-shrink-0" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="חפש חבר מהקהילה לפי שם..."
          className="flex-1 text-sm bg-transparent outline-none text-right placeholder:text-gray-400"
          dir="rtl"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 right-0 left-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden max-h-52 overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
          {filtered.map(u => (
            <button
              key={u.uid}
              type="button"
              onMouseDown={() => pick(u)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 text-right transition-colors dark:hover:bg-primary-900/30"
            >
              <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600 flex-shrink-0 dark:bg-primary-900/40">
                {u.name?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate dark:text-gray-100">{u.name}</p>
                {u.phone && <p className="text-xs text-gray-400" dir="ltr">{u.phone}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Edit panel ────────────────────────────────────────────────────────────────
function CommitteePanel({ committee, isNew, onSave, onClose, communityUsers }) {
  const [draft, setDraft]   = useState({ ...committee })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (f, v) => setDraft(d => ({ ...d, [f]: v }))
  const updateMember = (i, field, val) =>
    setDraft(d => ({ ...d, members: d.members.map((m, idx) => idx === i ? { ...m, [field]: val } : m) }))
  const removeMember = (i) =>
    setDraft(d => ({ ...d, members: d.members.filter((_, idx) => idx !== i) }))
  const addMemberFromSearch = (member) =>
    setDraft(d => ({ ...d, members: [...d.members, member] }))
  const addBlankMember = () =>
    setDraft(d => ({ ...d, members: [...d.members, blankMember()] }))

  const handleSave = async () => {
    if (!draft.name?.trim()) { setError('שם הוועדה הוא שדה חובה'); return }
    setSaving(true)
    try {
      await onSave({ ...draft, name: draft.name.trim() })
    } catch (e) {
      setError(e.message)
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
          <h2 className="font-bold text-gray-800 dark:text-gray-100">{isNew ? 'ועדה חדשה' : 'עריכת ועדה'}</h2>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 btn-primary text-sm py-1.5 px-3">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            שמור
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 dark:bg-red-900/20 dark:text-red-400">{error}</div>}

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">שם הוועדה</label>
              <input value={draft.name || ''} onChange={e => set('name', e.target.value)}
                placeholder="לדוגמה: ועד הורים" className="input w-full" />
            </div>
            <div className="w-16 text-center">
              <label className="label">סדר</label>
              <input type="number" min="1" value={draft.order || 1}
                onChange={e => set('order', Number(e.target.value))}
                className="input w-full text-center" />
            </div>
          </div>

          <div>
            <label className="label">תיאור</label>
            <textarea value={draft.description || ''} onChange={e => set('description', e.target.value)}
              placeholder="מה הוועדה עושה?" rows={3} className="input w-full resize-none text-sm" />
          </div>

          <div>
            <label className="label">אייקון</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {COMMITTEE_ICONS.map(icon => (
                <button key={icon} type="button" onClick={() => set('icon', icon)}
                  className={clsx(
                    'w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all',
                    draft.icon === icon
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 dark:text-gray-300'
                  )}>
                  <CommitteeIcon name={icon} size={16} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">צבע</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {CLASS_COLORS.map(c => (
                <button key={c} type="button" onClick={() => set('color', c)}
                  className={clsx(
                    'w-7 h-7 rounded-full border-2 transition-transform',
                    draft.color === c ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Members section */}
          <div>
            <label className="label mb-3">חברי הוועדה</label>

            {/* Search from registered community members */}
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1.5 text-right">הוסף חבר/ת רשומ/ה מהקהילה:</p>
              <MemberSearch communityUsers={communityUsers} onSelect={addMemberFromSearch} />
            </div>

            <div className="space-y-3">
              {(draft.members || []).map((m, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2 dark:bg-gray-900">
                  <div className="flex gap-2">
                    <input value={m.name} onChange={e => updateMember(i, 'name', e.target.value)}
                      placeholder="שם" className="input flex-1 text-sm py-1.5" />
                    <input value={m.title || ''} onChange={e => updateMember(i, 'title', e.target.value)}
                      placeholder="תפקיד" className="input w-28 text-sm py-1.5" />
                    <button onClick={() => removeMember(i)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg dark:hover:bg-red-900/20">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input value={m.phone || ''} onChange={e => updateMember(i, 'phone', e.target.value)}
                      placeholder="טלפון" className="input flex-1 text-sm py-1.5" dir="ltr" />
                    <input value={m.email || ''} onChange={e => updateMember(i, 'email', e.target.value)}
                      placeholder="מייל" className="input flex-1 text-sm py-1.5" dir="ltr" />
                  </div>
                </div>
              ))}

              <button type="button" onClick={addBlankMember}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium border border-dashed border-gray-300 rounded-xl w-full py-2 justify-center hover:border-gray-400 transition-colors dark:text-gray-400">
                <Plus size={14} />
                הוסף ידנית
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminCommitteesPage() {
  const [committees, setCommittees]         = useState([])
  const [selected, setSelected]             = useState(null)
  const [isNew, setIsNew]                   = useState(false)
  const [loading, setLoading]               = useState(true)
  const [deleting, setDeleting]             = useState(null)
  const [error, setError]                   = useState('')
  const [communityUsers, setCommunityUsers] = useState([])

  useEffect(() => {
    Promise.all([getCommittees(), getUsers()])
      .then(([c, u]) => { setCommittees(c); setCommunityUsers(u) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (c) => {
    const saved = await saveCommittee(c)
    setCommittees(prev => {
      const idx = prev.findIndex(x => x.id === saved.id)
      const next = idx >= 0 ? prev.map(x => x.id === saved.id ? saved : x) : [...prev, saved]
      return [...next].sort((a, b) => (a.order || 0) - (b.order || 0))
    })
    setSelected(null)
    setIsNew(false)
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await deleteCommittee(id)
      setCommittees(prev => prev.filter(c => c.id !== id))
    } catch (e) {
      setError(e.message)
    } finally {
      setDeleting(null)
    }
  }

  const handleApprove = async (id) => {
    setDeleting(id)
    try {
      await approveCommittee(id)
      setCommittees(prev => prev.map(c => c.id === id ? { ...c, status: 'active' } : c))
    } catch (e) {
      setError(e.message)
    } finally {
      setDeleting(null)
    }
  }

  const pending = committees.filter(c => c.status === 'pending')
  const active  = committees.filter(c => c.status !== 'pending')

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 dark:text-white"><span className="text-xl leading-none">🛡️</span>ועדות</h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">ניהול ועדות הקהילה</p>
        </div>
        <button
          onClick={() => { setSelected(blankCommittee(committees.length + 1)); setIsNew(true) }}
          className="btn-primary flex items-center gap-2">
          <Plus size={16} />ועדה חדשה
        </button>
      </div>

      {error && <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm dark:bg-red-900/20 dark:text-red-300">{error}</div>}

      {pending.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-3">
            <Clock3 size={14} />בקשות ממתינות לאישור ({pending.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pending.map(c => (
              <div key={c.id} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                <div className="font-semibold text-gray-800 dark:text-gray-100">{c.name}</div>
                {c.description && <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{c.description}</p>}
                <p className="text-xs text-gray-400 mt-1">בקשה מאת: {c.requestedByName || 'לא ידוע'}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleApprove(c.id)} disabled={deleting === c.id}
                    className="flex-1 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    {deleting === c.id ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'אשר'}
                  </button>
                  <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                    className="flex-1 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">
                    דחה
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : active.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">אין ועדות עדיין</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {active.map(c => (
            <div key={c.id} className="bg-white rounded-2xl shadow-card border border-gray-100 p-5 flex items-start gap-4 dark:bg-gray-800 dark:border-gray-700">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: c.color + '20' }}>
                <CommitteeIcon name={c.icon} size={22} className="opacity-90" style={{ color: c.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-800 dark:text-gray-100">{c.name}</div>
                {c.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 dark:text-gray-400">{c.description}</p>}
                {c.members?.length > 0 && <p className="text-xs text-gray-400 mt-1">{c.members.length} חברים</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => { setSelected(c); setIsNew(false) }}
                  className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl dark:hover:bg-primary-900/30">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl dark:hover:bg-red-900/20">
                  {deleting === c.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <CommitteePanel
          committee={selected}
          isNew={isNew}
          onSave={handleSave}
          onClose={() => { setSelected(null); setIsNew(false) }}
          communityUsers={communityUsers}
        />
      )}
    </div>
  )
}
