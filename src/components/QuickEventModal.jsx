import { useState, useRef } from 'react'
import { X, Plus, Loader2, Calendar, ImagePlus, Check } from 'lucide-react'
import clsx from 'clsx'
import { createCommitteeEvent, createGroupEvent, saveEvent, uploadEventImage, logConsent } from '../lib/db'
import { CONSENT_VERSION } from '../lib/consent'
import { classLabel, isKindergarten } from '../lib/grades'
import { EVENT_TYPE_OPTIONS } from '../lib/eventFields'
import { DIETARY_OPTIONS, DIETARY_NOTE_MAX } from '../lib/dietary'
import EventAudienceFields from './EventAudienceFields'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import ShareEventButtons from './ui/ShareEventButtons'

// Create-an-event straight from the calendar — the form a phone gets, and it
// carries every field the admin panel has (type, dietary warnings, "יפורסם
// בהמשך" markers, "כולם מוזמנים", image, and the class picker), so an event
// opened on the way to pickup is not a poorer event than one opened at a desk.
//
// Same permission model as creating from within the entity: only someone
// wearing a "hat" (committee member / group member / class admin / admin) gets
// here, and the event MUST be attributed to one of their hats ("אבא ואמא") —
// there is no ownerless event.
//
// hats: [{ type: 'committee'|'group'|'class'|'admin', id, name, grade? }]
// The hat determines the create path + audience options:
//   committee/group → member-create with audience selector (members-only default)
//   class           → class-scoped event, one class or several (rules restrict
//                     class admins to their own classes)
//   admin           → school-wide event with the full audience selector
const HAT_TYPE_LABEL = { committee: 'ועדה', group: 'קבוצה', class: 'כיתה' }

const blankForm = () => ({
  title: '', date: '', time: '', location: '', description: '',
  type: 'social', dietaryRestrictions: [], dietaryNote: '', tbdFields: [], isRequired: false,
})

// A committee/group event is members-only until its creator says otherwise; an
// event opened in the school's name starts community-wide (there is no
// "members" of a school).
const defaultAudience = (h) => ({ targetGroups: [h?.type === 'admin' ? 'all' : 'members'], classIds: [] })

