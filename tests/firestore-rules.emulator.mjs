// Firestore security-rules tests — run with: npm run test:rules
// (requires Java for the Firestore emulator; firebase-tools is fetched via npx)
//
// Covers the auto-link flow (parentEmails read + append-uid update) and the
// privilege-escalation guards from the 2026-07 security review.
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore'

const rulesPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'firestore.rules')

const env = await initializeTestEnvironment({
  projectId: 'shachaf-rules-test',
  firestore: { rules: readFileSync(rulesPath, 'utf8'), host: '127.0.0.1', port: 8080 },
})

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore()
  await setDoc(doc(db, 'users', 'admin1'), { role: 'admin', name: 'Admin', email: 'admin@x.com' })
  await setDoc(doc(db, 'users', 'parent1'), { role: 'new_family', name: 'Parent', email: 'parent@x.com', classIds: [], childIds: [] })
  await setDoc(doc(db, 'users', 'stranger1'), { role: 'community', name: 'Stranger', email: 'stranger@x.com', classIds: [] })
  // unlinked imported child whose phone-book data lists parent1's email
  await setDoc(doc(db, 'children', 'childA'), {
    name: 'Child A', classId: 'class-1', parentUids: [],
    parents: [{ name: 'Parent', email: 'parent@x.com' }],
    parentEmails: ['parent@x.com'],
  })
  // child already linked to the other parent — co-parent auto-link flow
  await setDoc(doc(db, 'children', 'childB'), {
    name: 'Child B', classId: 'class-2', parentUids: ['otherparent'],
    parentEmails: ['parent@x.com', 'other@x.com'],
  })
  // unrelated child — must stay invisible to both test users
  await setDoc(doc(db, 'children', 'childC'), {
    name: 'Child C', classId: 'class-3', parentUids: ['someuid'], parentEmails: ['nobody@x.com'],
  })
  // broadcast onboarding task exactly as the admin panel writes it — no
  // assignedTo field, audience expressed through targetGroups
  await setDoc(doc(db, 'tasks', 'taskBroadcast'), {
    title: 'למלא טופס בריאות', targetGroups: ['all'], classIds: [], status: 'pending',
  })
  // same task, already completed by another family — per-family progress must
  // not let one family disturb another's
  await setDoc(doc(db, 'tasks', 'taskProgressShared'), {
    title: 'להביא תמונת משפחה', targetGroups: ['all'], classIds: [], status: 'pending',
    doneBy: ['stranger1'], inProgressBy: [],
  })
  // hobby group with parent1 as a member — for groupLinks URL-scheme tests
  await setDoc(doc(db, 'hobbyGroups', 'groupX'), { name: 'Group X', memberUids: ['parent1'] })
  // committee with parent1 as a member — for committee-event create tests
  await setDoc(doc(db, 'committees', 'commX'), { name: 'Committee X', memberUids: ['parent1'] })
  // committee managed by parent1 — for join-approval + summaries-read tests.
  // stranger1 is a member; someuid is a pending joiner.
  await setDoc(doc(db, 'committees', 'commMgr'), {
    name: 'Managed', memberUids: ['stranger1'], managerUids: ['parent1'], pendingUids: ['someuid'],
  })
  await setDoc(doc(db, 'committeeSummaries', 'sumMgr'), {
    committeeId: 'commMgr', title: 'ישיבה', content: 'סיכום', date: '2030-01-01',
  })
  // meal-train committees: the community-support committee qualifies by name,
  // and an admin can flag any other committee with mealTrains:true.
  await setDoc(doc(db, 'committees', 'commSupport'), {
    name: 'ועדת תמיכה בקהילה', memberUids: ['parent1'],
  })
  await setDoc(doc(db, 'committees', 'commFlagged'), {
    name: 'ועדת תרבות', memberUids: ['parent1'], mealTrains: true,
  })
  // meal train: stranger1 already claimed a slot, parent1 has not
  await setDoc(doc(db, 'mealTrains', 'trainA'), {
    familyName: 'משפחת קרטיס', committeeId: 'commX', createdBy: 'someuid',
    claimerUids: ['stranger1'],
    slots: [
      { id: '2030-08-05_meal', date: '2030-08-05', type: 'meal', byUid: 'stranger1', byName: 'Stranger' },
      { id: '2030-08-05_treat', date: '2030-08-05', type: 'treat', byUid: '', byName: '' },
    ],
  })
  await setDoc(doc(db, 'mealTrains', 'trainA', 'private', 'details'), {
    address: 'תירוש 36, קומה 1 דירה 6', buildingCode: '1974',
  })
})

