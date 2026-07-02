import { useState, useEffect } from 'react'
import { getClasses, getChildrenByParent, getChildren, getEvents, getAnnouncements, getChildNote, saveChildNote, getUsersByUids } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import {
  GraduationCap, Clock, Users, Calendar, Megaphone,
  Phone, Mail, Loader2, ChevronDown, Cake, StickyNote, Check, RotateCcw, Pencil,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'

const SCHEDULE_DAYS    = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳']
const SCHEDULE_PERIODS = [
  { id: 'morning', label: 'מפגש בוקר' },
  { id: '1',       label: '1' },
  { id: '2',       label: '2' },
  { id: 'break1',  label: 'הפסקה', isBreak: true },
  { id: '3',       label: '3' },
  { id: '4',       label: '4' },
  { id: 'break2',  label: 'הפסקה', isBreak: true },
  { id: '5',       label: '5' },
  { id: '6',       label: '6' },
]

// ── Weekly schedule (with personal overrides) ─────────────────────────────────

const OVERRIDE_KEY = (classId, uid) => `shachaf_schedule_override_${classId}_${uid}`

function loadOverrides(classId, uid) {
  try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY(classId, uid)) || '{}') } catch { return {} }
}
function saveOverrides(classId, uid, overrides) {
  try { localStorage.setItem(OVERRIDE_KEY(classId, uid), JSON.stringify(overrides)) } catch {}
}

