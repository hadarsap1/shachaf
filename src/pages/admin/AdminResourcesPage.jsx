import { useState, useEffect } from 'react'
import { getResources, saveResource, deleteResource } from '../../lib/db'
import {
  BookOpen, Plus, Edit2, Trash2, X, Loader2, Check,
  Link, FileText, Map, Phone, Calendar, Video, ExternalLink,
} from 'lucide-react'
import clsx from 'clsx'

const ICON_OPTIONS = [
  { value: 'link',     label: 'קישור כללי',   Icon: Link },
  { value: 'doc',      label: 'מסמך',          Icon: FileText },
  { value: 'calendar', label: 'לוח שנה',       Icon: Calendar },
  { value: 'map',      label: 'מפה / מיקום',   Icon: Map },
  { value: 'phone',    label: 'יצירת קשר',     Icon: Phone },
  { value: 'video',    label: 'וידאו',          Icon: Video },
  { value: 'external', label: 'אתר חיצוני',    Icon: ExternalLink },
]

const ICON_MAP = {
  link:     { Icon: Link,         bg: 'bg-primary-50 dark:bg-primary-900/30',   color: 'text-primary-600 dark:text-primary-400' },
  doc:      { Icon: FileText,     bg: 'bg-blue-50 dark:bg-blue-900/30',         color: 'text-blue-600 dark:text-blue-400' },
  calendar: { Icon: Calendar,     bg: 'bg-accent-50 dark:bg-accent-900/30',     color: 'text-accent-600 dark:text-accent-400' },
  map:      { Icon: Map,          bg: 'bg-green-50 dark:bg-green-900/30',       color: 'text-green-600 dark:text-green-400' },
  phone:    { Icon: Phone,        bg: 'bg-teal-50',                              color: 'text-teal-600' },
  video:    { Icon: Video,        bg: 'bg-purple-50 dark:bg-purple-900/30',     color: 'text-purple-600 dark:text-purple-400' },
  external: { Icon: ExternalLink, bg: 'bg-gray-50 dark:bg-gray-800',            color: 'text-gray-500 dark:text-gray-400' },
}

const blank = (order) => ({
  id: 'resource-' + Date.now(),
  title: '',
  description: '',
  url: '',
  category: '',
  iconType: 'link',
  order,
})

// ── Edit panel ────────────────────────────────────────────────────────────────

