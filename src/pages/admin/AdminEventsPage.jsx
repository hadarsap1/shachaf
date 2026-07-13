import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getEvents, saveEvent, deleteEvent, getClasses, getCommittees, uploadEventImage, deleteEventImage, logConsent } from '../../lib/db'
import { CONSENT_VERSION } from '../../lib/consent'
import { Calendar, Plus, Edit2, Trash2, MapPin, Clock, X, Check, ExternalLink, Loader2, ImagePlus, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import CalendarGrid from '../../components/ui/CalendarGrid'
import { useAuth } from '../../context/AuthContext'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import { DIETARY_OPTIONS, DIETARY_NOTE_MAX } from '../../lib/dietary'

function googleCalendarUrl(event) {
  const time = event.time || '09:00'
  const start = `${event.date}T${time}`
  const [h, m] = time.split(':').map(Number)
  const end = `${event.date}T${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const fmt = (s) => s.replace(/[-:]/g, '').slice(0, 13) + '00Z'
  const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates: `${fmt(start)}/${fmt(end)}`, location: event.location || '', details: event.description || '' })
  return `https://calendar.google.com/calendar/render?${params}`
}

const FAMILY_CARDS = [
  { value: 'new_family',  label: 'משפחות חדשות', color: '#1B3B70', bg: '#EBF1FA' },
  { value: 'host_family', label: 'משפחות מארחות', color: '#065f46', bg: '#d1fae5' },
]

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
  community:   'bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full text-xs font-medium dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
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
  { value: 'class',      label: 'כיתה ספציפית' },
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
  committeeId: null,
  dietaryRestrictions: [],
  dietaryNote: '',
})

// ---- Class multi-select dropdown ----

