import { useState } from 'react'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import clsx from 'clsx'

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

const SCHOOL_COLOR = '#1B3B70'

function getEventColor(event, classColorMap) {
  if (!event.classIds?.length) return SCHOOL_COLOR
  for (const cid of event.classIds) {
    if (classColorMap[cid]) return classColorMap[cid]
  }
  return SCHOOL_COLOR
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function todayKey() {
  return toDateKey(new Date())
}

function isVisible(event, filterRole) {
  if (!filterRole || filterRole === 'all') return true
  const groups = event.targetGroups || ['all']
  return groups.includes('all') || groups.includes(filterRole)
}

function formatTime(time) {
  if (!time) return ''
  return time.slice(0, 5)
}

// Build a 6-row × 7-col grid for a given month.
// Each cell: { date: Date, key: string, inMonth: boolean }
function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  // Sunday = 0 in JS, and we want Israeli weeks starting Sunday → no offset needed
  const startOffset = firstDay.getDay() // 0=Sun … 6=Sat

  const cells = []
  // Preceding month days
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    cells.push({ date: d, key: toDateKey(d), inMonth: false })
  }
  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d)
    cells.push({ date, key: toDateKey(date), inMonth: true })
  }
  // Fill to complete last row
  while (cells.length % 7 !== 0) {
    const d = new Date(year, month + 1, cells.length - lastDay.getDate() - startOffset + 1)
    cells.push({ date: d, key: toDateKey(d), inMonth: false })
  }
  return cells
}

// Build 7 days for a week view starting on the Sunday of the current week
function buildWeekDays(anchor) {
  const sunday = new Date(anchor)
  sunday.setDate(anchor.getDate() - anchor.getDay()) // go back to Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    return { date: d, key: toDateKey(d) }
  })
}

function weekRangeLabel(days) {
  const first = days[0].date
  const last  = days[6].date
  const opts  = { day: 'numeric', month: 'long' }
  if (first.getMonth() === last.getMonth()) {
    return `${first.toLocaleDateString('he-IL', { day: 'numeric' })}–${last.toLocaleDateString('he-IL', opts)} ${last.getFullYear()}`
  }
  return `${first.toLocaleDateString('he-IL', opts)} – ${last.toLocaleDateString('he-IL', opts)} ${last.getFullYear()}`
}

// ── Event chip (month cell) ───────────────────────────────────────────────────

function EventChip({ event, onClick, classColorMap }) {
  const color = getEventColor(event, classColorMap)
  return (
    <button
      onClick={() => onClick(event)}
      className="w-full text-start text-xs px-1.5 py-0.5 rounded-full truncate font-medium leading-snug"
      style={{ backgroundColor: color + '22', color }}
      title={event.title}
    >
      {event.title}
    </button>
  )
}

// ── Event dot (mobile month cell) ────────────────────────────────────────────

function EventDot({ event, onClick, classColorMap }) {
  const color = getEventColor(event, classColorMap)
  return (
    <button
      onClick={() => onClick(event)}
      title={event.title}
      className="w-3 h-3 rounded-full flex-shrink-0 inline-block"
      style={{ backgroundColor: color }}
    />
  )
}

// ── Week event card ───────────────────────────────────────────────────────────

