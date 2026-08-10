// Anomaly detection for registration/onboarding health — used by the
// super-admin health page and the sidebar badge.
import { hasConsented } from './consent'

// Why a family shows up under "did not finish onboarding".
//
// `onboardingComplete` is written in exactly one place — the last button of the
// onboarding wizard ("כניסה לאפליקציה"). A family that linked its children,
// filled in a phone and approved the terms, then closed the tab on the final
// screen, is flagged the same as one that never started; so is a member an
// admin created by hand, who never saw the wizard at all. "Did not finish"
// alone therefore does not tell an admin whether anything is actually missing.
//
// This returns the gaps that are real, and says when there are none — the case
// where there is nothing to chase and the record can simply be closed.
export function onboardingGaps(user, { children = [] } = {}) {
  const gaps = []
  const hasChild = children.some(c => (c.parentUids || []).includes(user.uid))
  const classIds = new Set([
    ...(user.classIds || []),
    ...children.filter(c => (c.parentUids || []).includes(user.uid)).map(c => c.classId).filter(Boolean),
  ])

  if (!hasChild) gaps.push('לא שויכו ילדים')
  if (classIds.size === 0) gaps.push('אין כיתה')
  if (!user.phone) gaps.push('אין טלפון')
  if (!hasConsented(user)) gaps.push('לא אישרו את התקנון')

  return {
    gaps,
    // Everything a family is asked for exists — only the wizard's final tap is
    // missing. Nothing to chase.
    onlyFinalStep: gaps.length === 0,
  }
}

// The families an admin can close in one action: flagged as unfinished, but
// with every detail already on file. Closing them only stops the wizard
// redirect and clears the flag — it never hides a family that is missing
// something.
export function closableOnboarding(onboardingIncomplete = [], children = []) {
  return onboardingIncomplete.filter(u => onboardingGaps(u, { children }).onlyFinalStep)
}

export function computeHealthAnomalies({ users = [], children = [], classes = [], pending = [] }) {
  // Alumni are intentionally detached (no children/classes) — not anomalies
  const members = users.filter(u => u.role !== 'admin' && u.role !== 'super_admin' && u.status !== 'alumni')
  const parentsWithChild = new Set(children.flatMap(c => c.parentUids || []))

  const importedNeverRegistered = pending
  const awaitingApproval = members.filter(u => u.status === 'pending')
  const onboardingIncomplete = members.filter(u =>
    (u.role === 'new_family' || (u.roles || []).includes('new_family'))
    && !u.onboardingComplete && u.status !== 'pending'
  )
  const parentsNoChildren = members.filter(u =>
    (u.role === 'new_family' || u.role === 'host_family'
      || (u.roles || []).some(r => r === 'new_family' || r === 'host_family'))
    && !parentsWithChild.has(u.uid)
  )
  const unlinkedChildren = children.filter(c => (c.parentUids || []).length === 0)
  const childrenNoClass = children.filter(c => !c.classId)
  const classesNoAdmin = classes.filter(c => (c.adminUids || []).length === 0)
  const staleClassIds = members.filter(u => {
    const derived = new Set(children.filter(c => (c.parentUids || []).includes(u.uid)).map(c => c.classId).filter(Boolean))
    return (u.classIds || []).some(id => !derived.has(id))
  })
  // Imported (pre-2026-07) new_family users without the imported flag can't
  // browse the unlinked-children roster during onboarding
  const missingImportedFlag = members.filter(u =>
    u.role === 'new_family' && !u.imported && !u.onboardingComplete && !parentsWithChild.has(u.uid)
  )

  const anomalies = {
    importedNeverRegistered, awaitingApproval, onboardingIncomplete,
    parentsNoChildren, unlinkedChildren, childrenNoClass,
    classesNoAdmin, staleClassIds, missingImportedFlag,
  }
  const total = Object.values(anomalies).reduce((n, list) => n + list.length, 0)
  return { ...anomalies, total }
}
