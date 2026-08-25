import { describe, it, expect } from 'vitest'
import { addDays, toDateStr, normalizeDay, isDayEmpty, visibleFor, childNames } from './emergency'

describe('date helpers', () => {
  it('formats a local date without shifting to UTC', () => {
    // 00:30 local — toISOString() would report the previous day in Israel.
    expect(toDateStr(new Date(2026, 0, 15, 0, 30))).toBe('2026-01-15')
  })

  it('rolls over month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('survives the DST spring-forward night', () => {
    expect(addDays('2026-03-26', 1)).toBe('2026-03-27')
  })
})

describe('normalizeDay', () => {
  it('fills missing sections on legacy docs that only had slots', () => {
    expect(normalizeDay({ slots: [{ subject: 'חשבון' }] }))
      .toEqual({ slots: [{ subject: 'חשבון' }], groups: [], playdates: [] })
  })

  it('treats a missing doc as an empty day', () => {
    expect(isDayEmpty(normalizeDay(undefined))).toBe(true)
    expect(isDayEmpty({ groups: [{ name: 'קבוצה 1' }] })).toBe(false)
  })
})

describe('visibleFor', () => {
  const mine = ['c1', 'c2']
  it('shows class-wide items (no children listed) to everyone', () => {
    expect(visibleFor({ childIds: [] }, mine)).toBe(true)
    expect(visibleFor({}, mine)).toBe(true)
  })
  it('shows a targeted item only to listed families', () => {
    expect(visibleFor({ childIds: ['c2', 'c9'] }, mine)).toBe(true)
    expect(visibleFor({ childIds: ['c9'] }, mine)).toBe(false)
  })
})

describe('childNames', () => {
  it('resolves ids and drops children no longer in the class', () => {
    const byId = { c1: { name: 'נועה' }, c2: { name: 'איתי' } }
    expect(childNames({ childIds: ['c1', 'gone', 'c2'] }, byId)).toEqual(['נועה', 'איתי'])
  })
})
