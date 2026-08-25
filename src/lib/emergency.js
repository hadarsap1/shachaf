// Pure helpers for the emergency routine (lessons / learning groups / playdates).
// No React, no Firebase — safe to unit-test.

export const EMPTY_DAY = { slots: [], groups: [], playdates: [] }

// Local date as 'YYYY-MM-DD'. NOT toISOString() — that returns UTC, which is the
// previous day in Israel until 02:00/03:00 local.
export function toDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Shift a 'YYYY-MM-DD' string by n days (n may be negative).
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

export const today = () => toDateStr()
export const tomorrow = () => addDays(toDateStr(), 1)

export function formatDayLabel(dateStr) {
  return new Date(dateStr + 'T00:00:00')
    .toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
}

// A stored day doc may predate the groups/playdates fields — fill the gaps.
export function normalizeDay(data) {
  return {
    slots: data?.slots || [],
    groups: data?.groups || [],
    playdates: data?.playdates || [],
  }
}

export function isDayEmpty(day) {
  const d = normalizeDay(day)
  return !d.slots.length && !d.groups.length && !d.playdates.length
}

// A group / playdate with no children listed is for the whole class; otherwise
// only families with a child on the list should see it.
export function visibleFor(item, myChildIds) {
  const ids = item?.childIds || []
  return ids.length === 0 || ids.some(id => myChildIds.includes(id))
}

// Names of the children on an item, for display. Unknown ids are dropped
// (a child may have been removed from the class since the group was built).
export function childNames(item, childrenById) {
  return (item?.childIds || []).map(id => childrenById[id]?.name).filter(Boolean)
}
