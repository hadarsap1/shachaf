import { useState, useEffect } from 'react'
import {
  getMealTrains, getMealTrainPrivate, saveMealTrain, deleteMealTrain,
  claimMealSlot, releaseMealSlot, getCommittees, logConsent,
} from '../../lib/db'
import { CONSENT_VERSION } from '../../lib/consent'
import {
  SLOT_TYPES, buildSlots, groupByDate, addDay, removeDay, toggleDayType,
  formatSlotDate, canSeeAddress, slotStats, isMealTrainCommittee,
} from '../../lib/mealTrain'
import { useAuth } from '../../context/AuthContext'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import { toast } from '../../components/ui/Toaster'
import {
  Baby, Plus, X, Loader2, MapPin, Lock, Phone, Utensils, Cake, Check, Trash2,
} from 'lucide-react'
import clsx from 'clsx'

const TYPE_ICON = { meal: Utensils, treat: Cake }

// ── Address block — the sensitive part ────────────────────────────────────────
// The address + building code live in a private subdocument that Firestore only
// serves to people who claimed a slot (or the coordinator/admins). Until then
// we don't even ask for it, and we say plainly why.
function AddressBlock({ train, uid, isAdmin }) {
  const [details, setDetails] = useState(null)
  const allowed = canSeeAddress(train, uid, isAdmin)

  useEffect(() => {
    if (!allowed) { setDetails(null); return }
    let active = true
    getMealTrainPrivate(train.id).then(d => { if (active) setDetails(d) })
    return () => { active = false }
  }, [train.id, allowed])

  if (!allowed) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-gray-50 dark:bg-gray-900 px-3 py-2.5">
        <Lock size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500 dark:text-gray-400 text-right leading-relaxed">
          הכתובת וקוד הכניסה יוצגו לאחר שתשריינו תאריך — כדי לשמור על פרטיות המשפחה
        </p>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2 rounded-xl bg-primary-50 dark:bg-primary-900/20 px-3 py-2.5">
      <MapPin size={13} className="text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
      <div className="text-xs text-gray-700 dark:text-gray-200 text-right leading-relaxed">
        {details ? (
          <>
            <div>{details.address}{details.city ? `, ${details.city}` : ''}</div>
            {details.buildingCode && <div className="text-gray-500 dark:text-gray-400">קוד לבניין: {details.buildingCode}</div>}
          </>
        ) : <span className="text-gray-400">טוען כתובת…</span>}
      </div>
    </div>
  )
}

