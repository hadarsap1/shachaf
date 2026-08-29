import { describe, it, expect } from 'vitest'
import { SCHEDULE_DAYS, SCHEDULE_PERIODS } from './schedule'

describe('schedule', () => {
  // Saved schedules are keyed `${dayIndex}-${periodId}` (both the class doc and
  // each parent's localStorage overrides). Renaming an id silently blanks every
  // schedule already entered, so the ids are frozen.
  it('keeps the period ids stable', () => {
    expect(SCHEDULE_PERIODS.map(p => p.id))
      .toEqual(['morning', '1', '2', 'break1', '3', '4', 'break2', '5', '6'])
  })

  it('gives every period a time', () => {
    for (const p of SCHEDULE_PERIODS) {
      expect(p.time).toMatch(/^\d{2}:\d{2}-\d{2}:\d{2}$/)
    }
  })

  it('runs the periods in chronological order', () => {
    const starts = SCHEDULE_PERIODS.map(p => p.time.slice(0, 5))
    expect([...starts].sort()).toEqual(starts)
    // each period ends where the next one begins — no gaps, no overlaps
    for (let i = 0; i < SCHEDULE_PERIODS.length - 1; i++) {
      expect(SCHEDULE_PERIODS[i].time.slice(6)).toBe(SCHEDULE_PERIODS[i + 1].time.slice(0, 5))
    }
  })

  it('covers sunday through friday', () => {
    expect(SCHEDULE_DAYS).toHaveLength(6)
  })
})
