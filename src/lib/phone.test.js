import { describe, it, expect } from 'vitest'
import { normalizeILPhone, samePhone, phoneIndex, matchUserToParent } from './phone'

describe('normalizeILPhone', () => {
  it('strips separators', () => {
    expect(normalizeILPhone('054-470-2286')).toBe('0544702286')
    expect(normalizeILPhone('054 4702286')).toBe('0544702286')
    expect(normalizeILPhone('(054) 4702286')).toBe('0544702286')
  })
  it('restores the leading zero spreadsheets strip', () => {
    expect(normalizeILPhone('544702286')).toBe('0544702286')
  })
  it('drops the +972 / 972 country prefix', () => {
    expect(normalizeILPhone('+972544702286')).toBe('0544702286')
    expect(normalizeILPhone('972-54-470-2286')).toBe('0544702286')
  })
  it('keeps landlines', () => {
    expect(normalizeILPhone('03-1234567')).toBe('031234567')
  })
  it('rejects values too short to be a phone', () => {
    expect(normalizeILPhone('12345')).toBe('')
    expect(normalizeILPhone('')).toBe('')
    expect(normalizeILPhone(null)).toBe('')
    expect(normalizeILPhone(undefined)).toBe('')
  })
})

describe('samePhone', () => {
  it('matches the same number written differently', () => {
    expect(samePhone('054-4702286', '+972544702286')).toBe(true)
    expect(samePhone('544702286', '0544702286')).toBe(true)
  })
  it('never matches on empty or unparsable values', () => {
    expect(samePhone('', '')).toBe(false)
    expect(samePhone('123', '123')).toBe(false)
    expect(samePhone(null, undefined)).toBe(false)
  })
  it('does not match different numbers', () => {
    expect(samePhone('0544702286', '0542430203')).toBe(false)
  })
})

describe('phoneIndex', () => {
  it('indexes users by normalized phone', () => {
    const idx = phoneIndex([{ uid: 'u1', phone: '054-4702286' }, { uid: 'u2', phone: '972542430203' }])
    expect(idx['0544702286']).toBe('u1')
    expect(idx['0542430203']).toBe('u2')
  })
  it('drops numbers shared by more than one account (ambiguous)', () => {
    const idx = phoneIndex([{ uid: 'u1', phone: '03-1234567' }, { uid: 'u2', phone: '031234567' }])
    expect(idx['031234567']).toBeUndefined()
  })
  it('ignores users without a usable phone', () => {
    expect(phoneIndex([{ uid: 'u1' }, { uid: 'u2', phone: '12' }])).toEqual({})
    expect(phoneIndex(null)).toEqual({})
  })
})

describe('matchUserToParent', () => {
  const opts = { userByEmail: { 'a@x.com': 'uEmail' }, byPhone: { '0544702286': 'uPhone' } }
  it('prefers the email match (authoritative)', () => {
    expect(matchUserToParent({ email: 'A@x.com', phone: '0544702286' }, opts)).toBe('uEmail')
  })
  it('falls back to phone when there is no email — the registry-import case', () => {
    expect(matchUserToParent({ name: 'רם', phone: '054-470-2286' }, opts)).toBe('uPhone')
  })
  it('returns null when nothing matches', () => {
    expect(matchUserToParent({ name: 'רם', phone: '0500000000' }, opts)).toBeNull()
    expect(matchUserToParent({}, opts)).toBeNull()
  })
})
