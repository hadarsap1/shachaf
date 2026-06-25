import { Calendar, MapPin, Clock, Plus } from 'lucide-react'
import clsx from 'clsx'
import { buildCalendarData, buildGoogleCalendarUrl, buildICSContent, isEventPast } from '../../lib/calendar'

const TYPE_CONFIG = {
  social:      { label: 'חברתי',     color: 'badge-primary' },
  orientation: { label: 'אוריינטציה', color: 'badge-secondary' },
  ceremony:    { label: 'טקס',       color: 'badge-accent' },
  community:   { label: 'קהילה',     color: 'badge-warning' },
}

export default function EventCard({ event, onCardClick }) {
  const typeConfig = TYPE_CONFIG[event.type] || TYPE_CONFIG.social
  // Parse as LOCAL time (a bare 'YYYY-MM-DD' is otherwise treated as UTC midnight,
  // which makes a same-day event read as "past" during the local evening).
  const eventDate = new Date(`${event.date}T00:00:00`)
  const isPast = isEventPast(event)
  const calData = buildCalendarData(event)

  const handleAddToCalendar = () => {
    window.open(buildGoogleCalendarUrl(calData), '_blank')
  }

  const handleDownloadICS = () => {
    const content = buildICSContent(calData)
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className={clsx('card overflow-hidden transition-[box-shadow] duration-200', onCardClick ? 'cursor-pointer hover:shadow-card-hover' : 'hover:shadow-card-hover')}
      onClick={onCardClick}
    >
      {event.imageUrl ? (
        <img src={event.imageUrl} alt={event.title} className="w-full h-36 object-cover outline outline-1 outline-black/10" />
      ) : (
        <div className={clsx(
          'h-1.5',
          event.isRequired ? 'bg-gradient-to-r from-accent-400 to-accent-500' : 'bg-gradient-to-r from-primary-400 to-secondary-400'
        )} />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm leading-tight dark:text-gray-100">{event.title}</h3>
            {event.isRequired && (
              <span className="badge bg-accent-50 text-accent-700 border border-accent-200 text-xs mt-1 dark:bg-accent-900/30">כולם מוזמנים</span>
            )}
          </div>
          <span className={clsx(typeConfig.color, 'badge text-xs flex-shrink-0')}>
            {typeConfig.label}
          </span>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed mb-3 dark:text-gray-300">{event.description}</p>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Calendar size={13} className="text-primary-400" />
            <span>
              {eventDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          {event.time && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Clock size={13} className="text-primary-400" />
              <span>{event.time}</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <MapPin size={13} className="text-primary-400" />
              <span>{event.location}</span>
            </div>
          )}
        </div>

        {!isPast && (
          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={e => { e.stopPropagation(); handleAddToCalendar() }}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-3 py-2 rounded-lg transition-[background-color,scale] duration-150 active:scale-[0.96] font-medium dark:bg-primary-900/30"
            >
              <Plus size={13} />
              Google Calendar
            </button>
            <button
              onClick={e => { e.stopPropagation(); handleDownloadICS() }}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-2 rounded-lg transition-[background-color,scale] duration-150 active:scale-[0.96] font-medium dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
            >
              <Calendar size={13} />
              יומן (.ics)
            </button>
          </div>
        )}
        {isPast && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs text-gray-400">האירוע הסתיים</span>
          </div>
        )}
      </div>
    </div>
  )
}
