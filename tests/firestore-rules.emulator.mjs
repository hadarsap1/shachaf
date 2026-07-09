// Firestore security-rules tests — run with: npm run test:rules
// (requires Java for the Firestore emulator; firebase-tools is fetched via npx)
//
// Covers the auto-link flow (parentEmails read + append-uid update) and the
// privilege-escalation guards from the 2026-07 security review.
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, writeBatch } from 'firebase/firestore'

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
  // hobby group with parent1 as a member — for groupLinks URL-scheme tests
  await setDoc(doc(db, 'hobbyGroups', 'groupX'), { name: 'Group X', memberUids: ['parent1'] })
})

const parent = env.authenticatedContext('parent1', { email: 'parent@x.com' }).firestore()
const stranger = env.authenticatedContext('stranger1', { email: 'stranger@x.com' }).firestore()

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
await check('business create with oversized website is denied',
  setDoc(doc(parent, 'communityBusinesses', 'biz1'), {
    uid: 'parent1', businessName: 'עסק', description: 'תיאור', website: 'x'.repeat(301),
  }), 'deny')
await check('linked parent can update child hobbies/pet within caps',
  updateDoc(doc(parent, 'children', 'childA'), { hobbies: ['כדורגל', 'ציור'], pet: 'תוכי' }), 'allow')
await check('linked parent CANNOT set an oversized pet field',
  updateDoc(doc(parent, 'children', 'childA'), { pet: 'א'.repeat(201) }), 'deny')

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
