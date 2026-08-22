import { describe, it, expect } from 'vitest'
import {
  isValidEventId, escapeHtml, buildPreviewHtml, buildNotFoundHtml,
  PREVIEW_TITLE,
} from './_ogPreview.js'

const ORIGIN = 'https://shachaf.vercel.app'

describe('isValidEventId', () => {
  it('accepts the ids the app actually mints', () => {
    expect(isValidEventId('event-1766000000000')).toBe(true)
    expect(isValidEventId('aBc123_xyz-')).toBe(true)
  })

  it('rejects anything that is not an id', () => {
    expect(isValidEventId('')).toBe(false)
    expect(isValidEventId(undefined)).toBe(false)
    expect(isValidEventId('../../etc/passwd')).toBe(false)
    expect(isValidEventId('a b')).toBe(false)
    expect(isValidEventId('"><script>alert(1)</script>')).toBe(false)
    expect(isValidEventId('x'.repeat(65))).toBe(false)
  })
})

describe('escapeHtml', () => {
  it('closes the attribute and tag sinks', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">'))
      .toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })
})

describe('buildPreviewHtml', () => {
  const html = buildPreviewHtml('event-1', ORIGIN)

  it('carries the card a messenger draws', () => {
    expect(html).toContain(`<meta property="og:title" content="${PREVIEW_TITLE}">`)
    expect(html).toContain(`<meta property="og:image" content="${ORIGIN}/icon-512.png">`)
    expect(html).toContain(`<meta property="og:url" content="${ORIGIN}/e/event-1">`)
    expect(html).toContain('name="twitter:card"')
  })

  it('sends a human straight on to the event, without script', () => {
    expect(html).toContain('<meta http-equiv="refresh" content="0; url=/events?event=event-1">')
    expect(html).toContain('href="/events?event=event-1"')
    // the app's CSP blocks inline script — a preview that needed one would
    // simply never redirect
    expect(html).not.toContain('<script')
  })

  it('says nothing about the event itself — the privacy rule of this page', () => {
    const withDetails = buildPreviewHtml('event-1', ORIGIN)
    for (const leak of ['יום הולדת', 'גינת', '17:00', '2026-']) {
      expect(withDetails).not.toContain(leak)
    }
    // and it takes no event data as input at all
    expect(buildPreviewHtml.length).toBe(2)
  })

  it('keeps the redirect inside the app', () => {
    // the id is validated upstream; even so, the target is always relative
    expect(html).not.toContain('url=http')
    expect(html).toContain('url=/events?')
  })

  it('trims a trailing slash on the origin rather than doubling it', () => {
    expect(buildPreviewHtml('e1', 'https://x.test/')).toContain('content="https://x.test/icon-512.png"')
  })
})

describe('buildNotFoundHtml', () => {
  it('offers no destination and no redirect', () => {
    const html = buildNotFoundHtml(ORIGIN)
    expect(html).not.toContain('http-equiv="refresh"')
    expect(html).toContain('הקישור אינו תקין')
  })
})