function WeekEventCard({ event, onClick, classColorMap }) {
  const color = getEventColor(event, classColorMap)
  return (
    <button
      onClick={() => onClick(event)}
      className="w-full text-start border-r-2 bg-gray-50 hover:bg-gray-100 rounded-lg px-2 py-1.5 mb-1 transition-colors"
      style={{ borderRightColor: color }}
    >
      <p className="text-xs font-semibold text-gray-800 truncate leading-snug">{event.title}</p>
      {event.time && (
        <p className="text-xs text-gray-400 leading-none mt-0.5">{formatTime(event.time)}</p>
      )}
    </button>
  )
}

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({ year, month, eventsByDay, onEventClick, today, classColorMap }) {
  const cells = buildMonthGrid(year, month)

  return (
    <div className="w-full" dir="rtl">
      {/* Day-name header */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {DAY_NAMES.map(name => (
          <div key={name} className="py-2 text-center text-xs font-semibold text-gray-500">
            {name}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7">
        {cells.map(cell => {
          const dayEvents = eventsByDay[cell.key] || []
          const isToday   = cell.key === today
          const overflow  = dayEvents.length > 3
          const visible   = dayEvents.slice(0, 3)

          return (
            <div
              key={cell.key}
              className={clsx(
                'border border-gray-100 min-h-16 md:min-h-24 p-1 overflow-hidden',
                !cell.inMonth && 'bg-gray-50'
              )}
            >
              {/* Day number */}
              <div className="flex justify-center mb-1">
                <span className={clsx(
                  'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full leading-none',
                  isToday
                    ? 'bg-primary-600 text-white font-bold'
                    : cell.inMonth ? 'text-gray-700' : 'text-gray-300'
                )}>
                  {cell.date.getDate()}
                </span>
              </div>

              {/* Desktop: text chips */}
              <div className="hidden sm:flex flex-col gap-0.5">
                {visible.map(ev => (
                  <EventChip key={ev.id} event={ev} onClick={onEventClick} classColorMap={classColorMap} />
                ))}
                {overflow && (
                  <button
                    onClick={() => onEventClick(dayEvents[3])}
                    className="text-xs text-primary-600 hover:underline text-start px-1"
                  >
                    +{dayEvents.length - 3} נוספים
                  </button>
                )}
              </div>

              {/* Mobile: dots only */}
              <div className="flex sm:hidden flex-wrap gap-1 justify-center">
                {dayEvents.map(ev => (
                  <EventDot key={ev.id} event={ev} onClick={onEventClick} classColorMap={classColorMap} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Week view ─────────────────────────────────────────────────────────────────

function WeekView({ weekDays, eventsByDay, onEventClick, today, classColorMap }) {
  return (
    <div dir="rtl">
      {/* Desktop: 7-column grid */}
      <div className="hidden sm:grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden">
        {weekDays.map((day, idx) => {
          const isToday   = day.key === today
          const dayEvents = eventsByDay[day.key] || []

          return (
            <div key={day.key} className="bg-white min-h-48 flex flex-col">
              {/* Column header */}
              <div className={clsx(
                'py-2 px-1 text-center border-b border-gray-100',
                isToday && 'bg-primary-50'
              )}>
                <p className="text-xs text-gray-500">{DAY_NAMES[idx]}</p>
                <span className={clsx(
                  'text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mx-auto',
                  isToday ? 'bg-primary-600 text-white' : 'text-gray-700'
                )}>
                  {day.date.getDate()}
                </span>
              </div>

              {/* Events */}
              <div className="flex-1 p-1 overflow-y-auto">
                {dayEvents.map(ev => (
                  <WeekEventCard key={ev.id} event={ev} onClick={onEventClick} classColorMap={classColorMap} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile: vertical list of days */}
      <div className="flex flex-col gap-3 sm:hidden">
        {weekDays.map((day, idx) => {
          const isToday   = day.key === today
          const dayEvents = eventsByDay[day.key] || []

          return (
            <div key={day.key} className={clsx('card p-3', !isToday && dayEvents.length === 0 && 'opacity-60')}>
              <div className={clsx(
                'flex items-center gap-2 mb-2',
                isToday && 'text-primary-700'
              )}>
                <span className={clsx(
                  'text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full',
                  isToday ? 'bg-primary-600 text-white' : 'text-gray-600'
                )}>
                  {day.date.getDate()}
                </span>
                <span className="text-sm font-semibold text-gray-700">{DAY_NAMES[idx]}</span>
              </div>
              {dayEvents.length > 0 ? (
                <div className="space-y-1">
                  {dayEvents.map(ev => (
                    <WeekEventCard key={ev.id} event={ev} onClick={onEventClick} classColorMap={classColorMap} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">אין אירועים</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── CalendarGrid (main export) ────────────────────────────────────────────────

export default function CalendarGrid({ events = [], filterRole, classColorMap = {}, onEventClick }) {
  const [view, setView]               = useState('month')
  const [currentDate, setCurrentDate] = useState(() => new Date())

  const today = todayKey()

  // Filter events by role
  const filtered = events.filter(ev => isVisible(ev, filterRole))

  // Index events by date string key
  const eventsByDay = {}
  filtered.forEach(ev => {
    if (!ev.date) return
    if (!eventsByDay[ev.date]) eventsByDay[ev.date] = []
    eventsByDay[ev.date].push(ev)
  })

  // Navigation
  const goToToday = () => setCurrentDate(new Date())

  const goNext = () => {
    if (view === 'month') {
      setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    } else {
      setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
    }
  }

  const goPrev = () => {
    if (view === 'month') {
      setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    } else {
      setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
    }
  }

  // Header label
  const monthLabel = currentDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
  const weekDays   = buildWeekDays(currentDate)
  const headerLabel = view === 'month' ? monthLabel : weekRangeLabel(weekDays)

  return (
    <div className="w-full" dir="rtl">
      {/* ── Calendar header ── */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        {/* Right (DOM-first in RTL): prev arrow · title · next arrow */}
        <div className="flex items-center gap-1">
          <button
            onClick={goPrev}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="הקודם"
          >
            <ChevronRight size={18} />
          </button>
          <h2 className="font-bold text-gray-800 text-base min-w-24 text-center">
            {headerLabel}
          </h2>
          <button
            onClick={goNext}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="הבא"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Left (DOM-last in RTL): view toggle + today */}
        <div className="flex items-center gap-1">
          <div className="flex items-center rounded-full border border-gray-200 overflow-hidden">
            <button
              onClick={() => setView('month')}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium transition-all',
                view === 'month'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              חודש
            </button>
            <button
              onClick={() => setView('week')}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium transition-all',
                view === 'week'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              שבוע
            </button>
          </div>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            היום
          </button>
        </div>
      </div>

      {/* ── View ── */}
      {view === 'month' && (
        <MonthView
          year={currentDate.getFullYear()}
          month={currentDate.getMonth()}
          eventsByDay={eventsByDay}
          onEventClick={onEventClick}
          today={today}
          classColorMap={classColorMap}
        />
      )}
      {view === 'week' && (
        <WeekView
          weekDays={weekDays}
          eventsByDay={eventsByDay}
          onEventClick={onEventClick}
          today={today}
          classColorMap={classColorMap}
        />
      )}
    </div>
  )
}
