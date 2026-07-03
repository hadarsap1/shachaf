// Anomaly detection for registration/onboarding health — used by the
// super-admin health page and the sidebar badge.

export function computeHealthAnomalies({ users = [], children = [], classes = [], pending = [] }) {
  const members = users.filter(u => u.role !== 'admin' && u.role !== 'super_admin')
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
