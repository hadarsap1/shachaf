import { useState, useEffect } from 'react'
import { getClasses, getChildrenByParent, getEvents, getAnnouncements } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import {
  GraduationCap, Clock, Users, Calendar, Megaphone,
  Phone, Mail, Loader2, ChevronDown,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי']

// ── Center hours table ────────────────────────────────────────────────────────

function CenterHours({ hours }) {
  const active = (hours || []).filter(h => h.active)
  if (!active.length) return (
    <p className="text-sm text-gray-400 py-2">שעות לא הוגדרו</p>
  )
  return (
    <div className="divide-y divide-gray-50">
      {active.map(h => (
        <div key={h.day} className="flex items-center justify-between py-2.5">
          <span className="text-sm font-medium text-gray-500 w-16">{h.day}</span>
          <span className="text-sm font-semibold text-gray-800" dir="ltr">
            {h.start} – {h.end}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Contact card ──────────────────────────────────────────────────────────────

function PersonCard({ person }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-600 flex-shrink-0">
        {person.name?.[0] || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold text-gray-800">{person.name}</span>
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
          <p className="text-sm font-medium text-gray-800">{ann.title}</p>
          {ts && <p className="text-xs text-gray-400 mt-0.5">{ts.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}</p>}
        </div>
        <ChevronDown size={16} className={clsx('text-gray-400 flex-shrink-0 mt-0.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <p className="text-sm text-gray-600 leading-relaxed pb-3 px-0.5">{ann.body}</p>}
    </div>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, color, children, action }) {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2.5">
          <Icon size={18} style={{ color }} />
          <h2 className="font-semibold text-gray-800 text-sm">{title}</h2>
        </div>
        {action}
      </div>
      <div className="px-5 py-3">
        {children}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClassPage() {
  const { user } = useAuth()
  const [myClasses, setMyClasses]       = useState([])
  const [selectedIdx, setSelectedIdx]   = useState(0)
  const [events, setEvents]             = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading]           = useState(true)

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
      setEvents(allEvents)
      setAnnouncements(allAnns)
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
    ? announcements.filter(ann => !ann.classIds?.length || ann.classIds.includes(cls.id))
    : []

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={32} className="animate-spin text-primary-400" />
    </div>
  )

  if (myClasses.length === 0) return (
    <div className="p-6 text-center" dir="rtl">
      <GraduationCap size={48} className="mx-auto mb-4 text-gray-300" />
      <h2 className="text-lg font-semibold text-gray-700">אין כיתה מקושרת</h2>
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
        {/* Center hours */}
        {cls?.centerHours?.some(h => h.active) && (
          <Section title="שעות מסגרת" icon={Clock} color={cls.color || '#1B3B70'}>
            <CenterHours hours={cls.centerHours} />
          </Section>
        )}

        {/* Announcements */}
        {classAnns.length > 0 && (
          <Section title="הודעות" icon={Megaphone} color={cls?.color || '#1B3B70'}>
            <div className="divide-y divide-gray-50">
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
                    <p className="text-sm font-medium text-gray-800 truncate">{ev.title}</p>
                    {ev.time && <p className="text-xs text-gray-400">{ev.time.slice(0, 5)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Class team */}
        {cls?.team?.length > 0 && (
          <Section title="צוות הכיתה" icon={Users} color={cls?.color || '#1B3B70'}>
            {cls.team.map((p, i) => <PersonCard key={i} person={p} />)}
          </Section>
        )}

        {/* Class committee */}
        {cls?.committee?.length > 0 && (
          <Section title="ועד הכיתה" icon={Users} color={cls?.color || '#1B3B70'}>
            {cls.committee.map((p, i) => <PersonCard key={i} person={p} />)}
          </Section>
        )}
      </div>
    </div>
  )
}