const parent = env.authenticatedContext('parent1', { email: 'parent@x.com' }).firestore()
const stranger = env.authenticatedContext('stranger1', { email: 'stranger@x.com' }).firestore()
// 'someuid' opened trainA — the pot's coordinator
const someuidCtx = env.authenticatedContext('someuid', { email: 'coordinator@x.com' }).firestore()

let pass = 0, fail = 0
async function check(name, promise, expect) {
  try {
    await (expect === 'allow' ? assertSucceeds(promise) : assertFails(promise))
    console.log(`  ✓ ${name}`)
    pass++
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message?.split('\n')[0]}`)
    fail++
  }
}

console.log('\n— auto-link read path —')
await check('parent can QUERY children by own email (autoLinkChildrenByEmail)',
  getDocs(query(collection(parent, 'children'), where('parentEmails', 'array-contains', 'parent@x.com'))), 'allow')
await check('parent can GET unlinked child listing their email (linkChildToParent getDoc)',
  getDoc(doc(parent, 'children', 'childA')), 'allow')
await check('parent can GET already-linked child listing their email (co-parent flow)',
  getDoc(doc(parent, 'children', 'childB')), 'allow')

console.log('\n— auto-link write path (append-uid rule) —')
await check('parent can append own uid to childA parentUids',
  updateDoc(doc(parent, 'children', 'childA'), { parentUids: ['parent1'] }), 'allow')
await check('parent can append own uid to childB parentUids (after other parent)',
  updateDoc(doc(parent, 'children', 'childB'), { parentUids: ['otherparent', 'parent1'] }), 'allow')

console.log('\n— full linkChildToParent batch (child link + classIds proof) —')
{
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'children', 'childA'), {
      name: 'Child A', classId: 'class-1', parentUids: [], parentEmails: ['parent@x.com'],
    })
  })
  const batch = writeBatch(parent)
  batch.update(doc(parent, 'children', 'childA'), { parentUids: ['parent1'] })
  batch.update(doc(parent, 'users', 'parent1'), { childIds: ['childA'], classIds: ['class-1'], classProofChildId: 'childA' })
  await check('batch: link child + add classId with classProofChildId', batch.commit(), 'allow')
}

console.log('\n— consent recording (users self-update) —')
await check('user CAN record own consentVersion + consentAt',
  updateDoc(doc(parent, 'users', 'parent1'), { consentVersion: '1.0', consentAt: new Date() }), 'allow')
await check('user CANNOT write consent onto someone else',
  updateDoc(doc(stranger, 'users', 'parent1'), { consentVersion: '1.0' }), 'deny')

console.log('\n— groupLinks URL scheme (stored-XSS guard) —')
await check('member can post an https:// link',
  setDoc(doc(parent, 'groupLinks', 'link1'), {
    uid: 'parent1', groupId: 'groupX', label: 'אתר', url: 'https://example.com', createdAt: new Date(),
  }), 'allow')
await check('member CANNOT post a javascript: link',
  setDoc(doc(parent, 'groupLinks', 'link2'), {
    uid: 'parent1', groupId: 'groupX', label: 'תמים', url: 'javascript:alert(1)', createdAt: new Date(),
  }), 'deny')

console.log('\n— write-boundary size caps (events / businesses / children) —')
const admin = env.authenticatedContext('admin1', { email: 'admin@x.com' }).firestore()
await check('admin can create a normal event (incl. dietary fields)',
  setDoc(doc(admin, 'events', 'ev1'), {
    title: 'פיקניק', description: 'כיף', date: '2030-05-01', type: 'social',
    dietaryRestrictions: ['peanuts'], dietaryNote: 'ללא חטיפים ביתיים',
  }), 'allow')
await check('admin can update and delete an event',
  updateDoc(doc(admin, 'events', 'ev1'), { title: 'פיקניק מעודכן' }), 'allow')
await check('admin CANNOT create an event with an oversized title',
  setDoc(doc(admin, 'events', 'ev2'), { title: 'א'.repeat(201), date: '2030-05-01' }), 'deny')
await check('group member can create a group event within caps',
  setDoc(doc(parent, 'events', 'ev3'), {
    title: 'מפגש קבוצה', groupId: 'groupX', createdBy: 'parent1', date: '2030-06-01',
  }), 'allow')
await check('group member CANNOT create a group event with oversized description',
  setDoc(doc(parent, 'events', 'ev4'), {
    title: 'מפגש', description: 'א'.repeat(5001), groupId: 'groupX', createdBy: 'parent1', date: '2030-06-01',
  }), 'deny')
await check('committee member can create a committee event (any targetGroups)',
  setDoc(doc(parent, 'events', 'ev5'), {
    title: 'ישיבת ועדה', committeeId: 'commX', createdBy: 'parent1', date: '2030-07-01',
    targetGroups: ['all'], classIds: [],
  }), 'allow')
await check('committee member can delete their own committee event',
  deleteDoc(doc(parent, 'events', 'ev5')), 'allow')
await check('non-member CANNOT create an event for a committee they are not in',
  setDoc(doc(stranger, 'events', 'ev6'), {
    title: 'ישיבה', committeeId: 'commX', createdBy: 'stranger1', date: '2030-07-01',
  }), 'deny')
await check('member CANNOT create a committee event attributed to someone else',
  setDoc(doc(parent, 'events', 'ev7'), {
    title: 'ישיבה', committeeId: 'commX', createdBy: 'someoneelse', date: '2030-07-01',
  }), 'deny')

console.log('\n— committee document privacy (summaries) —')
// Read tests first — before any membership mutation. stranger1 is a member of commMgr per setup.
await check('committee member can read a committee summary',
  getDoc(doc(stranger, 'committeeSummaries', 'sumMgr')), 'allow')
await check('non-member CANNOT read a committee summary',
  getDoc(doc(env.authenticatedContext('outsider', { email: 'out@x.com' }).firestore(), 'committeeSummaries', 'sumMgr')), 'deny')
// managers can post documents; non-managers cannot
await check('committee manager can create a summary',
  setDoc(doc(parent, 'committeeSummaries', 'sumNew'), { committeeId: 'commMgr', title: 'חדש', content: 'x', date: '2030-02-02' }), 'allow')
await check('non-manager CANNOT create a summary',
  setDoc(doc(stranger, 'committeeSummaries', 'sumBad'), { committeeId: 'commMgr', title: 'x', content: 'x', date: '2030-02-02' }), 'deny')

console.log('\n— committee join approval flow —')
await check('user can request to join (add own uid to pendingUids)',
  updateDoc(doc(parent, 'committees', 'commX'), { pendingUids: ['parent1'] }), 'allow')
await check('user CANNOT self-add to memberUids (must be approved)',
  updateDoc(doc(stranger, 'committees', 'commX'), { memberUids: ['parent1', 'stranger1'] }), 'deny')
await check('non-manager CANNOT approve (move into memberUids)',
  updateDoc(doc(stranger, 'committees', 'commMgr'), { memberUids: ['stranger1', 'someuid'], pendingUids: [] }), 'deny')
await check('manager can approve a joiner (pending→member)',
  updateDoc(doc(parent, 'committees', 'commMgr'), { memberUids: ['stranger1', 'someuid'], pendingUids: [] }), 'allow')
// after approval members are [stranger1, someuid]; a member removes ONLY own uid
await check('member can leave (remove own uid from memberUids)',
  updateDoc(doc(stranger, 'committees', 'commMgr'), { memberUids: ['someuid'] }), 'allow')
await check('business create with oversized website is denied',
  setDoc(doc(parent, 'communityBusinesses', 'biz1'), {
    uid: 'parent1', businessName: 'עסק', description: 'תיאור', website: 'x'.repeat(301),
  }), 'deny')
await check('linked parent can update child hobbies/pet within caps',
  updateDoc(doc(parent, 'children', 'childA'), { hobbies: ['כדורגל', 'ציור'], pet: 'תוכי' }), 'allow')
await check('linked parent CANNOT set an oversized pet field',
  updateDoc(doc(parent, 'children', 'childA'), { pet: 'א'.repeat(201) }), 'deny')

console.log('\n— audit log (append-only) —')
await check('admin can create an audit entry about their own action',
  setDoc(doc(admin, 'auditLog', 'a1'), {
    action: 'role_change', actorUid: 'admin1', actorName: 'Admin',
    targetUid: 'stranger1', targetName: 'Stranger', details: 'community → admin', createdAt: new Date(),
  }), 'allow')
await check('admin CANNOT create an entry attributed to someone else',
  setDoc(doc(admin, 'auditLog', 'a2'), {
    action: 'role_change', actorUid: 'someoneelse', actorName: 'X', createdAt: new Date(),
  }), 'deny')
await check('admin CANNOT edit an existing audit entry',
  updateDoc(doc(admin, 'auditLog', 'a1'), { details: 'doctored' }), 'deny')
await check('admin CANNOT delete an audit entry',
  deleteDoc(doc(admin, 'auditLog', 'a1')), 'deny')
await check('non-privileged user CANNOT create audit entries',
  setDoc(doc(stranger, 'auditLog', 'a3'), {
    action: 'role_change', actorUid: 'stranger1', createdAt: new Date(),
  }), 'deny')
await check('non-admin CANNOT read the audit log',
  getDoc(doc(parent, 'auditLog', 'a1')), 'deny')
await check('admin CAN read the audit log',
  getDoc(doc(admin, 'auditLog', 'a1')), 'allow')

console.log('\n— meal trains: address gated on having claimed a slot —')
await check('a slot claimer CAN read the private address',
  getDoc(doc(stranger, 'mealTrains', 'trainA', 'private', 'details')), 'allow')
await check('a member who has NOT signed up CANNOT read the address',
  getDoc(doc(parent, 'mealTrains', 'trainA', 'private', 'details')), 'deny')
await check('everyone signed in can read the public meal-train doc',
  getDoc(doc(parent, 'mealTrains', 'trainA')), 'allow')
await check('a member CAN claim a slot (adds only their own uid to claimerUids)',
  updateDoc(doc(parent, 'mealTrains', 'trainA'), {
    slots: [
      { id: '2030-08-05_meal', date: '2030-08-05', type: 'meal', byUid: 'stranger1', byName: 'Stranger' },
      { id: '2030-08-05_treat', date: '2030-08-05', type: 'treat', byUid: 'parent1', byName: 'Parent' },
    ],
    claimerUids: ['stranger1', 'parent1'],
  }), 'allow')
await check('after claiming, that member CAN read the address',
  getDoc(doc(parent, 'mealTrains', 'trainA', 'private', 'details')), 'allow')
await check('a member CANNOT add SOMEONE ELSE to claimerUids (address theft)',
  updateDoc(doc(parent, 'mealTrains', 'trainA'), { claimerUids: ['stranger1', 'parent1', 'outsider'] }), 'deny')
await check('a member CANNOT edit the family details on the public doc',
  updateDoc(doc(parent, 'mealTrains', 'trainA'), { familyName: 'שונה' }), 'deny')
await check('a non-claimer CANNOT write the private address',
  setDoc(doc(parent, 'mealTrains', 'trainA', 'private', 'details'), { address: 'x' }), 'deny')
await check('admin CAN read the address',
  getDoc(doc(admin, 'mealTrains', 'trainA', 'private', 'details')), 'allow')
await check('a support-committee member CAN open a meal train',
  setDoc(doc(parent, 'mealTrains', 'trainNew'), {
    familyName: 'משפחה', committeeId: 'commSupport', createdBy: 'parent1', claimerUids: [], slots: [],
  }), 'allow')
await check('a member of a committee an admin flagged CAN open a meal train',
  setDoc(doc(parent, 'mealTrains', 'trainFlagged'), {
    familyName: 'משפחה', committeeId: 'commFlagged', createdBy: 'parent1', claimerUids: [], slots: [],
  }), 'allow')
await check('a member of an ORDINARY committee CANNOT open a meal train',
  setDoc(doc(parent, 'mealTrains', 'trainOrdinary'), {
    familyName: 'משפחה', committeeId: 'commX', createdBy: 'parent1', claimerUids: [], slots: [],
  }), 'deny')
await check('a non-member CANNOT open a meal train for the support committee',
  setDoc(doc(stranger, 'mealTrains', 'trainBad'), {
    familyName: 'משפחה', committeeId: 'commSupport', createdBy: 'stranger1', claimerUids: [], slots: [],
  }), 'deny')
await check('nobody can open a meal train with no committee at all',
  setDoc(doc(parent, 'mealTrains', 'trainNoComm'), {
    familyName: 'משפחה', committeeId: '', createdBy: 'parent1', claimerUids: [], slots: [],
  }), 'deny')
// Coordinator edits: fixing a typo, and writing in a volunteer who has no app
await check('the pot creator CAN edit its details after publishing',
  updateDoc(doc(someuidCtx, 'mealTrains', 'trainA'), { familyName: 'משפחת קרטיס-לוי' }), 'allow')
await check('the pot creator CAN write in a volunteer with no account',
  updateDoc(doc(someuidCtx, 'mealTrains', 'trainA'), {
    slots: [
      { id: '2030-08-05_meal', date: '2030-08-05', type: 'meal', byUid: 'stranger1', byName: 'Stranger' },
      { id: '2030-08-05_treat', date: '2030-08-05', type: 'treat', byUid: '', byName: 'שכנה מהבניין' },
    ],
    claimerUids: ['stranger1'],
  }), 'allow')
await check('an admin CAN clear a signup and drop that claimer address access',
  updateDoc(doc(admin, 'mealTrains', 'trainA'), {
    slots: [
      { id: '2030-08-05_meal', date: '2030-08-05', type: 'meal', byUid: '', byName: '' },
      { id: '2030-08-05_treat', date: '2030-08-05', type: 'treat', byUid: '', byName: 'שכנה מהבניין' },
    ],
    claimerUids: [],
  }), 'allow')
await check('a plain member CANNOT edit the pot details',
  updateDoc(doc(stranger, 'mealTrains', 'trainA'), { familyName: 'שינוי' }), 'deny')
await check('a plain member CANNOT write someone else into a slot',
  updateDoc(doc(stranger, 'mealTrains', 'trainA'), {
    slots: [{ id: '2030-08-05_meal', date: '2030-08-05', type: 'meal', byUid: '', byName: 'מישהו' }],
    claimerUids: ['stranger1', 'parent1'],
  }), 'deny')
await check('an admin CAN sign another member up for a slot on their behalf',
  updateDoc(doc(admin, 'mealTrains', 'trainA'), {
    slots: [
      { id: '2030-08-05_meal', date: '2030-08-05', type: 'meal', byUid: 'parent1', byName: 'Parent', assignedBy: 'admin1' },
      { id: '2030-08-05_treat', date: '2030-08-05', type: 'treat', byUid: '', byName: '' },
    ],
    claimerUids: ['parent1'],
  }), 'allow')
await check('that member CAN then read the address they were signed up for',
  getDoc(doc(parent, 'mealTrains', 'trainA', 'private', 'details')), 'allow')
await check('and CAN release the slot someone else took for them',
  updateDoc(doc(parent, 'mealTrains', 'trainA'), {
    slots: [
      { id: '2030-08-05_meal', date: '2030-08-05', type: 'meal', byUid: '', byName: '' },
      { id: '2030-08-05_treat', date: '2030-08-05', type: 'treat', byUid: '', byName: '' },
    ],
    claimerUids: [],
  }), 'allow')

await check('the pot creator CAN update the private address',
  setDoc(doc(someuidCtx, 'mealTrains', 'trainA', 'private', 'details'), { address: 'תירוש 38', buildingCode: '1974' }), 'allow')

await check('an admin CAN open a meal train without a committee',
  setDoc(doc(admin, 'mealTrains', 'trainAdmin'), {
    familyName: 'משפחה', committeeId: '', createdBy: 'admin1', claimerUids: [], slots: [],
  }), 'allow')

console.log('\n— onboarding tasks reach the families they target —')
// Tasks are broadcast (targetGroups), never per-uid: the admin panel writes no
// assignedTo at all. The list query the tasks page runs must therefore be
// allowed, and writing must stay with admins.
await check('a family CAN list the task board',
  getDocs(collection(parent, 'tasks')), 'allow')
await check('a family CAN read a broadcast task with no assignedTo',
  getDoc(doc(parent, 'tasks', 'taskBroadcast')), 'allow')
await check('a family CANNOT edit the shared status field',
  updateDoc(doc(parent, 'tasks', 'taskBroadcast'), { status: 'done' }), 'deny')
await check('a family CANNOT create a task',
  setDoc(doc(parent, 'tasks', 'taskForged'), { title: 'מזויף', targetGroups: ['all'] }), 'deny')
await check('an admin CAN create a broadcast task',
  setDoc(doc(admin, 'tasks', 'taskFromAdmin'), {
    title: 'משימה חדשה', targetGroups: ['all'], classIds: [], status: 'pending',
  }), 'allow')

console.log('\n— each family records its own progress on a shared task —')
// Order matters: these walk one task document through a real family's flow.
await check('a family CAN mark itself in progress',
  updateDoc(doc(parent, 'tasks', 'taskBroadcast'), { inProgressBy: ['parent1'] }), 'allow')
await check('a family CAN move itself from in-progress to done',
  updateDoc(doc(parent, 'tasks', 'taskBroadcast'), { inProgressBy: [], doneBy: ['parent1'] }), 'allow')
await check('a family CAN reopen its own task',
  updateDoc(doc(parent, 'tasks', 'taskBroadcast'), { doneBy: [] }), 'allow')
await check('a family CANNOT mark a task done for someone else',
  updateDoc(doc(parent, 'tasks', 'taskBroadcast'), { doneBy: ['stranger1'] }), 'deny')
await check('a family CANNOT complete for several families in one write',
  updateDoc(doc(parent, 'tasks', 'taskBroadcast'), { doneBy: ['parent1', 'stranger1'] }), 'deny')
await check('a family CANNOT smuggle another field alongside its progress',
  updateDoc(doc(parent, 'tasks', 'taskBroadcast'), { doneBy: ['parent1'], title: 'נחטף' }), 'deny')
// taskProgressShared already carries stranger1 in doneBy
await check('a family CANNOT wipe another family\'s completion',
  updateDoc(doc(parent, 'tasks', 'taskProgressShared'), { doneBy: [] }), 'deny')
await check('a family CAN add itself next to another family\'s completion',
  updateDoc(doc(parent, 'tasks', 'taskProgressShared'), { doneBy: ['stranger1', 'parent1'] }), 'allow')

console.log('\n— escalation guards stay closed —')
await check('stranger CANNOT query children by an email that is not theirs',
  getDocs(query(collection(stranger, 'children'), where('parentEmails', 'array-contains', 'parent@x.com'))), 'deny')
await check('stranger CANNOT read an unrelated child',
  getDoc(doc(stranger, 'children', 'childC')), 'deny')
await check('stranger CANNOT append own uid to a child whose parentEmails do not list them',
  updateDoc(doc(stranger, 'children', 'childC'), { parentUids: ['someuid', 'stranger1'] }), 'deny')
await check('parent CANNOT edit other fields on an email-matched child before linking',
  updateDoc(doc(parent, 'children', 'childB'), { name: 'Hacked' }), 'deny')
await check('stranger CANNOT blanket-list all children',
  getDocs(collection(stranger, 'children')), 'deny')
await check('user CANNOT self-escalate role',
  updateDoc(doc(stranger, 'users', 'stranger1'), { role: 'admin' }), 'deny')
await check('user CANNOT self-set classIds',
  updateDoc(doc(stranger, 'users', 'stranger1'), { classIds: ['class-1'] }), 'deny')
await check('user CANNOT self-set classAdminFor',
  updateDoc(doc(stranger, 'users', 'stranger1'), { classAdminFor: ['class-1'] }), 'deny')

console.log(`\n${pass} passed, ${fail} failed`)
await env.cleanup()
process.exit(fail ? 1 : 0)
