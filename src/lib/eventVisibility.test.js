import { describe, it, expect } from 'vitest'
import { isEventVisibleTo, isUpcoming, todayKey } from './eventVisibility'

describe('isEventVisibleTo', () => {
  it('shows ordinary community events to everyone', () => {
    expect(isEventVisibleTo({ targetGroups: ['all'] }, { entityIds: [] })).toBe(true)
    expect(isEventVisibleTo({ targetGroups: [] }, { entityIds: [] })).toBe(true)
    expect(isEventVisibleTo({}, {})).toBe(true)
  })

  // The dashboard used to hide these while the calendar showed them — the bug
  // that made "אירועים קרובים" read empty for a member who did have events.
  it('shows an event aimed at another family type — it is a filter, not a lock', () => {
    expect(isEventVisibleTo({ targetGroups: ['new_family'] }, { entityIds: [] })).toBe(true)
    expect(isEventVisibleTo({ targetGroups: ['host_family'] }, { entityIds: [] })).toBe(true)
  })

  it('shows a class event to the whole community, as the calendar does', () => {
    expect(isEventVisibleTo({ targetGroups: ['class'], classIds: ['class-9'] }, { entityIds: [] })).toBe(true)
  })

  it('shows a members-only event only to a current member of that entity', () => {
    const ev = { targetGroups: ['members'], committeeId: 'comm1' }
    expect(isEventVisibleTo(ev, { entityIds: ['comm1'] })).toBe(true)
    expect(isEventVisibleTo(ev, { entityIds: ['comm2'] })).toBe(false)
    expect(isEventVisibleTo(ev, { entityIds: [] })).toBe(false)
  })

  it('handles a members-only group event the same way', () => {
    const ev = { targetGroups: ['members'], groupId: 'grp1' }
    expect(isEventVisibleTo(ev, { entityIds: ['grp1'] })).toBe(true)
    expect(isEventVisibleTo(ev, { entityIds: [] })).toBe(false)
  })

  it('hides a members-only event with no owning entity rather than leaking it', () => {
    expect(isEventVisibleTo({ targetGroups: ['members'] }, { entityIds: ['comm1'] })).toBe(false)
  })

  it('is false for a missing event', () => {
    expect(isEventVisibleTo(null, { entityIds: [] })).toBe(false)
  })
})

describe('isUpcoming', () => {
  it('keeps today and the future, drops yesterday', () => {
    expect(isUpcoming({ date: '2026-08-03' }, '2026-08-03')).toBe(true)
    expect(isUpcoming({ date: '2026-08-04' }, '2026-08-03')).toBe(true)
    expect(isUpcoming({ date: '2026-08-02' }, '2026-08-03')).toBe(false)
  })

  it('keeps an undated event — unscheduled is not past', () => {
    expect(isUpcoming({}, '2026-08-03')).toBe(true)
  })
})

describe('todayKey', () => {
  it('formats the local date, not UTC', () => {
    // 23:30 local on the 3rd is still the 3rd, even though it is the 4th in UTC
    expect(todayKey(new Date(2026, 7, 3, 23, 30))).toBe('2026-08-03')
    expect(todayKey(new Date(2026, 0, 9))).toBe('2026-01-09')
  })
})
