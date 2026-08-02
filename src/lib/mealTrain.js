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

// The rota is a plain list of days, each carrying the slot types open on it —
// exactly what the sheet showed: a date, an "ארוחה" row and a "פינוק מתוק" row.
// A day is { date: 'YYYY-MM-DD', types: ['meal', 'treat'] }.
export const ALL_SLOT_TYPES = SLOT_TYPES.map(t => t.value)
const MAX_DAYS = 60

export function addDay(days, date, types = ALL_SLOT_TYPES) {
  const list = days || []
  if (!date || list.some(d => d.date === date) || list.length >= MAX_DAYS) return list
  return [...list, { date, types: [...types] }].sort((a, b) => a.date.localeCompare(b.date))
}

export function removeDay(days, date) {
  return (days || []).filter(d => d.date !== date)
}

// Turning both types off would leave a day nobody can sign up for, so the last
// one stays on — the day itself is removed with the ✕ instead.
export function toggleDayType(days, date, type) {
  return (days || []).map(d => {
    if (d.date !== date) return d
    const on = d.types.includes(type)
    if (on && d.types.length === 1) return d
    return { ...d, types: on ? d.types.filter(t => t !== type) : [...d.types, type] }
  })
}

// One slot per open type per day — the shape stored on the meal-train document.
export function buildSlots(days) {
  return (days || []).flatMap(day => {
    const date = typeof day === 'string' ? day : day?.date
    if (!date) return []
    const types = typeof day === 'string' ? ALL_SLOT_TYPES : (day.types || [])
    return ALL_SLOT_TYPES
      .filter(t => types.includes(t))
      .map(t => ({ id: `${date}_${t}`, date, type: t, byUid: '', byName: '' }))
  })
}

// A slot is taken either by an app user (byUid) or by someone the coordinator
// wrote in by hand — a neighbour or a grandparent with no account (byName only).
export function isSlotTaken(slot) {
  return !!(slot?.byUid || slot?.byName)
}

// claimerUids must always mirror the slots: it is what unlocks the address, so
// clearing someone's last slot has to drop their address access with it.
export function claimerUidsOf(slots) {
  return [...new Set((slots || []).map(s => s.byUid).filter(Boolean))]
}

// Editing a published pot rebuilds its slots from the chosen days — carry the
// existing signups across so a fixed typo doesn't wipe who volunteered.
// A signup on a day that was removed is dropped with the day.
export function mergeSlots(newSlots, oldSlots) {
  const byId = new Map((oldSlots || []).map(s => [s.id, s]))
  return (newSlots || []).map(s => {
    const old = byId.get(s.id)
    return old ? { ...s, byUid: old.byUid || '', byName: old.byName || '' } : s
  })
}

// The day list behind the editor, reconstructed from a pot's stored slots.
export function daysFromSlots(slots) {
  const byDate = new Map()
  for (const s of slots || []) {
    if (!byDate.has(s.date)) byDate.set(s.date, new Set())
    byDate.get(s.date).add(s.type)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, types]) => ({ date, types: ALL_SLOT_TYPES.filter(t => types.has(t)) }))
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

// Slots you claimed, shaped like events so they sit in the app calendar next to
// community events — a commitment you took on shouldn't live in a page you have
// to remember to open.
// The delivery address is deliberately NOT part of these entries: they can be
// exported to an external calendar, and the address is private to slot claimers.
export function myMealTrainEvents(trains, uid) {
  if (!uid) return []
  return (trains || [])
    .filter(t => t.status !== 'closed')
    .flatMap(t => (t.slots || [])
      .filter(s => s.byUid === uid)
      .map(s => {
        const type = SLOT_TYPES.find(x => x.value === s.type)
        return {
          id: `mealtrain_${t.id}_${s.id}`,
          mealTrainId: t.id,
          date: s.date,
          time: '',
          title: `🍲 ${type?.label || 'סיר לידה'} למשפחת ${t.familyName}`,
          description: `שיריינת ${type?.label || 'משבצת'} בסיר הלידה של משפחת ${t.familyName}. ` +
            'פרטי המסירה והכתובת בעמוד "סירי לידה".',
          type: 'community',
          targetGroups: ['all'],
          location: '',
          attendeeUids: [],
        }
      }))
}

// The WhatsApp call-for-help sent out when a pot opens. Carries only what the
// community already sees in the app — never the address or the entry code,
// because a forwarded message travels far beyond the people who signed up.
export function mealTrainInviteMessage(train, url) {
  if (!train) return ''
  const stats = slotStats(train.slots)
  const dates = [...new Set((train.slots || []).map(s => s.date))].sort()
  const lines = [`🍲 *סיר לידה למשפחת ${train.familyName}*`]

  if (train.babyName) lines.push(`ברוכה הבאה / ברוך הבא ${train.babyName} 👶`)
  const family = [train.parents, train.siblings].filter(Boolean).join(' · ')
  if (family) lines.push(family)

  lines.push('')
  if (train.preferences) lines.push(`*העדפות:* ${train.preferences}`)
  if (train.concept) lines.push(train.concept)
  if (train.delivery) lines.push(train.delivery)

  if (dates.length) {
    lines.push('')
    lines.push(`*התאריכים:* ${dates.map(formatSlotDate).join(' · ')}`)
  }
  if (stats.total) {
    if (stats.open === 0) lines.push('כל המשבצות שוריינו — תודה לכולם! 🎉')
    else if (stats.open === 1) lines.push(`נותרה משבצת אחת פנויה מתוך ${stats.total} 🙏`)
    else lines.push(`נותרו ${stats.open} משבצות פנויות מתוך ${stats.total} 🙏`)
  }

  lines.push('')
  lines.push('לשריון תאריך באפליקציה:')
  if (url) lines.push(url)
  if (train.contactPhone) {
    lines.push('')
    lines.push(`לתיאום: ${train.contactName || 'איש קשר'} ${train.contactPhone}`)
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// Progress for the card header: how many slots are still open
export function slotStats(slots) {
  const all = slots || []
  const taken = all.filter(isSlotTaken).length
  return { total: all.length, taken, open: all.length - taken }
}