function ResourcePanel({ resource, isNew, categories, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...resource })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [categoryInput, setCategoryInput] = useState(resource.category || '')
  const [showCatSuggestions, setShowCatSuggestions] = useState(false)

  const set = (f, v) => setDraft(d => ({ ...d, [f]: v }))

  const catSuggestions = categories.filter(c =>
    c.toLowerCase().includes(categoryInput.toLowerCase()) && c !== categoryInput
  )

  const handleSave = async () => {
    if (!draft.title?.trim()) { setError('כותרת היא שדה חובה'); return }
    if (!draft.url?.trim()) { setError('קישור הוא שדה חובה'); return }
    if (!categoryInput.trim()) { setError('קטגוריה היא שדה חובה'); return }
    setSaving(true)
    try {
      await onSave({ ...draft, title: draft.title.trim(), url: draft.url.trim(), category: categoryInput.trim() })
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col animate-slide-from-right dark:bg-gray-800" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100">{isNew ? 'הוסף קישור' : 'עריכת קישור'}</h2>
          <div className="w-8" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Icon type */}
          <div>
            <label className="label block mb-2 text-right text-xs">סוג אייקון</label>
            <div className="grid grid-cols-4 gap-2">
              {ICON_OPTIONS.map(({ value, label, Icon }) => {
                const { bg, color } = ICON_MAP[value] || ICON_MAP.link
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set('iconType', value)}
                    title={label}
                    className={clsx(
                      'flex flex-col items-center gap-1 p-2 rounded-xl border transition-all text-xs',
                      draft.iconType === value
                        ? `${bg} border-primary-300 ${color} font-semibold`
                        : 'border-gray-200 dark:border-gray-600 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    )}
                  >
                    <Icon size={16} />
                    <span className="truncate w-full text-center leading-tight" style={{ fontSize: 10 }}>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Category */}
          <div className="relative">
            <label className="label block mb-1 text-right text-xs">קטגוריה *</label>
            <input
              value={categoryInput}
              onChange={e => { setCategoryInput(e.target.value); setShowCatSuggestions(true) }}
              onFocus={() => setShowCatSuggestions(true)}
              onBlur={() => setTimeout(() => setShowCatSuggestions(false), 150)}
              className="input w-full text-right"
              placeholder="למשל: בית הספר, קהילה, שירותים..."
            />
            {showCatSuggestions && catSuggestions.length > 0 && (
              <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-card z-10 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
                {catSuggestions.map(c => (
                  <button
                    key={c}
                    type="button"
                    onMouseDown={() => { setCategoryInput(c); setShowCatSuggestions(false) }}
                    className="w-full text-right px-4 py-2.5 text-sm hover:bg-primary-50 hover:text-primary-700 transition-colors dark:hover:bg-primary-900/30"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="label block mb-1 text-right text-xs">כותרת *</label>
            <input
              value={draft.title}
              onChange={e => set('title', e.target.value)}
              className="input w-full text-right"
              placeholder="שם הקישור / המשאב"
            />
          </div>

          {/* Description */}
          <div>
            <label className="label block mb-1 text-right text-xs">תיאור קצר</label>
            <input
              value={draft.description || ''}
              onChange={e => set('description', e.target.value)}
              className="input w-full text-right"
              placeholder="משפט קצר שמסביר מה זה"
            />
          </div>

          {/* URL */}
          <div>
            <label className="label block mb-1 text-right text-xs">קישור (URL) *</label>
            <input
              type="url"
              value={draft.url}
              onChange={e => set('url', e.target.value)}
              className="input w-full"
              placeholder="https://"
              dir="ltr"
            />
          </div>

          {/* Order */}
          <div>
            <label className="label block mb-1 text-right text-xs">סדר תצוגה</label>
            <input
              type="number"
              value={draft.order ?? 0}
              onChange={e => set('order', Number(e.target.value))}
              className="input w-full text-right"
              min={0}
            />
          </div>

          {error && <p className="text-xs text-red-500 text-right">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? 'שומר...' : isNew ? 'הוסף קישור' : 'שמור שינויים'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminResourcesPage() {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState(null) // { resource, isNew }
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    getResources()
      .then(r => { setResources(r); setLoading(false) })
      .catch(err => { console.error('AdminResourcesPage load failed', err); setLoading(false) })
  }, [])

  const categories = [...new Set(resources.map(r => r.category).filter(Boolean))]

  const handleSave = async (resource) => {
    const saved = await saveResource(resource)
    setResources(prev => {
      const idx = prev.findIndex(r => r.id === saved.id)
      return idx >= 0 ? prev.map(r => r.id === saved.id ? saved : r) : [...prev, saved]
    })
    setPanel(null)
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await deleteResource(id)
      setResources(prev => prev.filter(r => r.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setPanel({ resource: blank(resources.length), isNew: true })}
          className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
        >
          <Plus size={16} />
          הוסף קישור
        </button>
        <div>
          <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 justify-end dark:text-primary-300">
            <span className="text-xl leading-none">📖</span>
            מידע שימושי
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 text-right dark:text-gray-400">{resources.length} קישורים</p>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-primary-400" />
        </div>
      )}

      {!loading && resources.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <BookOpen size={44} className="mx-auto mb-4 opacity-25" />
          <p className="font-semibold text-gray-500 dark:text-gray-400">אין קישורים עדיין</p>
          <p className="text-sm mt-1">לחצו על "הוסף קישור" כדי להתחיל</p>
        </div>
      )}

      {categories.map(cat => (
        <section key={cat} className="mb-6">
          <h2 className="font-bold text-gray-500 text-xs uppercase tracking-wide mb-3 flex items-center gap-2 dark:text-gray-400">
            <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            {cat}
            <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </h2>
          <div className="space-y-2">
            {resources.filter(r => r.category === cat).map(resource => {
              const { Icon, bg, color } = ICON_MAP[resource.iconType] || ICON_MAP.link
              return (
                <div
                  key={resource.id}
                  className="card p-4 flex items-center gap-3"
                >
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${bg}`}>
                    <Icon size={16} className={color} />
                  </div>
                  <div className="flex-1 text-right min-w-0">
                    <div className="font-semibold text-gray-800 text-sm dark:text-gray-100">{resource.title}</div>
                    {resource.description && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate dark:text-gray-400">{resource.description}</div>
                    )}
                    <div className="text-xs text-primary-400 mt-0.5 truncate" dir="ltr">{resource.url}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setPanel({ resource, isNew: false })}
                      className="p-2 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors dark:hover:bg-primary-900/30"
                      title="עריכה"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(resource.id)}
                      disabled={deleting === resource.id}
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40 dark:hover:bg-red-900/20"
                      title="מחיקה"
                    >
                      {deleting === resource.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {panel && (
        <ResourcePanel
          resource={panel.resource}
          isNew={panel.isNew}
          categories={categories}
          onSave={handleSave}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  )
}
