import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getEvents, getClasses } from '../../lib/db'
import CalendarGrid from '../../components/ui/CalendarGrid'
import { Calendar, MapPin, Clock, Edit2, X, Plus, Loader2 } from 'lucide-react'
import clsx from 'clsx'

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_FILTERS = [
  { value: 'all',        label: 'הכל' },
  { value: 'new_family', label: 'משפחות חדשות' },
  { value: 'host_family',label: 'משפחות מארחות' },
  { value: 'admin',      label: 'מנהלים' },
]

function matchesFilter(ev, filterValue) {
  if (filterValue === 'all') return true
  if (ROLE_FILTERS.some(f => f.value === filterValue)) {
    const groups = ev.targetGroups || ['all']
    return groups.includes('all') || groups.includes(filterValue)
  }
  // class ID
  const groups = ev.targetGroups || ['all']
  if (groups.includes('all')) return true
  if (groups.includes('class')) return (ev.classIds || []).includes(filterValue)
  return false
}

const TYPE_LABEL = {
  social:      'חברתי',
  orientation: 'אוריינטציה',
  ceremony:    'טקס',
  community:   'קהילתי',
}

const TYPE_BADGE = {
  social:      'bg-primary-50 text-primary-700 border-primary-200',
  orientation: 'bg-secondary-50 text-secondary-700 border-secondary-200',
  ceremony:    'bg-accent-50 text-accent-700 border-accent-200',
  community:   'bg-purple-50 text-purple-700 border-purple-200',
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

function buildGoogleCalendarUrl(event) {
  const time  = event.time || '09:00'
  const start = `${event.date}T${time}`
  const [h, m] = time.split(':').map(Number)
  const end   = `${event.date}T${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const fmt   = (s) => s.replace(/[-:]/g, '').slice(0, 13) + '00Z'
  const params = new URLSearchParams({
    action:   'TEMPLATE',
    text:     event.title,
    dates:    `${fmt(start)}/${fmt(end)}`,
    location: event.location || '',
    details:  event.description || '',
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

function buildICSContent(event) {
  const time  = event.time || '09:00'
  const start = `${event.date}T${time}`
  const [h, m] = time.split(':').map(Number)
  const end   = `${event.date}T${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const fmt   = (s) => s.replace(/[-:]/g, '').slice(0, 15) + '00Z'
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${event.title}`,
    `LOCATION:${event.location || ''}`,
    `DESCRIPTION:${event.description || ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n')
}

// ── Event detail slide panel ──────────────────────────────────────────────────

function EventDetailPanel({ event, onClose }) {
  const handleDownloadICS = () => {
    const content = buildICSContent(event)
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${event.title}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  const eventDate = new Date(event.date)
  const badgeCls  = TYPE_BADGE[event.type] || 'bg-gray-100 text-gray-600 border-gray-200'
  const typeLabel = TYPE_LABEL[event.type] || event.type

  const targetLabel = () => {
    const groups = event.targetGroups || ['all']
    if (groups.includes('all')) return 'כולם'
    return groups.map(g => {
      if (g === 'new_family')  return 'משפחות חדשות'
      if (g === 'host_family') return 'משפחות מארחות'
      return g
    }).join(', ')
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div
        className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col animate-slide-from-right"
        dir="rtl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <X size={18} />
            </button>
            {/* Link to edit in AdminEventsPage */}
            <Link
              to="/admin/events"
              state={{ editEvent: event }}
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors"
              title="ערוך אירוע"
            >
              <Edit2 size={16} />
            </Link>
          </div>
          <h2 className="font-bold text-gray-800">פרטי אירוע</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Type badge + audience */}
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 font-medium">
              {targetLabel()}
            </span>
            <span className={clsx('text-xs px-2.5 py-0.5 rounded-full border font-medium', badgeCls)}>
              {typeLabel}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold text-gray-900 text-right leading-snug">{event.title}</h3>

          {/* Description */}
          {event.description && (
            <p className="text-sm text-gray-600 text-right leading-relaxed">{event.description}</p>
          )}

          {/* Meta */}
          <div className="space-y-2">
            {event.date && (
              <div className="flex items-center gap-2 text-sm text-gray-600 justify-end">
                <span>
                  {eventDate.toLocaleDateString('he-IL', {
                    weekday: 'long',
                    day:     'numeric',
                    month:   'long',
                    year:    'numeric',
                  })}
                  {event.time ? ` • ${event.time}` : ''}
                </span>
                <Clock size={15} className="text-primary-400 flex-shrink-0" />
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2 text-sm text-gray-600 justify-end">
                <span>{event.location}</span>
                <MapPin size={15} className="text-primary-400 flex-shrink-0" />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => window.open(buildGoogleCalendarUrl(event), '_blank')}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-3 py-2.5 rounded-xl transition-colors font-medium"
            >
              <Plus size={14} />
              Google Calendar
            </button>
            <button
              onClick={handleDownloadICS}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-2.5 rounded-xl transition-colors font-medium"
            >
              <Calendar size={14} />
              יומן (.ics)
            </button>
          </div>
          <Link
            to="/admin/events"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary-200 text-sm text-primary-700 hover:bg-primary-50 transition-colors font-medium"
          >
            <Edit2 size={14} />
            עריכת אירוע
          </Link>
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminCalendarPage() {
  const [events, setEvents]           = useState([])
  const [filterOptions, setFilterOptions] = useState(ROLE_FILTERS)
  const [loading, setLoading]         = useState(true)
  const [filterValue, setFilterValue] = useState('all')
  const [selectedEvent, setSelectedEvent] = useState(null)

  useEffect(() => {
    Promise.all([getEvents(), getClasses()])
      .then(([evData, classes]) => {
        setEvents(evData)
        const classChips = classes.map(cls => ({ value: cls.id, label: cls.name || cls.id }))
        setFilterOptions([...ROLE_FILTERS, ...classChips])
        setLoading(false)
      })
      .catch(err => { console.error('AdminCalendarPage load failed', err); setLoading(false) })
  }, [])

  return (
    <div className="page-container rtl" dir="rtl">
      {/* ── Page header ── */}
      <div className="mb-6">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 justify-end">
          <Calendar size={22} />
          לוח שנה
        </h1>
        <p className="text-sm text-gray-500 mt-0.5 text-right">{events.length} אירועים</p>
      </div>

      {/* ── Filter chips ── */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {filterOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilterValue(opt.value)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-all flex-shrink-0',
              filterValue === opt.value
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex justify-center items-center py-16">
          <Loader2 size={32} className="animate-spin text-primary-400" />
        </div>
      )}

      {/* ── Calendar ── */}
      {!loading && (
        <CalendarGrid
          events={events.filter(ev => matchesFilter(ev, filterValue))}
          filterRole="all"
          onEventClick={setSelectedEvent}
        />
      )}

      {/* ── Detail panel ── */}
      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}
