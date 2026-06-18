import { useState, useEffect, useRef } from 'react'
import { getHobbyGroups, saveHobbyGroup, deleteHobbyGroup, getUsers } from '../../lib/db'
import { COMMITTEE_ICONS, CLASS_COLORS } from '../../lib/classColors'
import {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
  Plus, Edit2, Trash2, X, Loader2, Search,
} from 'lucide-react'
import clsx from 'clsx'

const ICON_MAP = {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
}

const HOBBY_ICONS = ['Heart', 'Star', 'Music', 'Book', 'Globe', 'Zap', 'Coffee', 'Briefcase', 'Camera', 'Sun', 'Leaf', 'Palette', 'Users', 'Gift', 'Flag', 'Shield']

// ── Member search ─────────────────────────────────────────────────────────────
function MemberSearch({ communityUsers, onSelect }) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const ref               = useRef(null)

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
    onSelect(u)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus-within:border-primary-400 focus-within:bg-white transition-colors">
        <Search size={14} className="text-gray-400 flex-shrink-0" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="הוסף חבר/ת מהקהילה..."
          className="flex-1 text-sm bg-transparent outline-none text-right placeholder:text-gray-400"
          dir="rtl"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 right-0 left-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map(u => (
            <button
              key={u.uid}
              type="button"
              onMouseDown={() => pick(u)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 text-right transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600 flex-shrink-0">
                {u.name?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                {u.phone && <p className="text-xs text-gray-400" dir="ltr">{u.phone}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Group edit panel ──────────────────────────────────────────────────────────
function GroupPanel({ group, isNew, onSave, onClose, communityUsers, allUsers }) {
  const [draft, setDraft]   = useState({ icon: 'Heart', color: CLASS_COLORS[0], order: 0, memberUids: [], ...group })
  const [saving, setSaving] = useState(false)
  const set = (f, v) => setDraft(d => ({ ...d, [f]: v }))

  const addMember = (u) => {
    if (draft.memberUids.includes(u.uid)) return
    set('memberUids', [...draft.memberUids, u.uid])
  }
  const removeMember = (uid) => set('memberUids', draft.memberUids.filter(u => u !== uid))

  const handleSave = async () => {
    if (!draft.name?.trim()) return
    setSaving(true)
    try { await onSave(draft) } finally { setSaving(false) }
  }

  const memberUsers = draft.memberUids
    .map(uid => allUsers.find(u => u.uid === uid))
    .filter(Boolean)

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
          <h2 className="font-bold text-gray-800">{isNew ? 'קבוצה חדשה' : 'עריכת קבוצה'}</h2>
          <button onClick={handleSave} disabled={saving || !draft.name?.trim()}
            className="btn-primary text-sm py-1.5 px-3">
            {saving ? '...' : 'שמור'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="label">שם הקבוצה</label>
            <input value={draft.name || ''} onChange={e => set('name', e.target.value)}
              className="input w-full text-right" placeholder="לדוגמה: ספורט, קריאה, בישול..." />
          </div>

          <div>
            <label className="label">תיאור (אופציונלי)</label>
            <textarea value={draft.description || ''} onChange={e => set('description', e.target.value)}
              rows={2} className="input w-full resize-none text-sm text-right"
              placeholder="על מה הקבוצה?" />
          </div>

          <div>
            <label className="label">אייקון</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {HOBBY_ICONS.map(name => {
                const Icon = ICON_MAP[name] || Users
                return (
                  <button key={name} type="button" onClick={() => set('icon', name)}
                    className={clsx('w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all',
                      draft.icon === name
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                    )}>
                    <Icon size={16} />
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">צבע</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {CLASS_COLORS.map(c => (
                <button key={c} type="button" onClick={() => set('color', c)}
                  className={clsx('w-7 h-7 rounded-full border-2 transition-transform',
                    draft.color === c ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Members */}
          <div>
            <label className="label mb-2">חברי הקבוצה ({memberUsers.length})</label>
            <MemberSearch communityUsers={communityUsers} onSelect={addMember} />

            {memberUsers.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {memberUsers.map(u => (
                  <div key={u.uid} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                    <button onClick={() => removeMember(u.uid)}
                      className="p-1 text-red-400 hover:text-red-600">
                      <X size={13} />
                    </button>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-800">{u.name}</p>
                      {u.phone && <p className="text-xs text-gray-400" dir="ltr">{u.phone}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminCommunityGroupsPage() {
  const [groups, setGroups]               = useState([])
  const [allUsers, setAllUsers]           = useState([])
  const [selected, setSelected]           = useState(null)
  const [isNew, setIsNew]                 = useState(false)
  const [loading, setLoading]             = useState(true)
  const [deleting, setDeleting]           = useState(null)

  useEffect(() => {
    Promise.all([getHobbyGroups(), getUsers()])
      .then(([g, u]) => { setGroups(g); setAllUsers(u) })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (g) => {
    const saved = await saveHobbyGroup(g)
    setGroups(prev => {
      const idx = prev.findIndex(x => x.id === saved.id)
      return idx >= 0 ? prev.map(x => x.id === saved.id ? saved : x) : [...prev, saved]
    })
    setSelected(null)
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await deleteHobbyGroup(id)
      setGroups(prev => prev.filter(g => g.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const blank = () => ({
    id: 'hobby-' + Date.now(),
    name: '', description: '', icon: 'Heart',
    color: CLASS_COLORS[0], order: groups.length,
    memberUids: [],
  })

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">קבוצות קהילה</h1>
          <p className="text-sm text-gray-500 mt-0.5">ניהול קבוצות וחברות</p>
        </div>
        <button onClick={() => { setSelected(blank()); setIsNew(true) }}
          className="btn-primary flex items-center gap-2">
          <Plus size={16} />קבוצה חדשה
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Heart size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">אין קבוצות קהילה עדיין</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map(g => {
            const Icon = ICON_MAP[g.icon] || Users
            return (
              <div key={g.id} className="bg-white rounded-2xl shadow-card border border-gray-100 p-5 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: (g.color || '#1B3B70') + '20' }}>
                  <Icon size={22} style={{ color: g.color || '#1B3B70' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800">{g.name}</div>
                  {g.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{g.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">{(g.memberUids || []).length} חברים</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => { setSelected(g); setIsNew(false) }}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => handleDelete(g.id)} disabled={deleting === g.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl">
                    {deleting === g.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <GroupPanel
          group={selected}
          isNew={isNew}
          onSave={handleSave}
          onClose={() => { setSelected(null); setIsNew(false) }}
          communityUsers={allUsers}
          allUsers={allUsers}
        />
      )}
    </div>
  )
}
