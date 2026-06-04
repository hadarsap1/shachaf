import { Calendar, MapPin, Clock, Plus } from 'lucide-react'
import clsx from 'clsx'

const TYPE_CONFIG = {
  social: { label: 'חברתי', color: 'badge-secondary' },
  school: { label: 'בית ספר', color: 'badge-primary' },
  community: { label: 'קהילה', color: 'badge-accent' },
}

function buildGoogleCalendarUrl({ title, start, end, location, description = '' }) {
  const fmt = (s) => s.replace(/[-:]/g, '').replace('T', 'T').slice(0, 15) + '00Z'
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    location: location || '',
    details: description,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

function buildICSContent({ title, start, end, location, description = '' }) {
  const fmt = (s) => s.replace(/[-:]/g, '').slice(0, 15) + '00Z'
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    `LOCATION:${location || ''}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n')
}

export default function EventCard({ event }) {
  const typeConfig = TYPE_CONFIG[event.type] || TYPE_CONFIG.social
  const eventDate = new Date(event.date)

  const handleAddToCalendar = () => {
    window.open(buildGoogleCalendarUrl(event.calendarData), '_blank')
  }

  const handleDownloadICS = () => {
    const content = buildICSContent(event.calendarData)
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card overflow-hidden hover:shadow-card-hover transition-shadow">
      {/* Colored top strip */}
      <div className={clsx(
        'h-1.5',
        event.isRequired ? 'bg-gradient-to-r from-accent-400 to-accent-500' : 'bg-gradient-to-r from-primary-400 to-secondary-400'
      )} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm leading-tight">{event.title}</h3>
            {event.isRequired && (
              <span className="badge bg-accent-50 text-accent-700 border border-accent-200 text-xs mt-1">כולם מוזמנים</span>
            )}
          </div>
          <span className={clsx(typeConfig.color, 'badge text-xs flex-shrink-0')}>
            {typeConfig.label}
          </span>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed mb-3">{event.description}</p>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar size={13} className="text-primary-400" />
            <span>
              {eventDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock size={13} className="text-primary-400" />
            <span>{event.time}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <MapPin size={13} className="text-primary-400" />
            <span>{event.location}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={handleAddToCalendar}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-3 py-2 rounded-lg transition-colors font-medium"
          >
            <Plus size={13} />
            Google Calendar
          </button>
          <button
            onClick={handleDownloadICS}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-2 rounded-lg transition-colors font-medium"
          >
            <Calendar size={13} />
            יומן (.ics)
          </button>
        </div>
      </div>
    </div>
  )
}
