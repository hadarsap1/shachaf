import { useState, useEffect } from 'react'
import { getEvents, getClasses, getChildrenByParent, getChildren } from '../../lib/db'
import EventCard from '../../components/ui/EventCard'
import CalendarGrid from '../../components/ui/CalendarGrid'
import EventDetailPanel from '../../components/ui/EventDetailPanel'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'
import { Calendar, List, Loader2 } from 'lucide-react'
import clsx from 'clsx'

function matchesFilter(ev, filterValue) {
  if (filterValue === 'all') return true
  if (filterValue === 'new_family' || filterValue === 'host_family') {
    const groups = ev.targetGroups || ['all']
    return groups.includes('all') || groups.includes(filterValue)
  }
  // class ID filter
  const groups = ev.targetGroups || ['all']
  if (groups.includes('all')) return true
  if (groups.includes('class')) return (ev.classIds || []).includes(filterValue)
  return false
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EventsPage() {
  const { user, isAdmin } = useAuth()
  const { t } = useLang()
  const [events, setEvents]           = useState([])
  const [classColorMap, setClassColorMap] = useState({})
  const [filterOptions, setFilterOptions] = useState([])
  const [loading, setLoading]         = useState(true)
  const [displayMode, setDisplayMode] = useState('calendar')
  const [filterValue, setFilterValue] = useState('all')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [birthdays, setBirthdays] = useState([])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [allEvents, classes, myChildren] = await Promise.all([
        getEvents(),
        getClasses(),
        isAdmin ? Promise.resolve([]) : getChildrenByParent(user.uid),
      ])

      const BASE_FILTERS = [
        { value: 'all',        label: t('events', 'filterAll') },
        { value: 'new_family', label: t('events', 'filterNew') },
        { value: 'host_family',label: t('events', 'filterHost') },
      ]

      const colorMap = {}
      classes.forEach(cls => { if (cls.color) colorMap[cls.id] = cls.color })
      setClassColorMap(colorMap)

      const myClassIds = isAdmin
        ? []
        : [...new Set(myChildren.map(c => c.classId).filter(Boolean))]

      const classFilters = classes
        .filter(cls => isAdmin || myClassIds.includes(cls.id))
        .map(cls => ({ value: cls.id, label: cls.name || cls.id }))

      setFilterOptions([...BASE_FILTERS, ...classFilters])
      setEvents(allEvents)
      // load class children for birthday display
      if (myClassIds.length > 0) {
        const classKids = (await Promise.all(myClassIds.map(id => getChildren(id)))).flat()
        setBirthdays(classKids.filter(c => c.birthDate))
      }
      setLoading(false)
    }
    load().catch(err => { console.error('EventsPage load failed', err); setLoading(false) })
  }, [user, isAdmin])

  const filteredEvents = events.filter(ev => matchesFilter(ev, filterValue))

  return (
    <div className="page-container rtl" dir="rtl">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
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
            {t('events', 'calendarView')}
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
            {t('events', 'listView')}
          </button>
        </div>

        <div className="text-right">
          <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 justify-end">
            <Calendar size={22} />
            {t('events', 'title')}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('events', 'planned').replace('{count}', filteredEvents.filter(e => e.date >= new Date().toISOString().slice(0,10)).length)}</p>
        </div>
      </div>

      {/* ── Filter chips ── */}
      {!loading && (
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
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-primary-400" size={32} />
        </div>
      )}

      {/* ── Calendar view ── */}
      {!loading && displayMode === 'calendar' && (
        <CalendarGrid
          events={filteredEvents}
          filterRole="all"
          classColorMap={classColorMap}
          onEventClick={setSelectedEvent}
          birthdays={birthdays}
        />
      )}

      {/* ── List view ── */}
      {!loading && displayMode === 'list' && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            {filteredEvents.map(event => (
              <EventCard key={event.id} event={event} onCardClick={() => setSelectedEvent(event)} />
            ))}
          </div>

          {filteredEvents.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Calendar size={44} className="mx-auto mb-4 opacity-25" />
              <p className="font-semibold text-gray-500">{t('events', 'noEvents')}</p>
              <p className="text-sm mt-1">{t('events', 'noEventsSub')}</p>
            </div>
          )}
        </>
      )}

      {/* ── Empty calendar state ── */}
      {!loading && displayMode === 'calendar' && filteredEvents.length === 0 && (
        <div className="text-center py-16 text-gray-400 mt-4">
          <Calendar size={44} className="mx-auto mb-4 opacity-25" />
          <p className="font-semibold text-gray-500">{t('events', 'noEvents')}</p>
          <p className="text-sm mt-1">{t('events', 'noEventsSub')}</p>
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
