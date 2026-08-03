// Pure calendar helpers — no React, no Firebase. Safe to unit-test.
//
// Times stored on an event ('09:30') are LOCAL Israeli times. The export used to
// stamp them with a trailing 'Z', which told Google they were UTC and landed
// every event 2–3 hours late in the user's calendar. Everything below carries
// the timezone explicitly instead.

import { dietaryLabel } from './dietary'

export const EVENT_TZ = 'Asia/Jerusalem'

// An event's full story as it should reach an external calendar: the free-text
// description, plus the details that live in their own fields in the app and
// would otherwise be lost on export (dietary restrictions, "to be announced"
// fields, who published it).
function buildDescription(event) {
  const parts = []
  if (event.description) parts.push(event.description)

  const tags = (event.dietaryRestrictions || []).map(t => `ללא ${dietaryLabel(t)}`)
  if (tags.length) parts.push(`מגבלות תזונה: ${tags.join(', ')}`)
  if (event.dietaryNote) parts.push(event.dietaryNote)

  const tbd = event.tbdFields || []
  if (tbd.includes('time')) parts.push('שעה תפורסם בהמשך')
  if (tbd.includes('location')) parts.push('מיקום יפורסם בהמשך')
  if (event.isRequired) parts.push('כולם מוזמנים')

  parts.push('נשלח משחף+')
  return parts.join('\n')
}

// Build a normalized { title, start, end, location, description } from an event.
// `start`/`end` are local-time strings ('YYYY-MM-DDTHH:mm').
export function buildCalendarData(event) {
  if (event.calendarData) return event.calendarData
  const time = event.time || '09:00'
  const start = `${event.date}T${time}`
  const [h, m] = time.split(':').map(Number)
  const endHour = String((h + 1) % 24).padStart(2, '0')
  const end = `${event.date}T${endHour}:${String(m).padStart(2, '0')}`
  return {
    title: event.title,
    start,
    end,
    location: event.location || '',
    description: buildDescription(event),
  }
}

// 'YYYY-MM-DDTHH:mm' → 'YYYYMMDDTHHmmss' (no trailing Z — the zone travels
// separately, in ctz= for Google and TZID= for ICS).
const stamp = (s) => `${s.replace(/[-:]/g, '').slice(0, 13)}00`

export function buildGoogleCalendarUrl({ title, start, end, location, description = '' }) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${stamp(start)}/${stamp(end)}`,
    location: location || '',
    details: description,
    ctz: EVENT_TZ,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

// RFC 5545 escaping — an unescaped comma or newline in a description silently
// truncates the field (or breaks the whole file) in strict calendar clients.
function escapeICS(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Israel's DST rules, so a downloaded event stays put in Outlook and Apple
// Calendar too (they resolve TZID against this block rather than guessing).
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${EVENT_TZ}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0300',
  'TZNAME:IDT',
  'DTSTART:19700327T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=FR;BYMONTHDAY=23,24,25,26,27,28,29',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0300',
  'TZOFFSETTO:+0200',
  'TZNAME:IST',
  'DTSTART:19701025T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

// Lines are limited to 75 OCTETS, and Hebrew is two bytes per character — an
// unfolded description is exactly where a strict parser gives up. Continuation
// lines start with a single space.
function foldICSLine(line) {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const out = []
  let chunk = ''
  let chunkBytes = 0
  let limit = 75
  for (const ch of line) {
    const size = new TextEncoder().encode(ch).length
    if (chunkBytes + size > limit) {
      out.push(chunk)
      chunk = ''
      chunkBytes = 0
      limit = 74          // continuation lines carry a leading space
    }
    chunk += ch
    chunkBytes += size
  }
  if (chunk) out.push(chunk)
  return out.join('\r\n ')
}

// ASCII, stable, and short — a percent-encoded Hebrew title got sliced
// mid-escape and produced a malformed UID.
function titleHash(title = '') {
  let h = 0
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export function buildICSContent({ title, start, end, location, description = '' }, now = new Date()) {
  const dtstamp = `${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`
  // Stable per event+time so re-downloading updates the same entry instead of
  // creating a duplicate.
  const uid = `${stamp(start)}-${titleHash(title)}@shachaf`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//שחף+//events//HE',
    'CALSCALE:GREGORIAN',
    ...VTIMEZONE,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${EVENT_TZ}:${stamp(start)}`,
    `DTEND;TZID=${EVENT_TZ}:${stamp(end)}`,
    `SUMMARY:${escapeICS(title)}`,
    `LOCATION:${escapeICS(location)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].map(foldICSLine).join('\r\n')   // RFC 5545 requires CRLF
}

// An event is past once its end time (or end of its day, if no time) is before now.
// A bare 'YYYY-MM-DD' is parsed as LOCAL midnight so a same-day event is not
// mistakenly treated as past during the local evening.
export function isEventPast(event, now = new Date()) {
  if (!event?.date) return false
  const end = new Date(`${event.date}T${event.time || '23:59:59'}`)
  return end < now
}
