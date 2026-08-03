import { describe, it, expect } from 'vitest'
import { buildCalendarData, buildGoogleCalendarUrl, buildICSContent, isEventPast } from './calendar'

describe('buildCalendarData', () => {
  it('derives a +1h window from date + time', () => {
    const d = buildCalendarData({ title: 'מפגש', date: '2026-09-01', time: '09:30', location: 'אולם' })
    expect(d.start).toBe('2026-09-01T09:30')
    expect(d.end).toBe('2026-09-01T10:30')
    expect(d.title).toBe('מפגש')
    expect(d.location).toBe('אולם')
  })

  it('defaults time to 09:00 when missing', () => {
    expect(buildCalendarData({ title: 'x', date: '2026-09-01' }).start).toBe('2026-09-01T09:00')
  })

  it('wraps the end hour past midnight', () => {
    expect(buildCalendarData({ title: 'x', date: '2026-09-01', time: '23:15' }).end).toBe('2026-09-01T00:15')
  })

  it('passes through a precomputed calendarData', () => {
    const cd = { title: 't', start: 's', end: 'e', location: '', description: '' }
    expect(buildCalendarData({ calendarData: cd })).toBe(cd)
  })
})

describe('buildGoogleCalendarUrl', () => {
  it('encodes a TEMPLATE url with dates', () => {
    const url = buildGoogleCalendarUrl({ title: 'Party', start: '2026-09-01T09:00', end: '2026-09-01T10:00' })
    expect(url).toContain('action=TEMPLATE')
    expect(url).toContain('text=Party')
    expect(url).toContain('dates=20260901T090000%2F20260901T100000')
  })

  // Regression: the stored time is local Israeli time. Marking it 'Z' told
  // Google it was UTC and every event landed 3 hours late.
  it('sends local times with an explicit timezone, never a UTC stamp', () => {
    const url = buildGoogleCalendarUrl({ title: 'x', start: '2026-09-01T09:00', end: '2026-09-01T10:00' })
    expect(url).toContain('ctz=Asia%2FJerusalem')
    expect(url).not.toContain('090000Z')
  })

  it('carries the location and the description across', () => {
    const url = buildGoogleCalendarUrl({
      title: 'x', start: '2026-09-01T09:00', end: '2026-09-01T10:00',
      location: 'אולם הספורט', description: 'להביא כובע',
    })
    const params = new URL(url).searchParams
    expect(params.get('location')).toBe('אולם הספורט')
    expect(params.get('details')).toBe('להביא כובע')
  })
})

describe('buildICSContent', () => {
  const ics = buildICSContent(
    { title: 'Party', start: '2026-09-01T09:00', end: '2026-09-01T10:00', location: 'Hall' },
    new Date('2026-08-03T10:00:00Z'),
  )

  it('emits a valid VEVENT block', () => {
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('SUMMARY:Party')
    expect(ics).toContain('LOCATION:Hall')
    expect(ics).toContain('END:VCALENDAR')
  })

  it('anchors the time to Israel rather than to UTC', () => {
    expect(ics).toContain('DTSTART;TZID=Asia/Jerusalem:20260901T090000')
    expect(ics).toContain('DTEND;TZID=Asia/Jerusalem:20260901T100000')
    expect(ics).not.toContain('DTSTART:20260901T090000Z')
    expect(ics).toContain('BEGIN:VTIMEZONE')
  })

  it('carries a UID and DTSTAMP so a re-download updates instead of duplicating', () => {
    expect(ics).toContain('DTSTAMP:20260803T100000Z')
    expect(ics.match(/^UID:.+$/m)).toBeTruthy()
    const again = buildICSContent(
      { title: 'Party', start: '2026-09-01T09:00', end: '2026-09-01T10:00', location: 'Hall' },
      new Date('2026-08-04T10:00:00Z'),
    )
    expect(again.match(/^UID:(.+)$/m)[1]).toBe(ics.match(/^UID:(.+)$/m)[1])
  })

  it('escapes commas, semicolons and newlines instead of truncating the field', () => {
    const out = buildICSContent({
      title: 'ערב הורים, כיתה ג', start: '2026-09-01T09:00', end: '2026-09-01T10:00',
      location: 'אולם; קומה 2', description: 'שורה\nשורה שנייה',
    })
    expect(out).toContain('SUMMARY:ערב הורים\\, כיתה ג')
    expect(out).toContain('LOCATION:אולם\\; קומה 2')
    expect(out).toContain('DESCRIPTION:שורה\\nשורה שנייה')
  })

  it('uses CRLF line endings as the spec requires', () => {
    expect(ics.includes('\r\n')).toBe(true)
  })

  it('keeps the UID ASCII-safe for a Hebrew title', () => {
    const out = buildICSContent({ title: 'ערב הורים כיתה ג', start: '2026-09-01T09:00', end: '2026-09-01T10:00' })
    const uid = out.match(/^UID:(.+)$/m)[1]
    expect(uid).toMatch(/^[\x20-\x7e]+$/)
    expect(uid).toContain('@shachaf')
  })

  it('folds long lines at 75 octets, counting Hebrew as two bytes', () => {
    const out = buildICSContent({
      title: 'x', start: '2026-09-01T09:00', end: '2026-09-01T10:00',
      description: 'א'.repeat(200),
    })
    const enc = new TextEncoder()
    for (const line of out.split('\r\n')) {
      expect(enc.encode(line).length).toBeLessThanOrEqual(76)
    }
    // continuation lines are marked with a leading space
    expect(out).toMatch(/\r\n /)
  })
})

describe('buildCalendarData — details that would otherwise be lost', () => {
  it('folds dietary restrictions and notes into the description', () => {
    const d = buildCalendarData({
      title: 'פיקניק', date: '2026-09-01', description: 'נפגשים בפארק',
      dietaryRestrictions: ['peanuts', 'gluten'], dietaryNote: 'ללא חטיפים ביתיים',
    })
    expect(d.description).toContain('נפגשים בפארק')
    expect(d.description).toContain('ללא בוטנים')
    expect(d.description).toContain('ללא גלוטן')
    expect(d.description).toContain('ללא חטיפים ביתיים')
  })

  it('spells out fields that are still to be announced', () => {
    const d = buildCalendarData({ title: 'x', date: '2026-09-01', tbdFields: ['time', 'location'] })
    expect(d.description).toContain('שעה תפורסם בהמשך')
    expect(d.description).toContain('מיקום יפורסם בהמשך')
  })

  it('marks a community-wide event and signs the source', () => {
    const d = buildCalendarData({ title: 'x', date: '2026-09-01', isRequired: true })
    expect(d.description).toContain('כולם מוזמנים')
    expect(d.description).toContain('שחף+')
  })
})

describe('isEventPast', () => {
  const now = new Date('2026-09-01T18:00:00')

  it('is false for a same-day event earlier today with no time (regression: UTC-midnight bug)', () => {
    expect(isEventPast({ date: '2026-09-01' }, now)).toBe(false)
  })

  it('is true once a timed event has ended', () => {
    expect(isEventPast({ date: '2026-09-01', time: '09:00' }, now)).toBe(true)
  })

  it('is false for a timed event later today', () => {
    expect(isEventPast({ date: '2026-09-01', time: '20:00' }, now)).toBe(false)
  })

  it('is true for a past date', () => {
    expect(isEventPast({ date: '2026-08-31' }, now)).toBe(true)
  })

  it('is false for a future date', () => {
    expect(isEventPast({ date: '2026-09-02' }, now)).toBe(false)
  })

  it('is false when date is missing', () => {
    expect(isEventPast({}, now)).toBe(false)
  })
})