function ClassPicker({ classes, selected, onChange, restricted }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id])
  }

  const selectedClasses = classes.filter(c => selected.includes(c.id))

  return (
    <div ref={ref} className="relative">
      <label className="label block mb-1 text-right">
        כיתות
        {!restricted && <span className="text-xs text-gray-400 me-1"> — ריק = כלל בית הספר</span>}
      </label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input w-full flex items-center justify-between gap-2 min-h-[42px] text-right"
      >
        <ChevronDown size={16} className={clsx('text-gray-400 flex-shrink-0 transition-transform', open && 'rotate-180')} />
        <div className="flex flex-wrap gap-1 justify-end flex-1">
          {selectedClasses.length === 0 ? (
            <span className="text-gray-400 text-sm">{restricted ? 'בחר כיתה' : 'כלל בית הספר'}</span>
          ) : selectedClasses.map(cls => (
            <span key={cls.id} className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: (cls.color || '#1B3B70') + '22', color: cls.color || '#1B3B70' }}>
              {cls.name}
            </span>
          ))}
        </div>
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
          {classes.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">אין כיתות במערכת</p>
          )}
          {classes.map(cls => {
            const checked = selected.includes(cls.id)
            return (
              <label key={cls.id} className="flex items-center justify-end gap-2 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-700 flex items-center gap-1.5 dark:text-gray-200">
                  {cls.name}
                  <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                    style={{ backgroundColor: cls.color || '#1B3B70' }} />
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(cls.id)}
                  className="w-4 h-4 accent-primary-600"
                />
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---- Event slide panel (add / edit) ----

function EventPanel({ event, isNew, onSave, onClose, allClasses = [], allCommittees = [], restricted = false }) {
  const [draft, setDraft] = useState({ ...event, classIds: event.classIds || [], tbdFields: event.tbdFields || [] })
  const [errors, setErrors] = useState({})
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(event.imageUrl || null)
  const [saving, setSaving] = useState(false)
  // Publication acknowledgment — a NEW event can't be saved until its creator
  // confirms the details will be displayed per the policy (existing events
  // were already acknowledged at creation).
  const [publishAck, setPublishAck] = useState(!isNew)
  const fileInputRef = useRef(null)

  useEscapeToClose(onClose, !saving)

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
    if (!publishAck) e.publishAck = 'יש לאשר את פרסום פרטי האירוע כתנאי לשמירה'
    return e
  }

  const toggleGroup = (value) => {
    setErrors(e => ({ ...e, targetGroups: '' }))
    if (value === 'class') {
      setDraft(d => ({ ...d, targetGroups: ['class'] }))
    } else {
      setDraft(d => ({ ...d, targetGroups: [value], classIds: [] }))
    }
  }

  const toggleTbd = (field) => {
    setDraft(d => {
      const tbd = d.tbdFields || []
      return { ...d, tbdFields: tbd.includes(field) ? tbd.filter(f => f !== field) : [...tbd, field] }
    })
  }

  const toggleDietary = (value) => {
    setDraft(d => {
      const tags = d.dietaryRestrictions || []
      return { ...d, dietaryRestrictions: tags.includes(value) ? tags.filter(t => t !== value) : [...tags, value] }
    })
  }

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
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
      <div role="dialog" aria-modal="true" aria-label="עריכת אירוע" className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right dark:bg-gray-800" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100">{isNew ? 'אירוע חדש' : 'עריכת אירוע'}</h2>
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
                className="input w-full text-sm" dir="ltr" disabled={(draft.tbdFields || []).includes('time')} />
              <label className="flex items-center gap-1.5 mt-1 cursor-pointer justify-end">
                <span className="text-xs text-gray-400">טרם נקבע (TBD)</span>
                <input type="checkbox" checked={(draft.tbdFields || []).includes('time')}
                  onChange={() => toggleTbd('time')} className="w-3.5 h-3.5 accent-primary-600" />
              </label>
            </div>
          </div>

          <div>
            <label className="label block mb-1 text-right">מיקום</label>
            <input value={draft.location || ''} onChange={e => set('location', e.target.value)}
              className="input w-full text-right" placeholder="כתובת או שם המקום"
              disabled={(draft.tbdFields || []).includes('location')} />
            <label className="flex items-center gap-1.5 mt-1 cursor-pointer justify-end">
              <span className="text-xs text-gray-400">טרם נקבע (TBD)</span>
              <input type="checkbox" checked={(draft.tbdFields || []).includes('location')}
                onChange={() => toggleTbd('location')} className="w-3.5 h-3.5 accent-primary-600" />
            </label>
          </div>

          <div>
            <label className="label block mb-1 text-right">סוג אירוע</label>
            <select value={draft.type} onChange={e => set('type', e.target.value)}
              className="input w-full text-right">
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Anonymous, event-level only — never tied to a specific child
              (privacy: identified medical info raises the DB classification) */}
          <div>
            <label className="label block mb-1 text-right">הגבלות תזונה ואלרגיה</label>
            <p className="text-xs text-gray-400 text-right mb-2">ברמת האירוע בלבד, ללא שיוך לילד מסוים</p>
            <div className="flex flex-wrap gap-2 justify-end">
              {DIETARY_OPTIONS.map(o => {
                const isSelected = (draft.dietaryRestrictions || []).includes(o.value)
                return (
                  <button key={o.value} type="button"
                    onClick={() => toggleDietary(o.value)}
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                      isSelected
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                    )}>
                    ללא {o.label}
                  </button>
                )
              })}
            </div>
            <input
              value={draft.dietaryNote || ''}
              onChange={e => set('dietaryNote', e.target.value.slice(0, DIETARY_NOTE_MAX))}
              maxLength={DIETARY_NOTE_MAX}
              className="input w-full text-right mt-2"
              placeholder="הערה נוספת (למשל: נא להימנע מחטיפים ביתיים)"
            />
          </div>

          <div>
            <label className="label block mb-1 text-right">קהל יעד</label>
            <div className="flex flex-wrap gap-2">
              {TARGET_GROUPS.map(g => {
                const groups = draft.targetGroups || ['all']
                const isSelected = groups.includes(g.value)
                return (
                  <button key={g.value} type="button"
                    onClick={() => toggleGroup(g.value)}
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                      isSelected
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                    )}>
                    {g.label}
                  </button>
                )
              })}
            </div>
            {errors.targetGroups && <p className="text-xs text-red-500 mt-1 text-right">{errors.targetGroups}</p>}
          </div>

          {(draft.targetGroups || ['all']).includes('class') && (
            <ClassPicker
              classes={allClasses}
              selected={draft.classIds || []}
              onChange={(ids) => set('classIds', ids)}
              restricted={restricted}
            />
          )}

          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 dark:bg-gray-900">
            <input type="checkbox" id="required-toggle" checked={!!draft.required}
              onChange={e => set('required', e.target.checked)}
              className="w-4 h-4 accent-primary-600" />
            <label htmlFor="required-toggle" className="text-sm text-gray-700 cursor-pointer dark:text-gray-200">כולם מוזמנים (סמן כאירוע לכולם)</label>
          </div>

          {allCommittees.length > 0 && (
            <div>
              <label className="label block mb-1 text-right">ועדה מארגנת (אופציונלי)</label>
              <select
                value={draft.committeeId || ''}
                onChange={e => set('committeeId', e.target.value || null)}
                className="input w-full text-right"
              >
                <option value="">ללא ועדה</option>
                {allCommittees.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

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
                className="w-full border-2 border-dashed border-gray-200 hover:border-primary-300 rounded-xl py-6 flex flex-col items-center gap-2 text-gray-400 hover:text-primary-500 transition-colors dark:border-gray-700"
              >
                <ImagePlus size={22} />
                <span className="text-sm">הוסף תמונה</span>
              </button>
            )}
          </div>

        </div>

        <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={publishAck}
              onChange={e => { setPublishAck(e.target.checked); setErrors(er => ({ ...er, publishAck: '' })) }}
              className="w-4 h-4 mt-0.5 accent-primary-600 flex-shrink-0"
            />
            <span className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed text-right">
              ידוע לי שפרטי האירוע יעלו למערכת ויוצגו לחברי הקהילה בהתאם למפורט בתקנון ובמדיניות הפרטיות
            </span>
          </label>
          {errors.publishAck && <p className="text-xs text-red-500 text-right">{errors.publishAck}</p>}
          <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {saving ? 'שומר...' : 'שמור'}
          </button>
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm dark:border-gray-700 dark:hover:bg-gray-700/50">
            ביטול
          </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ---- Main page ----

export default function AdminEventsPage() {
  const location = useLocation()
  const { user, viewAs } = useAuth()
  const [tab, setTab] = useState('events')
  const [events, setEvents] = useState([])
  const [classes, setClasses] = useState([])
  const [committees, setCommittees] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [familyFilter, setFamilyFilter] = useState(['new_family', 'host_family'])
  const [activeClasses, setActiveClasses] = useState(null) // null = all (before classes load)

  const classAdminFor = user?.classAdminFor || []
  const isRestricted = classAdminFor.length > 0 && user?.role !== 'super_admin'
  const visibleClasses = isRestricted
    ? classes.filter(c => classAdminFor.includes(c.id))
    : classes

  const classColorMap = Object.fromEntries(classes.map(c => [c.id, c.color || '#1B3B70']))
  const allClassIds = classes.map(c => c.id)
  const effectiveClasses = activeClasses ?? allClassIds
  const calendarEvents = events.filter(ev => {
    if (familyFilter.length < 2) {
      const groups = ev.targetGroups || ['all']
      if (!groups.includes('all') && !groups.some(g => familyFilter.includes(g))) return false
    }
    if (effectiveClasses.length < allClassIds.length) {
      const eIds = ev.classIds || []
      if (eIds.length > 0 && !eIds.some(id => effectiveClasses.includes(id))) return false
    }
    return true
  })

  const newBlankEvent = () => ({
    ...blankEvent(),
    classIds: isRestricted ? visibleClasses.map(c => c.id) : [],
  })

  useEffect(() => {
    Promise.all([getEvents(), getClasses(), getCommittees()])
      .then(([evts, cls, cmts]) => {
        setEvents(evts)
        setClasses(cls)
        setCommittees(cmts)
        setActiveClasses(cls.map(c => c.id))
        if (location.state?.editEvent) setEditing(location.state.editEvent)
      })
      .catch(err => console.error('AdminEventsPage load failed', err))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (saved, newImageFile, shouldRemoveImage) => {
    setEditing(null)
    try {
      const isNewEvent = saved.id?.startsWith('event-')
      if (isNewEvent && user?.uid) saved.createdBy = user.uid
      let persisted = await saveEvent(saved)
      // The panel blocks saving a new event until the creator ticked the
      // publication acknowledgment — record that consent as evidence.
      if (isNewEvent && user?.uid) {
        logConsent(user.uid, 'event_publish', {
          label: 'אישור פרסום פרטי אירוע לחברי הקהילה בהתאם לתקנון',
          version: CONSENT_VERSION,
          context: saved.title || '',
        })
      }

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
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setEditing(newBlankEvent())}
          className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
        >
          <Plus size={16} />
          אירוע חדש
        </button>
        <div>
          <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 justify-end dark:text-primary-300">
            <span className="text-xl leading-none">📅</span>
            ניהול אירועים
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 text-right dark:text-gray-400">{events.length} אירועים</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit me-auto dark:bg-gray-800">
        {[{ id: 'events', label: 'אירועים' }, { id: 'calendar', label: 'לוח שנה' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-white text-primary-700 shadow-sm dark:bg-gray-700 dark:text-primary-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Calendar tab */}
      {tab === 'calendar' && (
        <>
          {/* Family-type cards */}
          <div className="flex gap-3 mb-4">
            {FAMILY_CARDS.map(({ value, label, color, bg }) => {
              const active = familyFilter.includes(value)
              return (
                <button
                  key={value}
                  onClick={() => setFamilyFilter(cur =>
                    cur.includes(value) ? cur.filter(t => t !== value) : [...cur, value]
                  )}
                  className={clsx(
                    'flex-1 rounded-2xl py-3 px-4 text-center font-semibold text-sm transition-all border-2',
                    active ? '' : 'bg-gray-50 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-600'
                  )}
                  style={active ? { backgroundColor: bg, borderColor: color, color } : {}}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Class filter chips — all active by default, click to deselect */}
          {classes.length > 0 && (
            <div className="flex gap-2 mb-4 flex-wrap items-center">
              <button
                onClick={() => setActiveClasses(allClassIds)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                  effectiveClasses.length === allClassIds.length
                    ? 'bg-gray-700 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                )}
              >
                כל הכיתות
              </button>
              {(isRestricted ? visibleClasses : classes).map(cls => {
                const active = effectiveClasses.includes(cls.id)
                const color = cls.color || '#1B3B70'
                return (
                  <button
                    key={cls.id}
                    onClick={() => setActiveClasses(cur => {
                      const current = cur ?? allClassIds
                      return current.includes(cls.id)
                        ? current.filter(id => id !== cls.id)
                        : [...current, cls.id]
                    })}
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5',
                      active ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                    )}
                    style={active ? { backgroundColor: color, border: `2px solid ${color}` } : {}}
                  >
                    {!active && (
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    )}
                    {cls.name}
                  </button>
                )
              })}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 size={32} className="animate-spin text-primary-400" />
            </div>
          ) : (
            <CalendarGrid
              events={calendarEvents}
              classColorMap={classColorMap}
              onEventClick={(event) => setEditing(event)}
            />
          )}
        </>
      )}

      {/* Loading spinner */}
      {tab === 'events' && loading && (
        <div className="flex justify-center items-center py-16">
          <Loader2 size={32} className="animate-spin text-primary-400" />
        </div>
      )}

      {/* Events list */}
      {tab === 'events' && !loading && (
        <div className="space-y-3">
          {sorted.map(event => {
            const typeConf = TYPE_COLOR[event.type]
            const typeLabel = TYPE_OPTIONS.find(o => o.value === event.type)?.label || event.type

            return (
              <div key={event.id}
                className="card p-4 cursor-pointer hover:bg-gray-50 transition-colors dark:hover:bg-gray-700/50"
                onClick={() => { setEditing(event); setConfirmDelete(null) }}>
                <div className="flex items-start gap-3">
                  {/* Date badge */}
                  <div className="w-12 h-12 rounded-xl bg-primary-50 flex flex-col items-center justify-center flex-shrink-0 dark:bg-primary-900/30">
                    {event.date ? (
                      <>
                        <span className="text-xs text-primary-400 font-medium leading-none">
                          {new Date(event.date).toLocaleDateString('he-IL', { month: 'short' })}
                        </span>
                        <span className="text-lg font-black text-primary-700 leading-tight dark:text-primary-300">
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
                      <span className="font-semibold text-gray-800 text-sm dark:text-gray-100">{event.title}</span>
                      <span className={typeConf || 'badge'}>{typeLabel}</span>
                      {event.required && (
                        <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-medium dark:bg-blue-900/20 dark:text-blue-400">כולם מוזמנים</span>
                      )}
                    </div>
                    {event.description && (
                      <p className="text-xs text-gray-500 mb-1 line-clamp-1 dark:text-gray-400">{event.description}</p>
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
                      className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors dark:hover:bg-primary-900/30"
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
                          className="text-xs text-gray-500 hover:text-gray-700 px-1.5 py-1 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                        >
                          ביטול
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(event.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors dark:hover:bg-red-900/20"
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

      {tab === 'events' && !loading && events.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">אין אירועים מתוכננים</p>
          <button onClick={() => setEditing(newBlankEvent())} className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline">
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
          allClasses={visibleClasses}
          allCommittees={committees}
          restricted={isRestricted}
        />
      )}
    </div>
  )
}
