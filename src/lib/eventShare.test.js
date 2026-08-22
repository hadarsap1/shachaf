import { describe, it, expect } from 'vitest'
import {
  eventShareUrl, eventPath, eventShareText, whatsappShareUrl, mailtoShareUrl, safeNextPath,
} from './eventShare'

const ORIGIN = 'https://shachaf.vercel.app'

describe('eventShareUrl', () => {
  // /e/<id> is the preview page (api/event-preview): a messenger gets a card,
  // a human is handed on to the event.
  it('points at the shareable preview URL', () => {
    expect(eventShareUrl('abc123', ORIGIN)).toBe(`${ORIGIN}/e/abc123`)
  })

  it('escapes an id rather than letting it shape the path', () => {
    expect(eventShareUrl('a/b?c', ORIGIN)).toBe(`${ORIGIN}/e/a%2Fb%3Fc`)
  })

  it('is empty without an event — nothing to share', () => {
    expect(eventShareUrl('', ORIGIN)).toBe('')
  })
})

describe('eventPath', () => {
  it('is where the shared link lands inside the app', () => {
    expect(eventPath('abc123')).toBe('/events?event=abc123')
    expect(eventPath('a&b')).toBe('/events?event=a%26b')
  })
})

describe('eventShareText', () => {
  const event = {
    title: 'פיקניק כיתה א׳', date: '2026-09-01', time: '17:00',
    location: 'גינת כרמים',
  }

  it('reads like an invitation, and ends with the link', () => {
    const url = eventShareUrl('e1', ORIGIN)
    const text = eventShareText(event, { url })
    expect(text).toContain('פיקניק כיתה א׳')
    expect(text).toContain('17:00')
    expect(text).toContain('גינת כרמים')
    expect(text).toContain(url)
    expect(text).toContain('שחף+')
    // the date is spelled out in Hebrew, not left as an ISO string
    expect(text).not.toContain('2026-09-01')
  })

  it('never promises details the event does not have yet', () => {
    const text = eventShareText({ ...event, tbdFields: ['time', 'location'] })
    expect(text).toContain('שעה תפורסם בהמשך')
    expect(text).toContain('מיקום יפורסם בהמשך')
    expect(text).not.toContain('17:00')
    expect(text).not.toContain('גינת כרמים')
  })

  it('carries the dietary warning into the invitation', () => {
    const text = eventShareText({ ...event, dietaryRestrictions: ['peanuts', 'nuts'] })
    expect(text).toContain('ללא בוטנים')
    expect(text).toContain('ללא אגוזים')
  })

  it('survives a half-filled event', () => {
    expect(eventShareText({ title: 'משהו' })).toContain('משהו')
    expect(eventShareText(null)).toBe('')
  })
})

describe('share targets', () => {
  it('builds a WhatsApp link with the text encoded', () => {
    expect(whatsappShareUrl('שלום עולם')).toBe(`https://wa.me/?text=${encodeURIComponent('שלום עולם')}`)
  })

  it('builds a mailto with a subject naming the event', () => {
    const href = mailtoShareUrl({ title: 'פיקניק' }, 'גוף ההודעה')
    expect(href.startsWith('mailto:?subject=')).toBe(true)
    expect(decodeURIComponent(href)).toContain('הזמנה: פיקניק')
    expect(decodeURIComponent(href)).toContain('גוף ההודעה')
  })
})

describe('safeNextPath', () => {
  it('keeps an in-app destination', () => {
    expect(safeNextPath('/events?event=abc')).toBe('/events?event=abc')
  })

  it('refuses to be an open redirect', () => {
    // a link in a group chat must not be able to bounce a member off-site
    expect(safeNextPath('//evil.test/phish')).toBe('/dashboard')
    expect(safeNextPath('https://evil.test')).toBe('/dashboard')
    expect(safeNextPath('/\\evil.test')).toBe('/dashboard')
    expect(safeNextPath('javascript:alert(1)')).toBe('/dashboard')
    expect(safeNextPath('/events\n/x')).toBe('/dashboard')
  })

  it('falls back when there is nothing to honor', () => {
    expect(safeNextPath('')).toBe('/dashboard')
    expect(safeNextPath(null)).toBe('/dashboard')
    expect(safeNextPath(undefined, '/admin')).toBe('/admin')
  })
})
