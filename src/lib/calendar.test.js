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
    expect(url).toContain('dates=20260901T090000Z%2F20260901T100000Z')
  })
})

describe('buildICSContent', () => {
  it('emits a valid VEVENT block', () => {
    const ics = buildICSContent({ title: 'Party', start: '2026-09-01T09:00', end: '2026-09-01T10:00', location: 'Hall' })
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('SUMMARY:Party')
    expect(ics).toContain('DTSTART:20260901T090000Z')
    expect(ics).toContain('LOCATION:Hall')
    expect(ics).toContain('END:VCALENDAR')
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
