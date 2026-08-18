import { describe, it, expect } from 'vitest'
import {
  hasConsented, needsConsent, childHasConsentedParent, compareConsentVersions,
  CONSENT_VERSION, DISPLAY_CONSENT_SINCE,
} from './consent'

describe('needsConsent', () => {
  it('re-prompts on any version other than the current one', () => {
    expect(needsConsent({ uid: 'u1' })).toBe(true)
    expect(needsConsent({ uid: 'u1', consentVersion: '1.2' })).toBe(true)
    expect(needsConsent({ uid: 'u1', consentVersion: CONSENT_VERSION })).toBe(false)
  })
})

describe('hasConsented', () => {
  it('keeps showing a member who approved an earlier policy', () => {
    // The bug this guards: bumping to 1.3 emptied class rosters, because every
    // parent still on 1.2 was read as "never consented".
    expect(hasConsented({ consentVersion: '1.2' })).toBe(true)
    expect(hasConsented({ consentVersion: CONSENT_VERSION })).toBe(true)
  })

  it('shows nobody who never approved, or approved before the display baseline', () => {
    expect(hasConsented({})).toBe(false)
    expect(hasConsented(null)).toBe(false)
    expect(hasConsented(undefined)).toBe(false)
    expect(hasConsented({ consentVersion: '0.9' })).toBe(false)
  })

  it('accepts exactly the baseline version', () => {
    expect(hasConsented({ consentVersion: DISPLAY_CONSENT_SINCE })).toBe(true)
  })
})

describe('childHasConsentedParent', () => {
  const parents = { p1: { consentVersion: '1.2' }, p2: { consentVersion: '0.9' } }

  it('shows a child once any linked parent has consented', () => {
    expect(childHasConsentedParent({ parentUids: ['p2', 'p1'] }, parents)).toBe(true)
  })

  it('hides a child with no linked parent, or none who consented', () => {
    expect(childHasConsentedParent({ parentUids: [] }, parents)).toBe(false)
    expect(childHasConsentedParent({ parentUids: ['p2'] }, parents)).toBe(false)
    // a parent whose user doc could not be read counts as not-consented
    expect(childHasConsentedParent({ parentUids: ['ghost'] }, parents)).toBe(false)
  })
})

describe('compareConsentVersions', () => {
  it('compares numerically, not as strings', () => {
    expect(compareConsentVersions('1.10', '1.9')).toBe(1)
    expect(compareConsentVersions('1.2', '1.3')).toBe(-1)
    expect(compareConsentVersions('2', '1.9')).toBe(1)
    expect(compareConsentVersions('1.3', '1.3.0')).toBe(0)
  })

  it('treats a missing or unparsable version as the lowest', () => {
    expect(compareConsentVersions(undefined, '1.0')).toBe(-1)
    expect(compareConsentVersions('', '0')).toBe(0)
  })
})