export default function QuickEventModal({
  hats, classes = [], uid, isAdmin = false, classAdminIds = [], onClose, onCreated,
}) {
  // Preselect when there's exactly one hat — no choice to make
  const initialHat = hats.length === 1 ? hats[0] : null
  const [hat, setHat] = useState(initialHat)
  const [form, setForm] = useState(blankForm)
  const [audience, setAudience] = useState(() => defaultAudience(initialHat))
  // Class-hat events may address several classes at once (כיתות א' 1 + א' 2)
  const [classIds, setClassIds] = useState(initialHat?.type === 'class' ? [initialHat.id] : [])
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [publishAck, setPublishAck] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Set once the event document exists — a retry then only re-uploads the image
  // instead of creating the event a second time.
  const [savedId, setSavedId] = useState(null)
  // The event as saved — the invitation exists now, and this is the moment
  // someone actually wants to send it. Closing without offering that meant
  // hunting for the event in the calendar to share it.
  const [createdEvent, setCreatedEvent] = useState(null)
  const fileInputRef = useRef(null)

  // Closing after the event was already written still refreshes the list —
  // the event exists even if its image upload failed.
  const handleClose = () => {
    if (savedId) onCreated?.()
    onClose()
  }

  useEscapeToClose(handleClose, !saving)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const classHats = hats.filter(h => h.type === 'class')
  // Storage + Firestore both gate event images on admin / class-admin, so the
  // field only appears where the upload can actually succeed.
  const canAttachImage = isAdmin || (hat?.type === 'class' && classAdminIds.length > 0)

  const pickHat = (h) => {
    setHat(h)
    setError('')
    // Fresh audience default per entity type
    setAudience(defaultAudience(h))
    setClassIds(h.type === 'class' ? [h.id] : [])
  }

  const toggleClass = (id) =>
    setClassIds(ids => ids.includes(id) ? ids.filter(c => c !== id) : [...ids, id])

  const toggleTbd = (field) =>
    setForm(f => ({
      ...f,
      tbdFields: (f.tbdFields || []).includes(field)
        ? f.tbdFields.filter(x => x !== field)
        : [...(f.tbdFields || []), field],
    }))

  const toggleDietary = (value) =>
    setForm(f => ({
      ...f,
      dietaryRestrictions: (f.dietaryRestrictions || []).includes(value)
        ? f.dietaryRestrictions.filter(t => t !== value)
        : [...(f.dietaryRestrictions || []), value],
    }))

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleImageRemove = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const baseFields = () => ({
    title: form.title.trim(),
    description: form.description.trim(),
    date: form.date,
    time: form.time || '',
    location: form.location.trim(),
    type: form.type,
    dietaryRestrictions: form.dietaryRestrictions,
    dietaryNote: form.dietaryNote.trim(),
    tbdFields: form.tbdFields,
    isRequired: form.isRequired,
  })

  const createEvent = async () => {
    if (hat.type === 'committee') return createCommitteeEvent(hat.id, uid, { ...baseFields(), ...audience })
    if (hat.type === 'group')     return createGroupEvent(hat.id, uid, { ...baseFields(), ...audience })
    // admin → school-wide with the chosen audience; class → the picked classes
    const saved = await saveEvent({
      id: 'event-' + Date.now(),
      ...baseFields(),
      ...(hat.type === 'admin' ? audience : { targetGroups: ['class'], classIds }),
      // written under both keys — see isEventForEveryone in lib/eventFields.js
      required: form.isRequired,
      createdBy: uid,
      attendeeUids: [],
    })
    return saved.id
  }

  const handleCreate = async () => {
    if (!hat) { setError('יש לבחור מטעם מי נפתח האירוע — לא ניתן לפתוח אירוע ללא שיוך'); return }
    if (!form.title.trim() || !form.date) { setError('שם האירוע ותאריך הם שדות חובה'); return }
    if (hat.type === 'class' && classIds.length === 0) { setError('יש לבחור לפחות כיתה אחת'); return }
    if (!publishAck) { setError('יש לאשר את פרסום פרטי האירוע כתנאי לשמירה'); return }
    setSaving(true)
    setError('')
    try {
      let eventId = savedId
      if (!eventId) {
        eventId = await createEvent()
        setSavedId(eventId)
        logConsent(uid, 'event_publish', {
          label: 'אישור פרסום פרטי אירוע לחברי הקהילה בהתאם לתקנון',
          version: CONSENT_VERSION,
          context: form.title.trim(),
        })
      }
      if (imageFile && eventId) {
        try {
          const { url, path } = await uploadEventImage(eventId, imageFile)
          await saveEvent({ id: eventId, imageUrl: url, imagePath: path })
        } catch (e) {
          console.error('event image upload failed', e)
          setError('האירוע נשמר, אך העלאת התמונה נכשלה — אפשר לנסות שוב או לסגור')
          setSaving(false)
          return
        }
      }
      onCreated?.()
      setCreatedEvent({ id: eventId, ...baseFields(), ...(hat.type === 'class' ? { classIds } : audience) })
      setSaving(false)
    } catch (e) {
      console.error('quick event create failed', e)
      setError('שמירת האירוע נכשלה — נסה שוב')
      setSaving(false)
    }
  }

  const entityLabel = hat?.type === 'committee' ? 'הוועדה' : hat?.type === 'group' ? 'הקבוצה' : ''
  const hatLabel = (h) => h.type === 'admin'
    ? h.name
    : `${h.type === 'class' && (isKindergarten(h.name) || isKindergarten(h.grade)) ? 'גן' : HAT_TYPE_LABEL[h.type]} · ${h.name}`

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
      <div role="dialog" aria-modal="true" aria-label="יצירת אירוע"
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">

        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <button onClick={handleClose} disabled={saving} aria-label="סגור"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
            <X size={18} />
          </button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            אירוע חדש
            <Calendar size={16} className="text-primary-600 dark:text-primary-400" />
          </h2>
        </div>

        {createdEvent ? (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                <Check size={22} className="text-green-600" />
              </div>
              <p className="font-bold text-gray-800 dark:text-gray-100">האירוע נוצר</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">{createdEvent.title}</p>
              <ShareEventButtons event={createdEvent} />
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={onClose} className="w-full btn-primary py-2.5">סיום</button>
            </div>
          </>
        ) : (
        <>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Mandatory attribution — the event's "parents" */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-2 text-right">
              מטעם מי נפתח האירוע? <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5 justify-end">
              {hats.map(h => (
                <button
                  key={`${h.type}-${h.id}`}
                  type="button"
                  onClick={() => pickHat(h)}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    hat?.id === h.id && hat?.type === h.type
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                  )}
                >
                  {hatLabel(h)}
                </button>
              ))}
            </div>
          </div>

          <input value={form.title} onChange={set('title')} placeholder="שם האירוע *" className="w-full input text-sm text-right" />

          <div className="flex gap-2">
            <input value={form.date} onChange={set('date')} type="date" className="flex-1 input text-sm" dir="ltr" />
            <input value={form.time} onChange={set('time')} type="time" className="w-28 input text-sm" dir="ltr"
              disabled={form.tbdFields.includes('time')} />
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer justify-end -mt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">שעה תפורסם בהמשך</span>
            <input type="checkbox" checked={form.tbdFields.includes('time')}
              onChange={() => toggleTbd('time')} className="w-3.5 h-3.5 accent-primary-600" />
          </label>

          <input value={form.location} onChange={set('location')} placeholder="מיקום (אופציונלי)"
            className="w-full input text-sm text-right" disabled={form.tbdFields.includes('location')} />
          <label className="flex items-center gap-1.5 cursor-pointer justify-end -mt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">מיקום יפורסם בהמשך</span>
            <input type="checkbox" checked={form.tbdFields.includes('location')}
              onChange={() => toggleTbd('location')} className="w-3.5 h-3.5 accent-primary-600" />
          </label>

          <textarea value={form.description} onChange={set('description')} placeholder="תיאור (אופציונלי)" rows={2}
            className="w-full input text-sm text-right resize-none" />

          {/* Event type */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1 text-right">סוג אירוע</label>
            <select value={form.type} onChange={set('type')} className="w-full input text-sm text-right">
              {EVENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Dietary restrictions — event-level and anonymous (see lib/dietary.js) */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1.5 text-right">הגבלות תזונה ואלרגיה</label>
            <div className="flex flex-wrap gap-1.5 justify-end">
              {DIETARY_OPTIONS.map(o => {
                const on = form.dietaryRestrictions.includes(o.value)
                return (
                  <button key={o.value} type="button" onClick={() => toggleDietary(o.value)}
                    className={clsx('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                      on
                        ? 'bg-accent-500 text-white border-accent-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-accent-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600')}>
                    ללא {o.label}
                  </button>
                )
              })}
            </div>
            <input value={form.dietaryNote} onChange={set('dietaryNote')} maxLength={DIETARY_NOTE_MAX}
              placeholder="הערה נוספת (למשל: נא להימנע מחטיפים ביתיים)"
              className="w-full input text-sm text-right mt-2" />
          </div>

          {/* Audience — committee/group/admin choose; a class event names its classes */}
          {hat && (hat.type === 'committee' || hat.type === 'group' || hat.type === 'admin') && (
            <EventAudienceFields value={audience} onChange={setAudience} classes={classes} entityLabel={entityLabel} />
          )}
          {hat?.type === 'class' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block text-right">
                כיתות משתתפות <span className="text-red-400">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {classHats.map(c => {
                  const on = classIds.includes(c.id)
                  return (
                    <button key={c.id} type="button" onClick={() => toggleClass(c.id)}
                      className={clsx('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                        on
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600')}>
                      {c.name}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 text-right">
                {classIds.length > 1
                  ? `האירוע יוצג לחברי ${classIds.length} הכיתות שנבחרו`
                  : `האירוע יוצג לחברי ${classLabel(hat.name, hat.grade)}`}
              </p>
            </div>
          )}

          {/* Everyone's invited */}
          <label className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-xl px-3 py-2.5 cursor-pointer">
            <input type="checkbox" checked={form.isRequired}
              onChange={e => setForm(f => ({ ...f, isRequired: e.target.checked }))}
              className="w-4 h-4 accent-primary-600" />
            <span className="text-sm text-gray-700 dark:text-gray-200">כולם מוזמנים (סמן כאירוע לכולם)</span>
          </label>

          {/* Image — admins / class admins only (storage.rules gates the upload) */}
          {canAttachImage && (
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1.5 text-right">תמונה לאירוע</label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden">
                  <img src={imagePreview} alt="" className="w-full h-32 object-cover" />
                  <button type="button" onClick={handleImageRemove}
                    className="absolute top-2 left-2 w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 hover:border-primary-300 rounded-xl py-4 flex flex-col items-center gap-1.5 text-gray-400 hover:text-primary-500 transition-colors dark:border-gray-700">
                  <ImagePlus size={20} />
                  <span className="text-sm">הוסף תמונה</span>
                </button>
              )}
            </div>
          )}

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={publishAck} onChange={e => { setPublishAck(e.target.checked); setError('') }}
              className="w-3.5 h-3.5 mt-0.5 accent-primary-600 flex-shrink-0" />
            <span className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed text-right">
              ידוע לי שפרטי האירוע יעלו למערכת ויוצגו בהתאם למפורט בתקנון
            </span>
          </label>

          {error && <p className="text-xs text-red-500 text-right">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-2">
          <button onClick={handleCreate}
            disabled={saving || !hat || !form.title.trim() || !form.date || !publishAck}
            className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {saving ? 'שומר...' : savedId ? 'נסה להעלות שוב' : 'צור אירוע'}
          </button>
          <button onClick={handleClose} disabled={saving}
            className="px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm dark:border-gray-700 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-300">
            {savedId ? 'סגור' : 'ביטול'}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  )
}
