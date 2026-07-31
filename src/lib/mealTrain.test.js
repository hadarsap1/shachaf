import { describe, it, expect } from 'vitest'
import {
  buildSlots, groupByDate, formatSlotDate, canSeeAddress, slotStats, SLOT_TYPES,
  isMealTrainCommittee, addDay, removeDay, toggleDayType,
} from './mealTrain'

describe('addDay / removeDay', () => {
  it('adds a day with both slot types open and keeps the list sorted', () => {
    let days = addDay([], '2026-08-09')
    days = addDay(days, '2026-08-05')
    expect(days.map(d => d.date)).toEqual(['2026-08-05', '2026-08-09'])
    expect(days[0].types).toEqual(['meal', 'treat'])
  })
  it('ignores a duplicate or empty date', () => {
    const days = addDay([], '2026-08-05')
    expect(addDay(days, '2026-08-05')).toBe(days)
    expect(addDay(days, '')).toBe(days)
  })
  it('caps the rota so a mis-click cannot create hundreds of days', () => {
    let days = []
    for (let i = 1; i <= 70; i++) days = addDay(days, `2026-08-${String(i).padStart(2, '0')}`)
    expect(days).toHaveLength(60)
  })
  it('removes a day', () => {
    const days = addDay(addDay([], '2026-08-05'), '2026-08-09')
    expect(removeDay(days, '2026-08-05').map(d => d.date)).toEqual(['2026-08-09'])
  })
})

describe('toggleDayType', () => {
  it('turns a slot type off and back on for that day only', () => {
    const days = addDay(addDay([], '2026-08-05'), '2026-08-09')
    const off = toggleDayType(days, '2026-08-05', 'treat')
    expect(off[0].types).toEqual(['meal'])
    expect(off[1].types).toEqual(['meal', 'treat'])
    expect(toggleDayType(off, '2026-08-05', 'treat')[0].types).toEqual(['meal', 'treat'])
  })
  it('refuses to leave a day with no slot at all', () => {
    const days = toggleDayType(addDay([], '2026-08-05'), '2026-08-05', 'treat')
    expect(toggleDayType(days, '2026-08-05', 'meal')[0].types).toEqual(['meal'])
  })
})

describe('buildSlots', () => {
  it('creates a meal slot and a treat slot per day', () => {
    const slots = buildSlots(addDay([], '2026-08-05'))
    expect(slots).toHaveLength(2)
    expect(slots.map(s => s.type)).toEqual(['meal', 'treat'])
    expect(slots[0]).toMatchObject({ id: '2026-08-05_meal', date: '2026-08-05', byUid: '', byName: '' })
  })
  it('honours a day where only one type was left open', () => {
    const days = toggleDayType(addDay([], '2026-08-05'), '2026-08-05', 'meal')
    expect(buildSlots(days).map(s => s.type)).toEqual(['treat'])
  })
  it('keeps the meal-before-treat order whatever order the types were toggled in', () => {
    expect(buildSlots([{ date: '2026-08-05', types: ['treat', 'meal'] }]).map(s => s.type))
      .toEqual(['meal', 'treat'])
  })
  it('still accepts a plain date string (trains created before day types)', () => {
    expect(buildSlots(['2026-08-05']).map(s => s.id))
      .toEqual(['2026-08-05_meal', '2026-08-05_treat'])
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
