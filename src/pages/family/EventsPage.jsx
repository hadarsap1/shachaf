import { useState, useEffect } from 'react'
import { getEvents } from '../../lib/db'
import EventCard from '../../components/ui/EventCard'
import CalendarGrid from '../../components/ui/CalendarGrid'
import EventDetailPanel from '../../components/ui/EventDetailPanel'
import { useAuth } from '../../context/AuthContext'
import { Calendar, List, Loader2 } from 'lucide-react'
import clsx from 'clsx'

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EventsPage() {
  const { user } = useAuth()
  const [events, setEvents]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [displayMode, setDisplayMode] = useState('calendar')
  const [selectedEvent, setSelectedEvent] = useState(null)

  useEffect(() => {
    getEvents().then(data => { setEvents(data); setLoading(false) })
  }, [])

  return (
    <div className="page-container rtl" dir="rtl">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center rounded-full border border-gray-200 overflow-hidden">
          <button
            onClick={() => setDisplayMode('calendar')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all',
              displayMode === 'calendar'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <Calendar size={14} />
            לוח שנה
          </button>
          <button
            onClick={() => setDisplayMode('list')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all',
              displayMode === 'list'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <List size={14} />
            רשימה
          </button>
        </div>

        <div className="text-right">
          <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 justify-end">
            <Calendar size={22} />
            אירועים קרובים
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{events.filter(e => e.date >= new Date().toISOString().slice(0,10)).length} אירועים מתוכננים</p>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-primary-400" size={32} />
        </div>
      )}

      {/* ── Calendar view ── */}
      {!loading && displayMode === 'calendar' && (
        <CalendarGrid
          events={events}
          filterRole={user?.role}
          onEventClick={setSelectedEvent}
        />
      )}

      {/* ── List view ── */}
      {!loading && displayMode === 'list' && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            {events.map(event => (
              <EventCard key={event.id} event={event} onCardClick={() => setSelectedEvent(event)} />
            ))}
          </div>

          {events.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Calendar size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">אין אירועים קרובים</p>
            </div>
          )}
        </>
      )}

      {/* ── Empty calendar state ── */}
      {!loading && displayMode === 'calendar' && events.length === 0 && (
        <div className="text-center py-12 text-gray-400 mt-4">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">אין אירועים קרובים</p>
        </div>
      )}

      {/* ── Event detail panel ── */}
      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}
