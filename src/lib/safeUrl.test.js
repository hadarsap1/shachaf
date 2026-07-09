import { describe, it, expect } from 'vitest'
import { safeHref, safeWebsiteHref } from './safeUrl'
import { needsConsent, CONSENT_VERSION } from './consent'

describe('safeHref', () => {
  it('allows http/https/mailto/tel', () => {
    expect(safeHref('https://example.com/x?y=1')).toBe('https://example.com/x?y=1')
    expect(safeHref('http://example.com')).toBe('http://example.com')
    expect(safeHref('mailto:a@b.com')).toBe('mailto:a@b.com')
    expect(safeHref('tel:0501234567')).toBe('tel:0501234567')
  })

  it('neutralizes javascript:, data:, and other dangerous schemes', () => {
    expect(safeHref('javascript:alert(1)')).toBe('#')
    expect(safeHref('JaVaScRiPt:alert(1)')).toBe('#')
    expect(safeHref(' javascript:alert(1)')).toBe('#')
    expect(safeHref('data:text/html,<script>x</script>')).toBe('#')
    expect(safeHref('vbscript:x')).toBe('#')
  })

  it('handles empty and non-string input', () => {
    expect(safeHref('')).toBe('#')
    expect(safeHref(null)).toBe('#')
    expect(safeHref(undefined)).toBe('#')
    expect(safeHref(42)).toBe('#')
  })
})

describe('safeWebsiteHref', () => {
  it('prefixes bare domains with https://', () => {
    expect(safeWebsiteHref('mysite.co.il')).toBe('https://mysite.co.il')
    expect(safeWebsiteHref('www.example.com/page')).toBe('https://www.example.com/page')
  })

  it('keeps existing http/https and blocks dangerous schemes', () => {
    expect(safeWebsiteHref('http://example.com')).toBe('http://example.com')
    expect(safeWebsiteHref('javascript:alert(1)')).toBe('#')
    expect(safeWebsiteHref('')).toBe('#')
  })
})

describe('needsConsent', () => {
  it('requires consent for users without the current version', () => {
    expect(needsConsent({ uid: 'u1' })).toBe(true)
    expect(needsConsent({ uid: 'u1', consentVersion: '0.9' })).toBe(true)
  })
  it('passes users who approved the current version, and no user at all', () => {
    expect(needsConsent({ uid: 'u1', consentVersion: CONSENT_VERSION })).toBe(false)
    expect(needsConsent(null)).toBe(false)
  })
})
