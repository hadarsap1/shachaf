import { useState } from 'react'
import { X, Plus, Loader2, Calendar } from 'lucide-react'
import clsx from 'clsx'
import { createCommitteeEvent, createGroupEvent, saveEvent, logConsent } from '../lib/db'
import { CONSENT_VERSION } from '../lib/consent'
import { classLabel } from '../lib/grades'
import EventAudienceFields from './EventAudienceFields'
import { useEscapeToClose } from '../hooks/useEscapeToClose'

// Create-an-event straight from the calendar — same permission model as
// creating from within the entity: only someone wearing a "hat" (committee
// member / group member / class admin) gets here, and the event MUST be
// attributed to one of their hats ("אבא ואמא") — there is no ownerless event.
//
// hats: [{ type: 'committee'|'group'|'class', id, name, color? }]
// The hat determines the create path + audience options:
//   committee/group → member-create with audience selector (members-only default)
//   class           → class-scoped event (rules restrict class admins to their class)
const HAT_TYPE_LABEL = { committee: 'ועדה', group: 'קבוצה', class: 'כיתה' }

export default function QuickEventModal({ hats, classes = [], uid, onClose, onCreated }) {
  // Preselect when there's exactly one hat — no choice to make
  const [hat, setHat] = useState(hats.length === 1 ? hats[0] : null)
  const [form, setForm] = useState({ title: '', date: '', time: '', location: '', description: '' })
  const [audience, setAudience] = useState({ targetGroups: ['members'], classIds: [] })
  const [publishAck, setPublishAck] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEscapeToClose(onClose, !saving)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const pickHat = (h) => {
    setHat(h)
    setError('')
    // Fresh audience default per entity type
    setAudience({ targetGroups: ['members'], classIds: [] })
  }

  const handleCreate = async () => {
    if (!hat) { setError('יש לבחור מטעם מי נפתח האירוע — לא ניתן לפתוח אירוע ללא שיוך'); return }
    if (!form.title.trim() || !form.date) { setError('שם האירוע ותאריך הם שדות חובה'); return }
    if (!publishAck) { setError('יש לאשר את פרסום פרטי האירוע כתנאי לשמירה'); return }
    setSaving(true)
    setError('')
    try {
      if (hat.type === 'committee') {
        await createCommitteeEvent(hat.id, uid, { ...form, ...audience })
      } else if (hat.type === 'group') {
        await createGroupEvent(hat.id, uid, { ...form, ...audience })
      } else {
        // class hat — scoped to that class (enforced by Firestore rules for class admins)
        await saveEvent({
          id: 'event-' + Date.now(),
          title: form.title.trim(),
          description: form.description.trim(),
          date: form.date,
          time: form.time || '',
          location: form.location.trim(),
          type: 'social',
          targetGroups: ['class'],
          classIds: [hat.id],
          createdBy: uid,
          attendeeUids: [],
        })
      }
      logConsent(uid, 'event_publish', {
        label: 'אישור פרסום פרטי אירוע לחברי הקהילה בהתאם לתקנון',
        version: CONSENT_VERSION,
        context: form.title.trim(),
      })
      onCreated?.()
      onClose()
    } catch (e) {
      console.error('quick event create failed', e)
      setError('שמירת האירוע נכשלה — נסה שוב')
      setSaving(false)
    }
  }

  const entityLabel = hat?.type === 'committee' ? 'הוועדה' : hat?.type === 'group' ? 'הקבוצה' : ''

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
      <div role="dialog" aria-modal="true" aria-label="יצירת אירוע"
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">

        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <button onClick={onClose} disabled={saving} aria-label="סגור"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
            <X size={18} />
          </button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            אירוע חדש
            <Calendar size={16} className="text-primary-600 dark:text-primary-400" />
          </h2>
        </div>

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
                  {HAT_TYPE_LABEL[h.type]} · {h.name}
                </button>
              ))}
            </div>
          </div>

          <input value={form.title} onChange={set('title')} placeholder="שם האירוע *" className="w-full input text-sm text-right" />
          <div className="flex gap-2">
            <input value={form.date} onChange={set('date')} type="date" className="flex-1 input text-sm" />
            <input value={form.time} onChange={set('time')} type="time" className="w-28 input text-sm" />
          </div>
          <input value={form.location} onChange={set('location')} placeholder="מיקום (אופציונלי)" className="w-full input text-sm text-right" />
          <textarea value={form.description} onChange={set('description')} placeholder="תיאור (אופציונלי)" rows={2}
            className="w-full input text-sm text-right resize-none" />

          {/* Audience — committee/group choose; class events go to the class */}
          {hat && (hat.type === 'committee' || hat.type === 'group') && (
            <EventAudienceFields value={audience} onChange={setAudience} classes={classes} entityLabel={entityLabel} />
          )}
          {hat?.type === 'class' && (
            <p className="text-xs text-gray-400 text-right">האירוע יוצג לחברי {classLabel(hat.name)}</p>
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
            {saving ? 'שומר...' : 'צור אירוע'}
          </button>
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm dark:border-gray-700 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-300">
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
