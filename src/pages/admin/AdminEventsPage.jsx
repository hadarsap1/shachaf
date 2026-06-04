import { useState } from 'react'
import { MOCK_EVENTS } from '../../lib/mockData'
import { Calendar, Plus, Edit2, Trash2, MapPin, Clock, X, Check } from 'lucide-react'
import clsx from 'clsx'

const TYPE_OPTIONS = [
  { value: 'social',      label: 'חברתי' },
  { value: 'orientation', label: 'אוריינטציה' },
  { value: 'ceremony',    label: 'טקס' },
  { value: 'community',   label: 'קהילתי' },
]

const TYPE_COLOR = {
  social:      'badge-primary',
  orientation: 'badge-secondary',
  ceremony:    'badge-accent',
  community:   'bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full text-xs font-medium',
}

const formatDate = (str) => {
  if (!str) return ''
  const d = new Date(str)
  return d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'long' })
}

const blankEvent = () => ({
  id: 'event-' + Date.now(),
  title: '',
  description: '',
  date: '',
  time: '',
  location: '',
  type: 'social',
  required: false,
})

// ---- Event slide panel (add / edit) ----

function EventPanel({ event, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...event })
  const [errors, setErrors] = useState({})

  const set = (field, value) => {
    setDraft(d => ({ ...d, [field]: value }))
    setErrors(e => ({ ...e, [field]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!draft.title.trim()) e.title = 'שדה חובה'
    if (!draft.date) e.date = 'שדה חובה'
    return e
  }

  const handleSave = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    onSave({ ...draft, title: draft.title.trim() })
  }

  const isNew = !MOCK_EVENTS.find(ev => ev.id === event.id)

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
          <h2 className="font-bold text-gray-800">{isNew ? 'אירוע חדש' : 'עריכת אירוע'}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <label className="label block mb-1 text-right">כותרת <span className="text-red-400">*</span></label>
            <input value={draft.title} onChange={e => set('title', e.target.value)}
              className={clsx('input w-full text-right', errors.title && 'border-red-300')}
              placeholder="שם האירוע" />
            {errors.title && <p className="text-xs text-red-500 mt-1 text-right">{errors.title}</p>}
          </div>

          <div>
            <label className="label block mb-1 text-right">תיאור</label>
            <textarea value={draft.description} onChange={e => set('description', e.target.value)}
              className="input w-full text-right resize-none" rows={3}
              placeholder="פרטים נוספים..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1 text-right text-xs">תאריך <span className="text-red-400">*</span></label>
              <input type="date" value={draft.date || ''} onChange={e => set('date', e.target.value)}
                className={clsx('input w-full text-sm', errors.date && 'border-red-300')} dir="ltr" />
              {errors.date && <p className="text-xs text-red-500 mt-1 text-right">{errors.date}</p>}
            </div>
            <div>
              <label className="label block mb-1 text-right text-xs">שעה</label>
              <input type="time" value={draft.time || ''} onChange={e => set('time', e.target.value)}
                className="input w-full text-sm" dir="ltr" />
            </div>
          </div>

          <div>
            <label className="label block mb-1 text-right">מיקום</label>
            <input value={draft.location || ''} onChange={e => set('location', e.target.value)}
              className="input w-full text-right" placeholder="כתובת או שם המקום" />
          </div>

          <div>
            <label className="label block mb-1 text-right">סוג אירוע</label>
            <select value={draft.type} onChange={e => set('type', e.target.value)}
              className="input w-full text-right">
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <input type="checkbox" id="required-toggle" checked={!!draft.required}
              onChange={e => set('required', e.target.checked)}
              className="w-4 h-4 accent-primary-600" />
            <label htmlFor="required-toggle" className="text-sm text-gray-700 cursor-pointer">כולם מוזמנים (סמן כאירוע לכולם)</label>
          </div>
        </div>

        <div className="px-4 py-4 border-t border-gray-100 flex gap-2">
          <button onClick={handleSave} className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2">
            <Check size={15} />
            שמור
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm">
            ביטול
          </button>
        </div>
      </div>
    </>
  )
}

// ---- Main page ----

export default function AdminEventsPage() {
  const [events, setEvents] = useState(MOCK_EVENTS)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const handleSave = (saved) => {
    setEvents(prev => {
      const idx = prev.findIndex(e => e.id === saved.id)
      return idx >= 0 ? prev.map(e => e.id === saved.id ? saved : e) : [...prev, saved]
    })
    setEditing(null)
  }

  const handleDelete = (id) => {
    setEvents(prev => prev.filter(e => e.id !== id))
    setConfirmDelete(null)
  }

  const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date))

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setEditing(blankEvent())}
          className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
        >
          <Plus size={16} />
          אירוע חדש
        </button>
        <div>
          <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 justify-end">
            <Calendar size={22} />
            ניהול אירועים
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 text-right">{events.length} אירועים</p>
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map(event => {
          const typeConf = TYPE_COLOR[event.type]
          const typeLabel = TYPE_OPTIONS.find(o => o.value === event.type)?.label || event.type

          return (
            <div key={event.id} className="card p-4">
              <div className="flex items-start gap-3">
                {/* Date badge */}
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex flex-col items-center justify-center flex-shrink-0">
                  {event.date ? (
                    <>
                      <span className="text-xs text-primary-400 font-medium leading-none">
                        {new Date(event.date).toLocaleDateString('he-IL', { month: 'short' })}
                      </span>
                      <span className="text-lg font-black text-primary-700 leading-tight">
                        {new Date(event.date).getDate()}
                      </span>
                    </>
                  ) : (
                    <Calendar size={16} className="text-primary-300" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 text-right min-w-0">
                  <div className="flex items-center gap-2 justify-end flex-wrap mb-0.5">
                    <span className="font-semibold text-gray-800 text-sm">{event.title}</span>
                    <span className={typeConf || 'badge'}>{typeLabel}</span>
                    {event.required && (
                      <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-medium">כולם מוזמנים</span>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-xs text-gray-500 mb-1 line-clamp-1">{event.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-400 justify-end flex-wrap">
                    {event.date && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {formatDate(event.date)}{event.time ? ` • ${event.time}` : ''}
                      </span>
                    )}
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} />
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setEditing(event); setConfirmDelete(null) }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    title="ערוך"
                  >
                    <Edit2 size={14} />
                  </button>

                  {confirmDelete === event.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg transition-colors"
                      >
                        מחק
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-1.5 py-1 rounded-lg hover:bg-gray-100"
                      >
                        ביטול
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(event.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="מחק"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {events.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">אין אירועים מתוכננים</p>
          <button onClick={() => setEditing(blankEvent())} className="mt-3 text-sm text-primary-600 hover:underline">
            הוסף אירוע ראשון
          </button>
        </div>
      )}

      {editing && (
        <EventPanel
          event={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
