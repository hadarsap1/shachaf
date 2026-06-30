import { X, Clock, MapPin, Plus, Calendar } from 'lucide-react'
import clsx from 'clsx'

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

function buildGoogleCalendarUrl(event) {
  const time  = event.time || '09:00'
  const start = `${event.date}T${time}`
  const [h, m] = time.split(':').map(Number)
  const end   = `${event.date}T${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const fmt   = (s) => s.replace(/[-:]/g, '').slice(0, 13) + '00'
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    location: event.location || '',
    details: event.description || '',
    ctz: 'Asia/Jerusalem',
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

function buildICSContent(event) {
  const time  = event.time || '09:00'
  const start = `${event.date}T${time}`
  const [h, m] = time.split(':').map(Number)
  const end   = `${event.date}T${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const fmt   = (s) => s.replace(/[-:]/g, '').slice(0, 15)
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
    `DTSTART;TZID=Asia/Jerusalem:${fmt(start)}`, `DTEND;TZID=Asia/Jerusalem:${fmt(end)}`,
    `SUMMARY:${event.title}`,
    `LOCATION:${event.location || ''}`,
    `DESCRIPTION:${event.description || ''}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\n')
}

export default function EventDetailPanel({ event, onClose }) {
  const handleDownloadICS = () => {
    const content = buildICSContent(event)
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${event.title}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  const eventDate = new Date(event.date)
  const badgeCls  = TYPE_BADGE[event.type] || 'bg-gray-100 text-gray-600 border-gray-200'
  const typeLabel = TYPE_LABEL[event.type] || event.type

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col animate-slide-from-right" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
          <h2 className="font-bold text-gray-800">פרטי אירוע</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {event.imageUrl && (
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full object-cover max-h-56"
            />
          )}

          <div className="px-5 py-5 space-y-4">
          <div className="flex justify-end">
            <span className={clsx('text-xs px-2.5 py-0.5 rounded-full border font-medium', badgeCls)}>
              {typeLabel}
            </span>
          </div>

          <h3 className="text-lg font-bold text-gray-900 text-right leading-snug">{event.title}</h3>

          {event.description && (
            <p className="text-sm text-gray-600 text-right leading-relaxed">{event.description}</p>
          )}

          <div className="space-y-2">
            {event.date && (
              <div className="flex items-center gap-2 text-sm text-gray-600 justify-end">
                <span>
                  {eventDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
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
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
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
      </div>
    </>
  )
}
