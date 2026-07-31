// "סיר לידה" — a meal rota the community fills in for a family with a new
// baby: recurring dates, each with a main dish slot and a sweet-treat slot,
// claimed by members one by one (modeled on the shared Google Sheet the
// community used before).

export const SLOT_TYPES = [
  { value: 'meal',  label: 'ארוחה',      hint: 'תבשיל, פשטידה, מרק או כל מה שאתם אוהבים' },
  { value: 'treat', label: 'פינוק מתוק', hint: 'עוגה, עוגיות, פירות או כל מה שאתם אוהבים' },
]

export const WEEKDAYS = [
  { value: 0, label: 'ראשון' },
  { value: 1, label: 'שני' },
  { value: 2, label: 'שלישי' },
  { value: 3, label: 'רביעי' },
  { value: 4, label: 'חמישי' },
  { value: 5, label: 'שישי' },
  { value: 6, label: 'שבת' },
]

const pad = (n) => String(n).padStart(2, '0')
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Build the dates of the rota: every selected weekday between `from` and `to`
// (inclusive). Returns sorted YYYY-MM-DD strings; invalid/empty input → [].
// Capped so a mistyped range can't generate thousands of rows.
export function generateDates({ from, to, weekdays = [] }, max = 60) {
  if (!from || !to || !weekdays.length) return []
  const start = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  if (isNaN(start) || isNaN(end) || end < start) return []
  const wanted = new Set(weekdays.map(Number))
  const out = []
  const cur = new Date(start)
  while (cur <= end && out.length < max) {
    if (wanted.has(cur.getDay())) out.push(toKey(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

// One slot per type per date — the shape stored on the meal-train document.
export function buildSlots(dates) {
  return (dates || []).flatMap(date =>
    SLOT_TYPES.map(t => ({ id: `${date}_${t.value}`, date, type: t.value, byUid: '', byName: '' }))
  )
}

// Dates in ascending order with their slots grouped — what the signup grid renders.
export function groupByDate(slots) {
  const byDate = new Map()
  for (const s of slots || []) {
    if (!byDate.has(s.date)) byDate.set(s.date, [])
    byDate.get(s.date).push(s)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({
      date,
      slots: SLOT_TYPES.map(t => list.find(s => s.type === t.value)).filter(Boolean),
    }))
}

// Hebrew "רביעי 5/08" label used across the grid
export function formatSlotDate(date) {
  const d = new Date(date + 'T00:00:00')
  if (isNaN(d)) return date
  const day = WEEKDAYS[d.getDay()]?.label || ''
  return `${day} ${d.getDate()}/${pad(d.getMonth() + 1)}`
}

// Address + building entry code are revealed only to people who actually need
// to show up: whoever claimed a slot, the family's coordinator (creator) and
// admins. Mirrored by the Firestore rule on the private/details subcollection —
// this helper only decides what the UI asks for.
export function canSeeAddress(train, uid, isAdmin = false) {
  if (!train || !uid) return false
  if (isAdmin || train.createdBy === uid) return true
  return (train.claimerUids || []).includes(uid)
}

// Who may OPEN a meal train: admins, and members of the community-support
// committee — not every committee. A committee qualifies when an admin ticked
// `mealTrains` on it, or (out of the box, before anyone configured anything)
// when its name marks it as the support committee. The same test is enforced
// in firestore.rules on mealTrains create.
export const SUPPORT_COMMITTEE_HINT = 'תמיכה'

export function isMealTrainCommittee(committee) {
  if (!committee) return false
  if (committee.mealTrains === true) return true
  return typeof committee.name === 'string' && committee.name.includes(SUPPORT_COMMITTEE_HINT)
}

// Progress for the card header: how many slots are still open
export function slotStats(slots) {
  const all = slots || []
  const taken = all.filter(s => s.byUid).length
  return { total: all.length, taken, open: all.length - taken }
}
