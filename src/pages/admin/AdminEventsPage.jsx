import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getEvents, saveEvent, deleteEvent, getClasses, uploadEventImage, deleteEventImage } from '../../lib/db'
import { Calendar, Plus, Edit2, Trash2, MapPin, Clock, X, Check, ExternalLink, Loader2, ImagePlus } from 'lucide-react'
import clsx from 'clsx'

function googleCalendarUrl(event) {
  const time = event.time || '09:00'
  const start = `${event.date}T${time}`
  const [h, m] = time.split(':').map(Number)
  const end = `${event.date}T${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const fmt = (s) => s.replace(/[-:]/g, '').slice(0, 13) + '00Z'
  const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates: `${fmt(start)}/${fmt(end)}`, location: event.location || '', details: event.description || '' })
  return `https://calendar.google.com/calendar/render?${params}`
}

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

const TARGET_GROUPS = [
  { value: 'all',        label: 'כולם' },
  { value: 'new_family', label: 'משפחות חדשות' },
  { value: 'host_family',label: 'משפחות מארחות' },
]

const blankEvent = () => ({
  id: 'event-' + Date.now(),
  title: '',
  description: '',
  date: '',
  time: '',
  location: '',
  type: 'social',
  required: false,
  targetGroups: ['all'],
  classIds: [],
})

// ---- Event slide panel (add / edit) ----

