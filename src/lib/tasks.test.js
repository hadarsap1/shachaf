import { describe, it, expect } from 'vitest'
import { taskAppliesTo, taskStatusFor, tasksForFamily, taskProgressUpdate } from './tasks'

describe('taskAppliesTo', () => {
  const family = { role: 'new_family', classIds: ['class-1'] }

  it('a task with no targeting reaches everyone', () => {
    expect(taskAppliesTo({}, family)).toBe(true)
  })

  it('targetGroups: all reaches everyone', () => {
    expect(taskAppliesTo({ targetGroups: ['all'] }, family)).toBe(true)
  })

  it('a role-targeted task reaches only that role', () => {
    expect(taskAppliesTo({ targetGroups: ['new_family'] }, family)).toBe(true)
    expect(taskAppliesTo({ targetGroups: ['host_family'] }, family)).toBe(false)
  })

  it('a class-targeted task reaches only families in that class', () => {
    const task = { targetGroups: ['class'], classIds: ['class-1'] }
    expect(taskAppliesTo(task, family)).toBe(true)
    expect(taskAppliesTo(task, { role: 'new_family', classIds: ['class-2'] })).toBe(false)
    expect(taskAppliesTo(task, { role: 'new_family' })).toBe(false)
  })
})

describe('taskStatusFor', () => {
  it('is pending when the family appears in neither list', () => {
    expect(taskStatusFor({ doneBy: ['other'], inProgressBy: [] }, 'me')).toBe('pending')
    expect(taskStatusFor({}, 'me')).toBe('pending')
  })

  it('reads done and in_progress from the family\'s own uid', () => {
    expect(taskStatusFor({ doneBy: ['me'] }, 'me')).toBe('done')
    expect(taskStatusFor({ inProgressBy: ['me'] }, 'me')).toBe('in_progress')
  })

  it('done wins over in_progress', () => {
    expect(taskStatusFor({ doneBy: ['me'], inProgressBy: ['me'] }, 'me')).toBe('done')
  })

  it('ignores the shared status field — one family cannot complete for another', () => {
    expect(taskStatusFor({ status: 'done', doneBy: ['someone-else'] }, 'me')).toBe('pending')
  })

  it('is pending without a uid', () => {
    expect(taskStatusFor({ doneBy: ['me'] }, null)).toBe('pending')
  })
})

describe('tasksForFamily', () => {
  const tasks = [
    { id: 'a', targetGroups: ['all'], doneBy: ['me'] },
    { id: 'b', targetGroups: ['all'], doneBy: ['other'] },
    { id: 'c', targetGroups: ['host_family'] },
    { id: 'd', targetGroups: ['class'], classIds: ['class-1'], inProgressBy: ['me'] },
  ]
  const family = { uid: 'me', role: 'new_family', classIds: ['class-1'] }

  it('keeps only the tasks addressed to the family', () => {
    expect(tasksForFamily(tasks, family).map(t => t.id)).toEqual(['a', 'b', 'd'])
  })

  it('rewrites status to the family\'s own progress', () => {
    const byId = Object.fromEntries(tasksForFamily(tasks, family).map(t => [t.id, t.status]))
    expect(byId).toEqual({ a: 'done', b: 'pending', d: 'in_progress' })
  })

  it('another family sees its own progress on the same documents', () => {
    const other = tasksForFamily(tasks, { uid: 'other', role: 'new_family', classIds: ['class-1'] })
    expect(Object.fromEntries(other.map(t => [t.id, t.status])))
      .toEqual({ a: 'pending', b: 'done', d: 'pending' })
  })

  it('handles an empty or missing list', () => {
    expect(tasksForFamily([], family)).toEqual([])
    expect(tasksForFamily(undefined, family)).toEqual([])
  })
})

describe('taskProgressUpdate', () => {
  // Stand-ins for Firestore's sentinels — the shape is what matters here.
  const arrayUnion  = (uid) => ({ add: uid })
  const arrayRemove = (uid) => ({ remove: uid })
  const ops = { arrayUnion, arrayRemove }

  it('marking done adds to doneBy and clears in-progress', () => {
    expect(taskProgressUpdate('done', 'me', ops))
      .toEqual({ doneBy: { add: 'me' }, inProgressBy: { remove: 'me' } })
  })

  it('marking in progress moves the uid the other way', () => {
    expect(taskProgressUpdate('in_progress', 'me', ops))
      .toEqual({ inProgressBy: { add: 'me' }, doneBy: { remove: 'me' } })
  })

  it('reopening removes the uid from both lists', () => {
    expect(taskProgressUpdate('pending', 'me', ops))
      .toEqual({ doneBy: { remove: 'me' }, inProgressBy: { remove: 'me' } })
  })

  it('only ever touches the two progress fields', () => {
    for (const status of ['done', 'in_progress', 'pending']) {
      expect(Object.keys(taskProgressUpdate(status, 'me', ops)).sort())
        .toEqual(['doneBy', 'inProgressBy'])
    }
  })
})
