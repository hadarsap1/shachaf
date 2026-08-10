// Onboarding tasks are BROADCAST: one document per task, addressed to an
// audience through `targetGroups` (+ `classIds` when the audience is a class).
// There is no per-family task document.
//
// Completion, therefore, cannot live in the task's own `status` field — that
// field belongs to the task itself (the admin board), and a family ticking it
// would mark the task done for the whole school. Each family's progress is
// recorded by uid inside `doneBy` / `inProgressBy`, so hundreds of families
// share one document without overwriting each other.

// Does this task address the given family?
export function taskAppliesTo(task, { role, classIds = [] }) {
  const groups = task?.targetGroups || ['all']
  if (groups.includes('all')) return true
  if (role && groups.includes(role)) return true
  if (groups.includes('class')) return (task?.classIds || []).some(id => classIds.includes(id))
  return false
}

// This family's own progress on a shared task.
export function taskStatusFor(task, uid) {
  if (!uid) return 'pending'
  if ((task?.doneBy || []).includes(uid)) return 'done'
  if ((task?.inProgressBy || []).includes(uid)) return 'in_progress'
  return 'pending'
}

// The tasks a family should see, each carrying that family's own status in
// `status` so every existing consumer (TaskCard, filters, progress rings) keeps
// reading one field and needs to know nothing about the arrays.
export function tasksForFamily(allTasks, { uid, role, classIds = [] }) {
  return (allTasks || [])
    .filter(task => taskAppliesTo(task, { role, classIds }))
    .map(task => ({ ...task, status: taskStatusFor(task, uid) }))
}

// The write that moves one family between states, as field updates. Kept here
// so the rule that guards it (`doneBy`/`inProgressBy` may only gain or lose the
// caller's own uid) has exactly one counterpart in the client.
export function taskProgressUpdate(status, uid, { arrayUnion, arrayRemove }) {
  if (status === 'done') {
    return { doneBy: arrayUnion(uid), inProgressBy: arrayRemove(uid) }
  }
  if (status === 'in_progress') {
    return { inProgressBy: arrayUnion(uid), doneBy: arrayRemove(uid) }
  }
  return { doneBy: arrayRemove(uid), inProgressBy: arrayRemove(uid) }
}