function ScheduleView({ schedule, classId, uid }) {
  const [overrides, setOverrides] = useState(() => loadOverrides(classId, uid))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})

  const hasDefault = Object.values(schedule || {}).some(v => v?.trim())
  const hasOverrides = Object.keys(overrides).length > 0

  const merged = { ...schedule, ...overrides }
  const hasData = Object.values(merged).some(v => v?.trim())

  const startEdit = () => { setDraft({ ...overrides }); setEditing(true) }
  const saveEdit = () => {
    // strip empty strings to keep storage lean
    const cleaned = Object.fromEntries(Object.entries(draft).filter(([, v]) => v?.trim()))
    setOverrides(cleaned)
    saveOverrides(classId, uid, cleaned)
    setEditing(false)
  }
  const cancelEdit = () => setEditing(false)
  const resetToDefault = () => {
    setOverrides({})
    saveOverrides(classId, uid, {})
    setDraft({})
  }

  const cellVal = (di, periodId) => editing
    ? (draft[`${di}-${periodId}`] ?? overrides[`${di}-${periodId}`] ?? (schedule || {})[`${di}-${periodId}`] ?? '')
    : (merged[`${di}-${periodId}`] || '')

  if (!hasData && !editing) return (
    <p className="text-sm text-gray-400 py-2">מערכת שעות לא הוגדרה עדיין</p>
  )

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-2 gap-2">
        {hasOverrides && !editing && (
          <button onClick={resetToDefault}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
            <RotateCcw size={11} /> חזור לברירת מחדל
          </button>
        )}
        {!editing && (
          <button onClick={startEdit}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 ms-auto">
            <Pencil size={11} /> ערוך לפי הבחירות שלי
          </button>
        )}
        {editing && (
          <div className="flex gap-2 ms-auto">
            <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-600">ביטול</button>
            <button onClick={saveEdit} className="text-xs text-primary-600 font-semibold hover:text-primary-700">שמור</button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="min-w-full text-xs border-collapse" style={{ direction: 'rtl' }}>
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="sticky right-0 z-10 bg-white w-14 px-2 py-1.5 text-gray-400 font-medium text-right border-l border-gray-100 dark:bg-gray-800 dark:border-gray-700" />
              {SCHEDULE_DAYS.map(d => (
                <th key={d} className="px-1 py-1.5 text-center text-gray-500 font-semibold min-w-[60px] dark:text-gray-400">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCHEDULE_PERIODS.map(period => {
              if (period.isBreak) return (
                <tr key={period.id}>
                  <td colSpan={SCHEDULE_DAYS.length + 1}
                    className="py-0.5 px-2 text-[10px] text-gray-300 text-center italic">
                    — {period.label} —
                  </td>
                </tr>
              )
              return (
                <tr key={period.id} className="border-t border-gray-50">
                  <td className="sticky right-0 z-10 bg-white px-2 py-1.5 text-gray-400 font-semibold text-center border-l border-gray-100 text-[11px] dark:bg-gray-800 dark:border-gray-700">
                    {period.label}
                  </td>
                  {SCHEDULE_DAYS.map((_, di) => {
                    const key = `${di}-${period.id}`
                    const val = cellVal(di, period.id)
                    const isOverridden = !editing && !!overrides[key]
                    return (
                      <td key={di} className="px-1 py-1 text-center">
                        {editing ? (
                          <input
                            value={draft[key] ?? val}
                            onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                            className="w-full text-center text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-primary-400 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                            placeholder={hasDefault ? ((schedule || {})[key] || '') : ''}
                          />
                        ) : (
                          <span className={isOverridden ? 'text-primary-600 font-medium dark:text-primary-400' : 'text-gray-700 dark:text-gray-200'}>
                            {val || <span className="text-gray-200">—</span>}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {hasOverrides && !editing && (
        <p className="text-[10px] text-primary-500 mt-1.5 text-right">* שדות כחולים הם שינויים אישיים שלך</p>
      )}
    </div>
  )
}

// ── Contact card ──────────────────────────────────────────────────────────────

function PersonCard({ person }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-600 flex-shrink-0 dark:bg-primary-900/40">
        {person.name?.[0] || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{person.name}</span>
          {person.role && <span className="text-xs text-gray-400">{person.role}</span>}
          {person.title && <span className="text-xs text-gray-400">{person.title}</span>}
        </div>
        <div className="flex flex-wrap gap-3 mt-0.5">
          {person.phone && (
            <a href={`tel:${person.phone}`} className="flex items-center gap-1 text-xs text-primary-600" dir="ltr">
              <Phone size={11} />
              {person.phone}
            </a>
          )}
          {person.email && (
            <a href={`mailto:${person.email}`} className="flex items-center gap-1 text-xs text-primary-600" dir="ltr">
              <Mail size={11} />
              {person.email}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Announcement item ─────────────────────────────────────────────────────────

function AnnItem({ ann }) {
  const [open, setOpen] = useState(false)
  const ts = ann.createdAt?.toDate ? ann.createdAt.toDate() : ann.createdAt ? new Date(ann.createdAt) : null
  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between gap-2 py-3 text-right"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{ann.title}</p>
          {ts && <p className="text-xs text-gray-400 mt-0.5">{ts.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}</p>}
        </div>
        <ChevronDown size={16} className={clsx('text-gray-400 flex-shrink-0 mt-0.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <p className="text-sm text-gray-600 leading-relaxed pb-3 px-0.5 dark:text-gray-300">{ann.body}</p>}
    </div>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, color, children, action }) {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2.5">
          <Icon size={18} style={{ color }} />
          <h2 className="font-semibold text-gray-800 text-sm dark:text-gray-100">{title}</h2>
        </div>
        {action}
      </div>
      <div className="px-5 py-3">
        {children}
      </div>
    </div>
  )
}

// ── Child note card ──────────────────────────────────────────────────────────

function ChildNoteCard({ child, parentId, color }) {
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getChildNote(child.id, parentId)
      .then(n => { setNote(n); setLoading(false) })
      .catch(() => setLoading(false))
  }, [child.id, parentId])

  const handleBlur = async (val) => {
    try {
      await saveChildNote(child.id, parentId, val)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Check size={11} /> נשמר
            </span>
          )}
        </div>
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 dark:text-gray-200">
          {child.name}
          <span className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: color || '#1B3B70' }} />
        </span>
      </div>
      {loading ? (
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse dark:bg-gray-800" />
      ) : (
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          onBlur={e => handleBlur(e.target.value)}
          className="input w-full resize-none text-sm leading-relaxed"
          rows={3}
          placeholder="הוסף הערות פרטיות... (למשל: שם משתמש וסיסמה לאתר הלמידה)"
        />
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClassPage() {
  const { user } = useAuth()
  const [myClasses, setMyClasses]         = useState([])
  const [myChildren, setMyChildren]       = useState([])
  const [selectedIdx, setSelectedIdx]     = useState(0)
  const [events, setEvents]               = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [classChildren, setClassChildren] = useState([])
  const [classParents, setClassParents]   = useState([])
  const [classAdmins, setClassAdmins]     = useState([])
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [children, classes, allEvents, allAnns] = await Promise.all([
        getChildrenByParent(user.uid),
        getClasses(),
        getEvents(),
        getAnnouncements(),
      ])
      const myClassIds = [...new Set(children.map(c => c.classId).filter(Boolean))]
      const filtered = classes.filter(c => myClassIds.includes(c.id))
      setMyClasses(filtered)
      setMyChildren(children)
      setEvents(allEvents)
      setAnnouncements(allAnns)
      if (myClassIds.length > 0) {
        const cid = myClassIds[0]
        const cls = filtered.find(c => c.id === cid)
        // Use adminUids stored on the class doc — accessible to all authenticated users
        const adminUids = cls?.adminUids || []
        if (adminUids.length > 0) {
          getUsersByUids(adminUids).then(setClassAdmins).catch(() => {})
        }
        const allKids = await getChildren(cid)
        setClassChildren(allKids)
        const parentUids = [...new Set(allKids.flatMap(k => k.parentUids || []))]
        if (parentUids.length > 0) {
          const parents = await getUsersByUids(parentUids)
          setClassParents(parents)
        }
      }
      setLoading(false)
    }
    load()
  }, [user])

  const cls = myClasses[selectedIdx]

  const classEvents = cls
    ? events
        .filter(ev => ev.classIds?.includes(cls.id))
        .filter(ev => ev.date >= new Date().toISOString().slice(0, 10))
        .slice(0, 5)
    : []

  const classAnns = cls
    ? announcements.filter(ann => {
        const tg = ann.targetGroups || ['all']
        const audience = tg[0]
        if (audience === 'class') return (ann.classIds || []).includes(cls.id)
        return audience === 'all' || audience === user?.role
      })
    : []

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={32} className="animate-spin text-primary-400" />
    </div>
  )

  if (myClasses.length === 0) return (
    <div className="p-6 text-center" dir="rtl">
      <GraduationCap size={48} className="mx-auto mb-4 text-gray-300" />
      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">אין כיתה מקושרת</h2>
      <p className="text-sm text-gray-400 mt-1">
        ילדיכם טרם קושרו לכיתה. צרו קשר עם הנהלת בית הספר.
      </p>
      <Link to="/contact" className="mt-4 inline-flex btn-primary text-sm py-2 px-4">
        צור קשר
      </Link>
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" dir="rtl">
      {/* Class switcher */}
      {myClasses.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
          {myClasses.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setSelectedIdx(i)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-all border',
                i === selectedIdx
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
              style={i === selectedIdx ? { backgroundColor: c.color || '#1B3B70' } : {}}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: i === selectedIdx ? 'rgba(255,255,255,0.7)' : (c.color || '#1B3B70') }} />
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Class header */}
      {cls && (
        <div className="rounded-2xl p-5 mb-5 text-white"
          style={{ backgroundColor: cls.color || '#1B3B70' }}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-black">{cls.name}</h1>
              {cls.grade && <p className="text-sm opacity-80 mt-0.5">כיתה {cls.grade} • {cls.year || ''}</p>}
            </div>
            <GraduationCap size={32} className="opacity-30" />
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Schedule */}
        {cls && (
          <Section title="מערכת שעות" icon={Clock} color={cls.color || '#1B3B70'}>
            <ScheduleView schedule={cls.schedule} classId={cls.id} uid={user.uid} />
          </Section>
        )}

        {/* Upcoming birthdays */}
        {(() => {
          const today = new Date()
          const upcoming = classChildren
            .filter(c => c.birthDate)
            .map(c => {
              const [, mm, dd] = c.birthDate.split('-')
              const thisYear = new Date(today.getFullYear(), +mm - 1, +dd)
              if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1)
              return { ...c, next: thisYear, diff: Math.ceil((thisYear - today) / 86400000) }
            })
            .filter(c => c.diff <= 60)
            .sort((a, b) => a.diff - b.diff)
          if (!upcoming.length) return null
          return (
            <Section title="ימי הולדת קרובים" icon={Cake} color={cls?.color || '#1B3B70'}>
              <div className="space-y-2">
                {upcoming.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-gray-400">
                      {c.next.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
                    </span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{c.name}</span>
                  </div>
                ))}
              </div>
            </Section>
          )
        })()}

        {/* Announcements */}
        {classAnns.length > 0 && (
          <Section title="הודעות" icon={Megaphone} color={cls?.color || '#1B3B70'}>
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {classAnns.slice(0, 5).map(ann => (
                <AnnItem key={ann.id} ann={ann} />
              ))}
            </div>
          </Section>
        )}

        {/* Upcoming events for this class */}
        {classEvents.length > 0 && (
          <Section
            title="אירועי הכיתה"
            icon={Calendar}
            color={cls?.color || '#1B3B70'}
            action={<Link to="/events" className="text-xs text-primary-600 hover:underline">כל האירועים</Link>}
          >
            <div className="space-y-2">
              {classEvents.map(ev => (
                <div key={ev.id} className="flex items-center gap-3 py-1.5">
                  <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: (cls?.color || '#1B3B70') + '18' }}>
                    <span className="text-xs font-bold" style={{ color: cls?.color || '#1B3B70' }}>
                      {new Date(ev.date).getDate()}
                    </span>
                    <span className="text-[10px]" style={{ color: cls?.color || '#1B3B70' }}>
                      {new Date(ev.date).toLocaleDateString('he-IL', { month: 'short' })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate dark:text-gray-100">{ev.title}</p>
                    {ev.time && <p className="text-xs text-gray-400">{ev.time.slice(0, 5)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Class team — teachers set by school admin */}
        {cls?.team?.length > 0 && (
          <Section title="צוות הכיתה" icon={Users} color={cls?.color || '#1B3B70'}>
            {cls.team.map((p, i) => <PersonCard key={i} person={p} />)}
          </Section>
        )}

        {/* Class admins — parents who manage the class in the app */}
        {classAdmins.length > 0 && (
          <Section title="מנהלי כיתה" icon={Users} color={cls?.color || '#1B3B70'}>
            {classAdmins.map(p => <PersonCard key={p.uid} person={p} />)}
          </Section>
        )}

        {/* Personal notes per child — visible only to this parent */}
        {myChildren.filter(c => c.classId === cls?.id).length > 0 && (
          <Section title="הערות אישיות" icon={StickyNote} color={cls?.color || '#1B3B70'}>
            <p className="text-xs text-gray-400 mb-3 text-right">הערות אלו פרטיות — רק אתם רואים אותן</p>
            <div className="space-y-4">
              {myChildren.filter(c => c.classId === cls?.id).map(child => (
                <ChildNoteCard key={child.id} child={child} parentId={user.uid} color={cls?.color} />
              ))}
            </div>
          </Section>
        )}

        {/* Class roster — kids and their parents */}
        {classChildren.length > 0 && (
          <Section title="ילדי הכיתה" icon={Users} color={cls?.color || '#1B3B70'}>
            <div className="space-y-3">
              {classChildren.map(child => {
                const parents = classParents.filter(p => (child.parentUids || []).includes(p.uid))
                return (
                  <div key={child.id} className="rounded-xl border border-gray-100 dark:border-gray-700 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base leading-none">👦</span>
                      <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">{child.name}</span>
                    </div>
                    {parents.length > 0 && (
                      <div className="space-y-1 me-6">
                        {parents.map(p => (
                          <div key={p.uid} className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>{p.phone ? (
                              <a href={`tel:${p.phone}`} className="text-primary-600 hover:underline">{p.phone}</a>
                            ) : '—'}</span>
                            <span>{p.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
