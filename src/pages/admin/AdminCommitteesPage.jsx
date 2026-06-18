import { useState, useEffect } from 'react'
import { getCommittees, saveCommittee, deleteCommittee, getHobbyGroups, saveHobbyGroup, deleteHobbyGroup } from '../../lib/db'
import { COMMITTEE_ICONS, CLASS_COLORS } from '../../lib/classColors'
import {
  Users, Plus, Edit2, Trash2, X, Check, Loader2,
  Heart, Star, Music, Book, Globe, Zap, Gift, Coffee,
  Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
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

// ── Edit panel ────────────────────────────────────────────────────────────────

function CommitteePanel({ committee, isNew, onSave, onClose }) {
  const [draft, setDraft]   = useState({ ...committee })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (f, v) => setDraft(d => ({ ...d, [f]: v }))

  const updateMember = (i, field, val) =>
    setDraft(d => ({ ...d, members: d.members.map((m, idx) => idx === i ? { ...m, [field]: val } : m) }))
  const removeMember = (i) =>
    setDraft(d => ({ ...d, members: d.members.filter((_, idx) => idx !== i) }))
  const addMember = () =>
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
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
          <h2 className="font-bold text-gray-800">{isNew ? 'ועדה חדשה' : 'עריכת ועדה'}</h2>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 btn-primary text-sm py-1.5 px-3">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            שמור
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}

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
                      : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
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

          <div>
            <label className="label mb-3">חברי הוועדה</label>
            <div className="space-y-3">
              {(draft.members || []).map((m, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <input value={m.name} onChange={e => updateMember(i, 'name', e.target.value)}
                      placeholder="שם" className="input flex-1 text-sm py-1.5" />
                    <input value={m.title || ''} onChange={e => updateMember(i, 'title', e.target.value)}
                      placeholder="תפקיד" className="input w-28 text-sm py-1.5" />
                    <button onClick={() => removeMember(i)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
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
              <button type="button" onClick={addMember}
                className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium">
                <Plus size={14} />
                הוסף חבר/ת ועדה
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Hobby group inline edit form ──────────────────────────────────────────────

const HOBBY_ICONS = ['Heart', 'Star', 'Music', 'Book', 'Globe', 'Zap', 'Coffee', 'Briefcase', 'Camera', 'Sun', 'Leaf', 'Palette']

function HobbyGroupForm({ group, onSave, onCancel }) {
  const [draft, setDraft] = useState({ icon: 'Heart', color: '#1B3B70', order: 0, ...group })
  const [saving, setSaving] = useState(false)
  const set = (f, v) => setDraft(d => ({ ...d, [f]: v }))

  const handleSave = async () => {
    if (!draft.name?.trim()) return
    setSaving(true)
    try { await onSave(draft) } finally { setSaving(false) }
  }

  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-3">
      <input value={draft.name || ''} onChange={e => set('name', e.target.value)}
        className="input w-full text-right text-sm" placeholder="שם הקבוצה" />
      <input value={draft.description || ''} onChange={e => set('description', e.target.value)}
        className="input w-full text-right text-sm" placeholder="תיאור (אופציונלי)" />
      <div className="flex gap-2 flex-wrap">
        {HOBBY_ICONS.map(name => {
          const Icon = ICON_MAP[name] || Users
          return (
            <button key={name} type="button"
              onClick={() => set('icon', name)}
              className={clsx('w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                draft.icon === name ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-primary-300'
              )}>
              <Icon size={16} />
            </button>
          )
        })}
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving || !draft.name?.trim()}
          className="flex-1 btn-primary py-2 text-sm">
          {saving ? '...' : 'שמור'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-gray-200 rounded-xl text-sm">ביטול</button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminCommitteesPage() {
  const [tab, setTab]               = useState('committees')
  const [committees, setCommittees] = useState([])
  const [selected, setSelected]     = useState(null)
  const [isNew, setIsNew]           = useState(false)
  const [loading, setLoading]       = useState(true)
  const [deleting, setDeleting]     = useState(null)
  const [error, setError]           = useState('')

  // Hobby groups state
  const [hobbyGroups, setHobbyGroups]   = useState([])
  const [loadingHobby, setLoadingHobby] = useState(false)
  const [editingHobby, setEditingHobby] = useState(null) // null | group | 'new'
  const [deletingHobby, setDeletingHobby] = useState(null)

  useEffect(() => {
    getCommittees()
      .then(setCommittees)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab !== 'hobby' || hobbyGroups.length > 0) return
    setLoadingHobby(true)
    getHobbyGroups().then(setHobbyGroups).finally(() => setLoadingHobby(false))
  }, [tab])

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

  const handleSaveHobby = async (group) => {
    const saved = await saveHobbyGroup(group)
    setHobbyGroups(prev => {
      const idx = prev.findIndex(x => x.id === saved.id)
      return idx >= 0 ? prev.map(x => x.id === saved.id ? saved : x) : [...prev, saved]
    })
    setEditingHobby(null)
  }

  const handleDeleteHobby = async (id) => {
    setDeletingHobby(id)
    try {
      await deleteHobbyGroup(id)
      setHobbyGroups(prev => prev.filter(g => g.id !== id))
    } finally {
      setDeletingHobby(null)
    }
  }

  const TABS = [{ id: 'committees', label: 'ועדות' }, { id: 'hobby', label: 'קבוצות קהילה' }]

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">ועדות וקבוצות</h1>
        {tab === 'committees' && (
          <button onClick={() => { setSelected(blankCommittee(committees.length + 1)); setIsNew(true) }}
            className="btn-primary flex items-center gap-2">
            <Plus size={16} />ועדה חדשה
          </button>
        )}
        {tab === 'hobby' && (
          <button onClick={() => setEditingHobby({ id: 'hobby-' + Date.now(), name: '', description: '', icon: 'Heart', color: '#1B3B70', order: hobbyGroups.length })}
            className="btn-primary flex items-center gap-2">
            <Plus size={16} />קבוצה חדשה
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

      {/* Committees tab */}
      {tab === 'committees' && (loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : committees.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">אין ועדות עדיין</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {committees.map(c => (
            <div key={c.id} className="bg-white rounded-2xl shadow-card border border-gray-100 p-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: c.color + '20' }}>
                <CommitteeIcon name={c.icon} size={22} className="opacity-90" style={{ color: c.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-800">{c.name}</div>
                {c.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.description}</p>}
                {c.members?.length > 0 && <p className="text-xs text-gray-400 mt-1">{c.members.length} חברים</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => { setSelected(c); setIsNew(false) }}
                  className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl">
                  {deleting === c.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Hobby groups tab */}
      {tab === 'hobby' && (loadingHobby ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {editingHobby && editingHobby.id.startsWith('hobby-') && (
            <HobbyGroupForm group={editingHobby} onSave={handleSaveHobby} onCancel={() => setEditingHobby(null)} />
          )}
          {hobbyGroups.length === 0 && !editingHobby && (
            <div className="text-center py-16 text-gray-400">
              <Users size={40} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">אין קבוצות קהילה עדיין</p>
            </div>
          )}
          {hobbyGroups.map(g => (
            editingHobby?.id === g.id
              ? <HobbyGroupForm key={g.id} group={g} onSave={handleSaveHobby} onCancel={() => setEditingHobby(null)} />
              : (
                <div key={g.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: g.color + '20' }}>
                    <CommitteeIcon name={g.icon} size={18} style={{ color: g.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800 text-sm">{g.name}</div>
                    {g.description && <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{(g.memberUids || []).length} חברים</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditingHobby(g)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDeleteHobby(g.id)} disabled={deletingHobby === g.id}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl">
                      {deletingHobby === g.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              )
          ))}
        </div>
      ))}

      {selected && (
        <CommitteePanel
          committee={selected}
          isNew={isNew}
          onSave={handleSave}
          onClose={() => { setSelected(null); setIsNew(false) }}
        />
      )}
    </div>
  )
}
