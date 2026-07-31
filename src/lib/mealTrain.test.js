import { describe, it, expect } from 'vitest'
import {
  generateDates, buildSlots, groupByDate, formatSlotDate, canSeeAddress, slotStats, SLOT_TYPES,
  isMealTrainCommittee,
} from './mealTrain'

describe('generateDates', () => {
  it('picks every selected weekday in the range (Sun + Wed, like the sheet)', () => {
    // 2026-08-02 is a Sunday; 2026-08-05 Wednesday
    const dates = generateDates({ from: '2026-08-02', to: '2026-08-16', weekdays: [0, 3] })
    expect(dates).toEqual([
      '2026-08-02', '2026-08-05', '2026-08-09', '2026-08-12', '2026-08-16',
    ])
  })
  it('includes both endpoints when they match', () => {
    expect(generateDates({ from: '2026-08-02', to: '2026-08-02', weekdays: [0] })).toEqual(['2026-08-02'])
  })
  it('returns [] for missing or reversed input', () => {
    expect(generateDates({ from: '', to: '2026-08-16', weekdays: [0] })).toEqual([])
    expect(generateDates({ from: '2026-08-16', to: '2026-08-02', weekdays: [0] })).toEqual([])
    expect(generateDates({ from: '2026-08-02', to: '2026-08-16', weekdays: [] })).toEqual([])
  })
  it('caps runaway ranges', () => {
    const dates = generateDates({ from: '2026-01-01', to: '2030-01-01', weekdays: [0, 1, 2, 3, 4, 5, 6] }, 10)
    expect(dates).toHaveLength(10)
  })
})

describe('buildSlots', () => {
  it('creates a meal slot and a treat slot per date', () => {
    const slots = buildSlots(['2026-08-05'])
    expect(slots).toHaveLength(2)
    expect(slots.map(s => s.type)).toEqual(['meal', 'treat'])
    expect(slots[0]).toMatchObject({ id: '2026-08-05_meal', date: '2026-08-05', byUid: '', byName: '' })
  })
  it('handles empty input', () => {
    expect(buildSlots([])).toEqual([])
    expect(buildSlots(undefined)).toEqual([])
  })
})

describe('groupByDate', () => {
  it('groups slots per date in ascending order with a stable type order', () => {
    const slots = [
      { id: 'b_treat', date: '2026-08-09', type: 'treat' },
      { id: 'a_treat', date: '2026-08-05', type: 'treat' },
      { id: 'a_meal',  date: '2026-08-05', type: 'meal' },
      { id: 'b_meal',  date: '2026-08-09', type: 'meal' },
    ]
    const groups = groupByDate(slots)
    expect(groups.map(g => g.date)).toEqual(['2026-08-05', '2026-08-09'])
    expect(groups[0].slots.map(s => s.type)).toEqual(['meal', 'treat'])
  })
})

describe('formatSlotDate', () => {
  it('formats as weekday + day/month', () => {
    expect(formatSlotDate('2026-08-05')).toBe('רביעי 5/08')
    expect(formatSlotDate('2026-08-09')).toBe('ראשון 9/08')
  })
  it('passes through unparsable values', () => {
    expect(formatSlotDate('not-a-date')).toBe('not-a-date')
  })
})

describe('canSeeAddress', () => {
  const train = { createdBy: 'coord', claimerUids: ['helper1'] }
  it('reveals to someone who claimed a slot', () => {
    expect(canSeeAddress(train, 'helper1')).toBe(true)
  })
  it('reveals to the coordinator who opened it, and to admins', () => {
    expect(canSeeAddress(train, 'coord')).toBe(true)
    expect(canSeeAddress(train, 'someone', true)).toBe(true)
  })
  it('hides from a member who has not signed up', () => {
    expect(canSeeAddress(train, 'stranger')).toBe(false)
    expect(canSeeAddress(train, '')).toBe(false)
    expect(canSeeAddress(null, 'helper1')).toBe(false)
  })
})

describe('slotStats', () => {
  it('counts taken vs open', () => {
    expect(slotStats([{ byUid: 'a' }, { byUid: '' }, { byUid: '' }])).toEqual({ total: 3, taken: 1, open: 2 })
    expect(slotStats([])).toEqual({ total: 0, taken: 0, open: 0 })
  })
})

describe('SLOT_TYPES', () => {
  it('carries the hints the sheet spelled out', () => {
    expect(SLOT_TYPES.find(t => t.value === 'meal').hint).toContain('תבשיל')
    expect(SLOT_TYPES.find(t => t.value === 'treat').hint).toContain('עוגה')
  })
})

describe('isMealTrainCommittee', () => {
  it('accepts the community-support committee out of the box', () => {
    expect(isMealTrainCommittee({ name: 'ועדת תמיכה בקהילה' })).toBe(true)
    expect(isMealTrainCommittee({ name: 'תמיכה' })).toBe(true)
  })

  it('rejects every other committee', () => {
    expect(isMealTrainCommittee({ name: 'ועד הורים' })).toBe(false)
    expect(isMealTrainCommittee({ name: 'ועדת תרבות' })).toBe(false)
    expect(isMealTrainCommittee(null)).toBe(false)
    expect(isMealTrainCommittee({})).toBe(false)
  })

  it('accepts any committee an admin explicitly flagged', () => {
    expect(isMealTrainCommittee({ name: 'ועדת תרבות', mealTrains: true })).toBe(true)
    expect(isMealTrainCommittee({ name: 'ועדת תרבות', mealTrains: false })).toBe(false)
  })
})