function EventPanel({ event, isNew, onSave, onClose, allClasses = [] }) {
  const [draft, setDraft] = useState({ ...event, classIds: event.classIds || [] })
  const [errors, setErrors] = useState({})
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(event.imageUrl || null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  const set = (field, value) => {
    setDraft(d => ({ ...d, [field]: value }))
    setErrors(e => ({ ...e, [field]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!draft.title.trim()) e.title = 'שדה חובה'
    if (!draft.date) e.date = 'שדה חובה'
    const groups = draft.targetGroups || []
    if (groups.length === 0) e.targetGroups = 'יש לבחור לפחות קהל יעד אחד'
    return e
  }

  const toggleGroup = (value) => {
    setErrors(e => ({ ...e, targetGroups: '' }))
    if (value === 'all') {
      set('targetGroups', ['all'])
      return
    }
    const current = (draft.targetGroups || ['all']).filter(g => g !== 'all')
    const next = current.includes(value)
      ? current.filter(g => g !== value)
      : [...current, value]
    set('targetGroups', next.length ? next : ['all'])
  }

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleImageRemove = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    try {
      const shouldRemove = !imagePreview && !!event.imageUrl
      await onSave({ ...draft, title: draft.title.trim() }, imageFile, shouldRemove)
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
          <h2 className="font-bold text-gray-800">{isNew ? 'אירוע חדש' : 'עריכת אירוע'}</h2>
          <div className="w-8" />
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

          <div>
            <label className="label block mb-1 text-right">קהל יעד</label>
            <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
              {TARGET_GROUPS.map(g => {
                const groups = draft.targetGroups || ['all']
                const isChecked = g.value === 'all'
                  ? groups.includes('all')
                  : !groups.includes('all') && groups.includes(g.value)
                return (
                  <label key={g.value} className="flex items-center justify-end gap-2 cursor-pointer">
                    <span className="text-sm text-gray-700">{g.label}</span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleGroup(g.value)}
                      className="w-4 h-4 accent-primary-600"
                    />
                  </label>
                )
              })}
            </div>
            {errors.targetGroups && <p className="text-xs text-red-500 mt-1 text-right">{errors.targetGroups}</p>}
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <input type="checkbox" id="required-toggle" checked={!!draft.required}
              onChange={e => set('required', e.target.checked)}
              className="w-4 h-4 accent-primary-600" />
            <label htmlFor="required-toggle" className="text-sm text-gray-700 cursor-pointer">כולם מוזמנים (סמן כאירוע לכולם)</label>
          </div>

          {/* Image */}
          <div>
            <label className="label block mb-2 text-right">תמונה לאירוע</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden">
                <img src={imagePreview} alt="" className="w-full h-40 object-cover" />
                <button
                  type="button"
                  onClick={handleImageRemove}
                  className="absolute top-2 left-2 w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 hover:border-primary-300 rounded-xl py-6 flex flex-col items-center gap-2 text-gray-400 hover:text-primary-500 transition-colors"
              >
                <ImagePlus size={22} />
                <span className="text-sm">הוסף תמונה</span>
              </button>
            )}
          </div>

          {allClasses.length > 0 && (
            <div>
              <label className="label block mb-1 text-right">כיתות (ריק = כלל בית הספר)</label>
              <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2 max-h-40 overflow-y-auto">
                {allClasses.map(cls => {
                  const checked = (draft.classIds || []).includes(cls.id)
                  return (
                    <label key={cls.id} className="flex items-center justify-end gap-2 cursor-pointer">
                      <span className="text-sm text-gray-700 flex items-center gap-1.5">
                        {cls.name}
                        <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                          style={{ backgroundColor: cls.color || '#1B3B70' }} />
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? (draft.classIds || []).filter(id => id !== cls.id)
                            : [...(draft.classIds || []), cls.id]
                          set('classIds', next)
                        }}
                        className="w-4 h-4 accent-primary-600"
                      />
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-4 border-t border-gray-100 flex gap-2">
          <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {saving ? 'שומר...' : 'שמור'}
          </button>
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm">
            ביטול
          </button>
        </div>
      </div>
    </>
  )
}

// ---- Main page ----

export default function AdminEventsPage() {
  const location = useLocation()
  const [events, setEvents] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    Promise.all([getEvents(), getClasses()]).then(([evts, cls]) => {
      setEvents(evts)
      setClasses(cls)
      setLoading(false)
      if (location.state?.editEvent) setEditing(location.state.editEvent)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (saved, newImageFile, shouldRemoveImage) => {
    setEditing(null)
    try {
      let persisted = await saveEvent(saved)

      if (newImageFile) {
        const { url, path } = await uploadEventImage(persisted.id, newImageFile)
        persisted = await saveEvent({ ...persisted, imageUrl: url, imagePath: path })
      } else if (shouldRemoveImage && saved.imagePath) {
        await deleteEventImage(saved.imagePath)
        persisted = await saveEvent({ ...persisted, imageUrl: null, imagePath: null })
      }

      setEvents(cur => {
        const idx = cur.findIndex(e => e.id === saved.id || e.id === persisted.id)
        return idx >= 0
          ? cur.map(e => (e.id === saved.id || e.id === persisted.id) ? persisted : e)
          : [...cur, persisted]
      })
    } catch (err) {
      console.error('saveEvent failed', err)
    }
  }

  const handleDelete = async (id) => {
    const prev = [...events]
    setEvents(cur => cur.filter(e => e.id !== id))
    setConfirmDelete(null)
    try {
      await deleteEvent(id)
    } catch (err) {
      console.error('deleteEvent failed', err)
      setEvents(prev)
    }
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

      {/* Loading spinner */}
      {loading && (
        <div className="flex justify-center items-center py-16">
          <Loader2 size={32} className="animate-spin text-primary-400" />
        </div>
      )}

      {/* Events list */}
      {!loading && (
        <div className="space-y-3">
          {sorted.map(event => {
            const typeConf = TYPE_COLOR[event.type]
            const typeLabel = TYPE_OPTIONS.find(o => o.value === event.type)?.label || event.type

            return (
              <div key={event.id}
                className="card p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => { setEditing(event); setConfirmDelete(null) }}>
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
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {event.date && (
                      <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-secondary-600 hover:bg-secondary-50 transition-colors"
                        title="הוסף ליומן Google"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
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
      )}

      {!loading && events.length === 0 && (
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
          isNew={editing.id.startsWith('event-')}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          allClasses={classes}
        />
      )}
    </div>
  )
}
