import { useState } from 'react'
import { X, Clock, MapPin, Plus, Calendar, Users, ChevronDown, Loader2, CheckCircle2, Maximize2 } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../context/AuthContext'
import { rsvpEvent, unrsvpEvent, getUsersByUids } from '../../lib/db'
import ContactModal from './ContactModal'

const TYPE_LABEL = {
  social:      'חברתי',
  orientation: 'אוריינטציה',
  ceremony:    'טקס',
  community:   'קהילתי',
}

const TYPE_BADGE = {
  social:      'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800',
  orientation: 'bg-secondary-50 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-300 border-secondary-200 dark:border-secondary-800',
  ceremony:    'bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300 border-accent-200 dark:border-accent-800',
  community:   'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
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
  const { user } = useAuth()
  const [attendeeUids, setAttendeeUids] = useState(event.attendeeUids || [])
  const [rsvpLoading, setRsvpLoading] = useState(false)
  const [attendeesOpen, setAttendeesOpen] = useState(false)
  const [attendees, setAttendees] = useState(null)
  const [loadingAttendees, setLoadingAttendees] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [imageError, setImageError] = useState(false)
  const [fullScreenImage, setFullScreenImage] = useState(false)

  const isGoing = user && attendeeUids.includes(user.uid)

  const handleRsvp = async () => {
    if (!user) return
    setRsvpLoading(true)
    try {
      if (isGoing) {
        await unrsvpEvent(event.id, user.uid)
        setAttendeeUids(u => u.filter(id => id !== user.uid))
        if (attendees) setAttendees(a => a.filter(p => p.uid !== user.uid))
      } else {
        await rsvpEvent(event.id, user.uid)
        setAttendeeUids(u => [...u, user.uid])
        if (attendees) setAttendees(a => [...a, { uid: user.uid, name: user.name || '' }])
      }
    } catch (e) {
      console.error('RSVP error', e)
    } finally {
      setRsvpLoading(false)
    }
  }

  const handleShowAttendees = async () => {
    if (!attendeesOpen && attendees === null) {
      setLoadingAttendees(true)
      const fetched = await getUsersByUids(attendeeUids)
      setAttendees(fetched)
      setLoadingAttendees(false)
    }
    setAttendeesOpen(o => !o)
  }

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
  const badgeCls  = TYPE_BADGE[event.type] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
  const typeLabel = TYPE_LABEL[event.type] || event.type

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col animate-slide-from-right dark:bg-gray-800" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700">
            <X size={18} />
          </button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100">פרטי אירוע</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {event.imageUrl && !imageError && (
            <div className="relative cursor-pointer group" onClick={() => setFullScreenImage(true)}>
              <img
                src={event.imageUrl}
                alt={event.title}
                className="w-full object-cover max-h-56 outline outline-1 outline-black/10"
                onError={() => setImageError(true)}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <Maximize2 size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </div>
          )}

          <div className="px-5 py-5 space-y-4">
            <div className="flex justify-end">
              <span className={clsx('text-xs px-2.5 py-0.5 rounded-full border font-medium', badgeCls)}>
                {typeLabel}
              </span>
            </div>

            <h3 className="text-lg font-bold text-gray-900 text-right leading-snug dark:text-white">{event.title}</h3>

            {event.description && (
              <p className="text-sm text-gray-600 text-right leading-relaxed dark:text-gray-300">{event.description}</p>
            )}

            <div className="space-y-2">
              {event.date && (
                <div className="flex items-center gap-2 text-sm text-gray-600 justify-end dark:text-gray-300">
                  <span>
                    {eventDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    {event.tbdFields?.includes('time') ? ' • שעה תפורסם בהמשך' : event.time ? ` • ${event.time}` : ''}
                  </span>
                  <Clock size={15} className="text-primary-400 flex-shrink-0" />
                </div>
              )}
              {(event.location || event.tbdFields?.includes('location')) && (
                <div className="flex items-center gap-2 text-sm text-gray-600 justify-end dark:text-gray-300">
                  <span>{event.tbdFields?.includes('location') ? 'מיקום יפורסם בהמשך' : event.location}</span>
                  <MapPin size={15} className="text-primary-400 flex-shrink-0" />
                </div>
              )}
            </div>

            {/* RSVP button */}
            <button
              onClick={handleRsvp}
              disabled={rsvpLoading}
              className={clsx(
                'w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-[background-color,color] duration-150 active:scale-[0.96]',
                isGoing
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              )}
            >
              {rsvpLoading
                ? <Loader2 size={15} className="animate-spin" />
                : isGoing
                  ? <><CheckCircle2 size={15} />אני מגיע/ה — לחץ לביטול</>
                  : <>אני מגיע/ה</>
              }
            </button>

            {/* Attendees */}
            {attendeeUids.length > 0 && (
              <div>
                <button
                  onClick={handleShowAttendees}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-[color] duration-150 dark:text-gray-400"
                >
                  <Users size={14} />
                  {attendeesOpen ? 'הסתר משתתפים' : `${attendeeUids.length} משתתפים`}
                  {loadingAttendees
                    ? <Loader2 size={13} className="animate-spin" />
                    : <ChevronDown size={13} className={clsx('transition-transform duration-150', attendeesOpen && 'rotate-180')} />
                  }
                </button>

                {attendeesOpen && attendees && (
                  <div className="mt-2 space-y-1">
                    {attendees.map(person => (
                      <button
                        key={person.uid}
                        onClick={() => setSelectedPerson(person)}
                        className="w-full flex items-center gap-2.5 py-2 px-2 rounded-xl hover:bg-gray-50 transition-[background-color] duration-150 text-right dark:hover:bg-gray-700/50"
                      >
                        <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 flex-shrink-0 dark:text-primary-300 dark:bg-primary-900/40">
                          {person.name?.[0] || '?'}
                        </div>
                        <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">{person.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 dark:border-gray-700">
          <button
            onClick={() => window.open(buildGoogleCalendarUrl(event), '_blank')}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm text-primary-600 dark:text-primary-300 bg-primary-50 hover:bg-primary-100 border border-primary-200 dark:border-primary-800 px-3 py-2.5 rounded-xl transition-[background-color] duration-150 font-medium active:scale-[0.96] dark:bg-primary-900/30 dark:hover:bg-primary-900/50"
          >
            <Plus size={14} />
            Google Calendar
          </button>
          <button
            onClick={handleDownloadICS}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-2.5 rounded-xl transition-[background-color] duration-150 font-medium active:scale-[0.96] dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
          >
            <Calendar size={14} />
            יומן (.ics)
          </button>
        </div>
      </div>

      {selectedPerson && (
        <ContactModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />
      )}

      {fullScreenImage && event.imageUrl && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setFullScreenImage(false)}>
          <button className="absolute top-4 right-4 p-2 text-white/80 hover:text-white" onClick={() => setFullScreenImage(false)}>
            <X size={24} />
          </button>
          <img
            src={event.imageUrl}
            alt={event.title}
            className="max-w-full max-h-full object-contain rounded-lg"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </>
  )
}