// ── Signup grid ───────────────────────────────────────────────────────────────
function SlotGrid({ train, uid, userName, onChanged }) {
  const [busy, setBusy] = useState('')
  const groups = groupByDate(train.slots)

  const claim = async (slot) => {
    setBusy(slot.id)
    try {
      await claimMealSlot(train.id, slot.id, uid, userName)
      logConsent(uid, 'meal_train_signup', {
        label: 'שריון תאריך בסיר לידה — שמי ופרטי הקשר יוצגו למשפחה ולמשריינים',
        version: CONSENT_VERSION,
        context: `${train.familyName} · ${formatSlotDate(slot.date)}`,
      })
      await onChanged()
    } catch (e) {
      console.error('claim failed', e)
      toast('השריון נכשל — נסו שוב', 'error')
    } finally { setBusy('') }
  }

  const release = async (slot) => {
    setBusy(slot.id)
    try {
      await releaseMealSlot(train.id, slot.id, uid)
      await onChanged()
    } catch (e) {
      console.error('release failed', e)
      toast('הביטול נכשל — נסו שוב', 'error')
    } finally { setBusy('') }
  }

  if (!groups.length) return <p className="text-xs text-gray-400 text-center py-3">לא הוגדרו תאריכים</p>

  return (
    <div className="space-y-2">
      {groups.map(({ date, slots }) => (
        <div key={date} className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 text-right">
            {formatSlotDate(date)}
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {slots.map(slot => {
              const Icon = TYPE_ICON[slot.type] || Utensils
              const type = SLOT_TYPES.find(t => t.value === slot.type)
              const mine = slot.byUid === uid
              const taken = !!slot.byUid
              return (
                <div key={slot.id} className="flex items-center gap-2 px-3 py-2">
                  <Icon size={13} className="text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-20 flex-shrink-0 text-right">{type?.label}</span>
                  <div className="flex-1 min-w-0 text-right">
                    {taken ? (
                      <span className={clsx('text-xs font-medium truncate',
                        mine ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-200')}>
                        {mine ? 'שוריין על ידך' : slot.byName || 'שוריין'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">{type?.hint}</span>
                    )}
                  </div>
                  {busy === slot.id ? (
                    <Loader2 size={13} className="animate-spin text-gray-400 flex-shrink-0" />
                  ) : mine ? (
                    <button onClick={() => release(slot)}
                      className="text-[11px] text-gray-500 hover:text-red-600 border border-gray-200 dark:border-gray-600 rounded-full px-2 py-0.5 flex-shrink-0">
                      ביטול
                    </button>
                  ) : !taken ? (
                    <button onClick={() => claim(slot)}
                      className="text-[11px] font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-full px-2.5 py-1 flex-shrink-0">
                      אני לוקח/ת
                    </button>
                  ) : (
                    <Check size={13} className="text-secondary-500 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Create panel ──────────────────────────────────────────────────────────────
function CreatePanel({ hats, uid, userName, onClose, onCreated }) {
  const [form, setForm] = useState({
    familyName: '', babyName: '', parents: '', siblings: '',
    preferences: '', concept: 'מכינים מכל הלב, מתובל בהמון אהבה. להשתדל בכלים שלא צריך להחזיר.',
    delivery: 'אורזים ומשאירים מחוץ לדלת / מסירה אישית עם חיבוק (לאחר תיאום)',
    contactName: '', contactPhone: '',
    address: '', city: '', buildingCode: '',
  })
  const [committeeId, setCommitteeId] = useState(hats.length === 1 ? hats[0].id : '')
  const [days, setDays] = useState([])
  const [newDate, setNewDate] = useState('')
  const [publishAck, setPublishAck] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEscapeToClose(onClose, !saving)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleAddDay = () => {
    if (!newDate) return
    setDays(d => addDay(d, newDate))
    setNewDate('')
    setError('')
  }

  const handleSave = async () => {
    if (!form.familyName.trim()) { setError('שם המשפחה הוא שדה חובה'); return }
    if (!days.length) { setError('הוסיפו לפחות יום אחד לסיר'); return }
    if (!committeeId && hats.length) { setError('בחרו מטעם איזו ועדה נפתח הסיר'); return }
    if (!publishAck) { setError('יש לאשר את פרסום פרטי הסיר בהתאם לתקנון'); return }
    setSaving(true)
    setError('')
    try {
      await saveMealTrain(
        {
          id: 'train-' + Date.now(),
          familyName: form.familyName.trim(),
          babyName: form.babyName.trim(),
          parents: form.parents.trim(),
          siblings: form.siblings.trim(),
          preferences: form.preferences.trim(),
          concept: form.concept.trim(),
          delivery: form.delivery.trim(),
          contactName: form.contactName.trim(),
          contactPhone: form.contactPhone.trim(),
          committeeId: committeeId || '',
          createdBy: uid,
          createdByName: userName || '',
          claimerUids: [],
          slots: buildSlots(days),
          status: 'active',
        },
        // private subdocument — only slot claimers / coordinator / admins may read
        { address: form.address.trim(), city: form.city.trim(), buildingCode: form.buildingCode.trim() },
      )
      logConsent(uid, 'meal_train_open', {
        label: 'אישור פתיחת סיר לידה — פרטי המשפחה יוצגו לחברי הקהילה וכתובת המסירה למשריינים בלבד',
        version: CONSENT_VERSION,
        context: form.familyName.trim(),
      })
      await onCreated()
      onClose()
    } catch (e) {
      console.error('meal train create failed', e)
      setError('השמירה נכשלה — נסו שוב')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="סיר לידה חדש"
        className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right dark:bg-gray-800" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100">סיר לידה חדש</h2>
          <div className="w-8" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {hats.length > 0 && (
            <div>
              <label className="label">מטעם</label>
              <select value={committeeId} onChange={e => setCommitteeId(e.target.value)} className="input w-full text-sm">
                <option value="">— בחרו ועדה —</option>
                {hats.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
          )}

          <input value={form.familyName} onChange={set('familyName')} placeholder="שם המשפחה *" className="input w-full text-sm text-right" />
          <div className="flex gap-2">
            <input value={form.babyName} onChange={set('babyName')} placeholder="שם התינוק/ת" className="input flex-1 text-sm text-right" />
            <input value={form.parents} onChange={set('parents')} placeholder="שמות ההורים" className="input flex-1 text-sm text-right" />
          </div>
          <input value={form.siblings} onChange={set('siblings')} placeholder="אחים/אחיות (אופציונלי)" className="input w-full text-sm text-right" />

          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
            <p className="text-[11px] text-amber-800 dark:text-amber-200 text-right leading-relaxed">
              🔒 הכתובת וקוד הכניסה נשמרים בנפרד ונחשפים רק למי שמשריין תאריך — לא לכלל הקהילה
            </p>
            <input value={form.address} onChange={set('address')} placeholder="רחוב ומספר, קומה, דירה" className="input w-full text-sm text-right" />
            <div className="flex gap-2">
              <input value={form.city} onChange={set('city')} placeholder="עיר" className="input flex-1 text-sm text-right" />
              <input value={form.buildingCode} onChange={set('buildingCode')} placeholder="קוד לבניין" className="input flex-1 text-sm text-right" />
            </div>
          </div>

          <textarea value={form.preferences} onChange={set('preferences')} rows={2}
            placeholder="העדפות והערות (למשל: צמחוני ופשוט)" className="input w-full text-sm text-right resize-none" />
          <textarea value={form.concept} onChange={set('concept')} rows={2}
            placeholder="הקונספט" className="input w-full text-sm text-right resize-none" />
          <textarea value={form.delivery} onChange={set('delivery')} rows={2}
            placeholder="איך מוסרים" className="input w-full text-sm text-right resize-none" />
          <div className="flex gap-2">
            <input value={form.contactName} onChange={set('contactName')} placeholder="איש קשר לתיאום" className="input flex-1 text-sm text-right" />
            <input value={form.contactPhone} onChange={set('contactPhone')} placeholder="טלפון" dir="ltr" className="input flex-1 text-sm" />
          </div>

          {/* Days of the rota — one row per day, with the two signup options
              the sheet had: a meal and a sweet treat. */}
          <div className="pt-1">
            <label className="label">ימי הבישול</label>
            <div className="flex gap-2">
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                aria-label="תאריך להוספה" className="input flex-1 text-sm" />
              <button type="button" onClick={handleAddDay} disabled={!newDate}
                className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1 disabled:opacity-40">
                <Plus size={14} />הוסף יום
              </button>
            </div>

            {days.length === 0 ? (
              <p className="text-xs text-gray-400 mt-2 text-right">
                הוסיפו את הימים שבהם הקהילה מבשלת — לכל יום נפתחות משבצת ארוחה ומשבצת פינוק מתוק
              </p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {days.map(day => (
                  <div key={day.date}
                    className="flex items-center gap-2 rounded-xl border border-gray-100 dark:border-gray-700 px-2.5 py-2">
                    <button type="button" onClick={() => setDays(d => removeDay(d, day.date))}
                      aria-label={`הסר את ${formatSlotDate(day.date)}`}
                      className="text-gray-300 hover:text-red-500 flex-shrink-0">
                      <X size={14} />
                    </button>
                    <div className="flex gap-1.5 flex-1 justify-start">
                      {SLOT_TYPES.map(t => {
                        const on = day.types.includes(t.value)
                        return (
                          <button key={t.value} type="button"
                            onClick={() => setDays(d => toggleDayType(d, day.date, t.value))}
                            aria-pressed={on}
                            className={clsx('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                              on ? 'bg-primary-600 text-white border-primary-600'
                                 : 'bg-white text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600')}>
                            {t.label}
                          </button>
                        )
                      })}
                    </div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 flex-shrink-0">
                      {formatSlotDate(day.date)}
                    </span>
                  </div>
                ))}
                <p className="text-xs text-gray-400 text-right pt-0.5">
                  {days.length} ימים · {buildSlots(days).length} משבצות לשריון
                </p>
              </div>
            )}
          </div>

          <label className="flex items-start gap-2 cursor-pointer pt-1">
            <input type="checkbox" checked={publishAck} onChange={e => { setPublishAck(e.target.checked); setError('') }}
              className="w-3.5 h-3.5 mt-0.5 accent-primary-600 flex-shrink-0" />
            <span className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed text-right">
              קיבלתי את הסכמת המשפחה, וידוע לי שפרטי הסיר יוצגו לחברי הקהילה
              וכתובת המסירה וקוד הכניסה יוצגו רק למי שמשריין תאריך — בהתאם לתקנון
            </span>
          </label>

          {error && <p className="text-xs text-red-500 text-right">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={handleSave} disabled={saving || !publishAck}
            className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            פתח סיר לידה
          </button>
        </div>
      </div>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MealTrainsPage() {
  const { user, isAdmin } = useAuth()
  const [trains, setTrains] = useState(null)
  const [hats, setHats] = useState([])
  const [showCreate, setShowCreate] = useState(false)

  const load = async () => {
    try { setTrains(await getMealTrains()) } catch { setTrains([]) }
  }

  useEffect(() => {
    load()
    // Opening a meal train is reserved for the community-support committee —
    // only those committees of the user's count as a "hat" here.
    getCommittees()
      .then(cs => setHats(cs
        .filter(c => c.status !== 'pending'
          && (c.memberUids || []).includes(user?.uid)
          && isMealTrainCommittee(c))
        .map(c => ({ id: c.id, name: c.name }))))
      .catch(() => {})
  }, [user?.uid])

  const canCreate = isAdmin || hats.length > 0
  const active = (trains || []).filter(t => t.status !== 'closed')

  const handleDelete = async (train) => {
    if (!window.confirm(`למחוק את סיר הלידה של ${train.familyName}?`)) return
    try { await deleteMealTrain(train.id); await load(); toast('סיר הלידה נמחק') }
    catch { toast('המחיקה נכשלה', 'error') }
  }

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-5 flex items-start justify-between gap-3">
        {canCreate && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors flex-shrink-0">
            <Plus size={15} />
            סיר לידה חדש
          </button>
        )}
        <div className="text-right">
          <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 justify-end dark:text-primary-300">
            סירי לידה
            <span className="text-2xl leading-none">🍲</span>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">מפנקים משפחות טריות בארוחה חמה</p>
        </div>
      </div>

      {trains === null ? (
        <div className="flex justify-center py-16"><Loader2 size={30} className="animate-spin text-primary-400" /></div>
      ) : active.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Baby size={44} className="mx-auto mb-4 opacity-25" />
          <p className="font-semibold text-gray-500 dark:text-gray-400">אין סירי לידה פעילים כרגע</p>
          <p className="text-sm mt-1">
            כשמשפחה בקהילה יולדת, ועדת התמיכה או הנהלת הקהילה פותחות כאן סיר —
            וכולם מוזמנים לשריין תאריך
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.map(train => {
            const stats = slotStats(train.slots)
            const mine = isAdmin || train.createdBy === user?.uid
            return (
              <div key={train.id} className="card p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  {mine && (
                    <button onClick={() => handleDelete(train)}
                      className="text-gray-300 hover:text-red-500 flex-shrink-0" title="מחק">
                      <Trash2 size={14} />
                    </button>
                  )}
                  <div className="text-right flex-1 min-w-0">
                    <h2 className="font-bold text-gray-800 dark:text-gray-100">
                      {train.familyName}
                      {train.babyName && <span className="font-normal text-gray-500 dark:text-gray-400"> · ברוך/ה הבא/ה {train.babyName} 👶</span>}
                    </h2>
                    {(train.parents || train.siblings) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {[train.parents, train.siblings].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="text-xs text-secondary-600 dark:text-secondary-400 mt-1">
                      {stats.open > 0 ? `${stats.open} משבצות פנויות מתוך ${stats.total}` : 'כל המשבצות שוריינו 🎉'}
                    </p>
                  </div>
                </div>

                {train.preferences && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 text-right leading-relaxed">
                    <span className="font-semibold">העדפות: </span>{train.preferences}
                  </p>
                )}
                {train.concept && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-right leading-relaxed">{train.concept}</p>
                )}
                {train.delivery && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-right leading-relaxed">{train.delivery}</p>
                )}

                <AddressBlock train={train} uid={user?.uid} isAdmin={isAdmin} />

                {train.contactPhone && (
                  <a href={`https://wa.me/972${train.contactPhone.replace(/\D/g, '').replace(/^0/, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 justify-end text-xs text-primary-600 dark:text-primary-400 hover:underline">
                    <Phone size={12} />
                    תיאום עם {train.contactName || 'איש הקשר'} · {train.contactPhone}
                  </a>
                )}

                <SlotGrid train={train} uid={user?.uid} userName={user?.name} onChanged={load} />
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreatePanel
          hats={hats}
          uid={user?.uid}
          userName={user?.name}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  )
}
