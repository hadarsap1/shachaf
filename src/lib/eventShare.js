// Sharing an event as a link that opens the event itself.
//
// "בואו לפיקניק הכיתה" pasted into WhatsApp is a message; a link that opens
// the app ON that event is an invitation. The link is the app's own URL with
// ?event=<id>, so it works from WhatsApp, mail, or anywhere else, and lands on
// the event inside the app — including for someone who has to sign in first
// (see safeNextPath: the login screen carries the destination through).
//
// What it deliberately does NOT do: grant access. The link points at an event;
// who may SEE it is still decided by lib/eventVisibility.js. A members-only
// committee event forwarded to a non-member opens to "האירוע אינו זמין" — the
// link is a shortcut, never a key.

import { dietaryLabel } from './dietary'

export const EVENT_PARAM = 'event'

// The address a message carries. /e/<id> is served by api/event-preview, which
// gives WhatsApp & co. a real card (logo + "הזמנה לאירוע") instead of a naked
// URL and then hands a human straight on to /events?event=<id>. The in-app
// route below is the fallback for anything that reaches the app directly.
export function eventShareUrl(eventId, origin = '') {
  if (!eventId) return ''
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/e/${encodeURIComponent(eventId)}`
}

// Where the shared link ends up inside the app.
export function eventPath(eventId) {
  return `/events?${EVENT_PARAM}=${encodeURIComponent(eventId)}`
}

// Hebrew date line for a message — a bare '2026-09-01' tells a parent nothing.
function shareDateLine(event) {
  if (!event?.date) return ''
  const d = new Date(`${event.date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return event.date
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
}

// The message body. Mirrors what the card shows, "יפורסם בהמשך" included, so
// the invitation cannot promise a time the event does not have.
export function eventShareText(event, { url = '' } = {}) {
  if (!event) return ''
  const tbd = event.tbdFields || []
  const lines = [event.title]

  const when = shareDateLine(event)
  const time = tbd.includes('time') ? 'שעה תפורסם בהמשך' : event.time
  if (when) lines.push(time ? `${when}, ${time}` : when)

  const place = tbd.includes('location') ? 'מיקום יפורסם בהמשך' : event.location
  if (place) lines.push(place)

  const tags = (event.dietaryRestrictions || []).map(t => `ללא ${dietaryLabel(t)}`)
  if (tags.length) lines.push(tags.join(', '))

  if (url) lines.push(url)
  lines.push('— נשלח משחף+')
  return lines.join('\n')
}

export function whatsappShareUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function mailtoShareUrl(event, text) {
  const subject = encodeURIComponent(`הזמנה: ${event?.title || 'אירוע'}`)
  return `mailto:?subject=${subject}&body=${encodeURIComponent(text)}`
}

// Where to return after a forced sign-in. Only a path INSIDE this app is
// allowed: anything absolute, protocol-relative ("//evil.test") or otherwise
// exotic is an open redirect waiting to be pasted into a group chat, so it
// falls back to the dashboard.
export function safeNextPath(next, fallback = '/dashboard') {
  if (typeof next !== 'string' || !next) return fallback
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  // Whitespace or control characters mean somebody is playing with the parser
  // rather than linking to a page.
  if (next.split('').some(ch => ch <= ' ' || ch === '\u007f')) return fallback
  return next
}
