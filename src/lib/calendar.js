// Pure calendar helpers — no React, no Firebase. Safe to unit-test.

// Build a normalized { title, start, end, location, description } from an event.
// `start`/`end` are local-time strings ('YYYY-MM-DDTHH:mm').
export function buildCalendarData(event) {
  if (event.calendarData) return event.calendarData
  const time = event.time || '09:00'
  const start = `${event.date}T${time}`
  const [h, m] = time.split(':').map(Number)
  const endHour = String((h + 1) % 24).padStart(2, '0')
  const end = `${event.date}T${endHour}:${String(m).padStart(2, '0')}`
  return { title: event.title, start, end, location: event.location || '', description: event.description || '' }
}

export function buildGoogleCalendarUrl({ title, start, end, location, description = '' }) {
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

export function buildICSContent({ title, start, end, location, description = '' }) {
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

// An event is past once its end time (or end of its day, if no time) is before now.
// A bare 'YYYY-MM-DD' is parsed as LOCAL midnight so a same-day event is not
// mistakenly treated as past during the local evening.
export function isEventPast(event, now = new Date()) {
  if (!event?.date) return false
  const end = new Date(`${event.date}T${event.time || '23:59:59'}`)
  return end < now
}
