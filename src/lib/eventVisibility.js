// One source of truth for "does this event show up for me".
//
// The dashboard used to apply a stricter rule than the calendar: it hid events
// whose targetGroups didn't include the user's role. But new_family/host_family
// are RELEVANCE markers — the events page offers them as filter chips, not as
// access control — so the same event appeared in the calendar and was missing
// from "אירועים קרובים". Both pages now ask this function.
//
// Two restrictions survive that: members-only — an event opened inside a group
// or committee for its members shows only to CURRENT members, with no admin
// bypass, so it disappears the moment someone leaves — and class targeting,
// which is an ADDRESS, not a chip: an event for the kindergartens reaches the
// kindergarten families, not the whole school.
export function isEventVisibleTo(ev, { entityIds = [], classIds = [], uid = null } = {}) {
  if (!ev) return false
  const groups = ev.targetGroups || []
  if (groups.includes('members')) {
    return (!!ev.groupId && entityIds.includes(ev.groupId))
      || (!!ev.committeeId && entityIds.includes(ev.committeeId))
  }
  // An event aimed at specific classes belongs to those classes only — a
  // kindergarten meeting has no business on a third-grader's feed. Whoever
  // opened the event still sees it, so it never vanishes on its creator.
  // A 'class' event with no classIds names no class, so it stays community-wide.
  if (groups.includes('class') && (ev.classIds || []).length > 0) {
    if (uid && ev.createdBy === uid) return true
    return (ev.classIds || []).some(id => classIds.includes(id))
  }
  return true
}

// "Upcoming" for the dashboard: today counts, yesterday doesn't. An event with
// no date is kept — it's unscheduled, not past.
export function isUpcoming(ev, todayKey) {
  if (!ev?.date) return true
  return ev.date >= todayKey
}

export function todayKey(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
