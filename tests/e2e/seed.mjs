// Seed data for the E2E run — writes straight into the Firestore emulator with
// security rules disabled, and creates the matching accounts in the Auth
// emulator. Imported by run.mjs; not meant to be executed on its own.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'

export const PROJECT_ID = 'shachaf-e2e'
const AUTH_HOST = '127.0.0.1:9099'

// Dates are computed relative to the run so the seeded calendar never rots.
const day = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

export const ACCOUNTS = {
  admin:    { email: 'admin@e2e.test',   password: 'Test123456', name: 'ועד ההורים' },
  // The feedback inbox is super-admin only, so the suite needs both roles.
  super:    { email: 'super@e2e.test',   password: 'Test123456', name: 'מנהל ראשי' },
  parent:   { email: 'parent@e2e.test',  password: 'Test123456', name: 'הורה קיים' },
  imported: { email: 'imported@e2e.test', password: 'Test123456', name: 'הורה מיובא' },
  // Registered through the UI during the run — no account here on purpose.
  fresh:    { email: 'fresh@e2e.test',   password: 'Test123456', name: 'משפחה חדשה לגמרי' },
}

export const SEED = {
  classId: 'class-gimel',
  className: 'ג׳',
  eventTitle: 'פיקניק פתיחת שנה',
  pastEventTitle: 'אירוע שהיה וחלף',
  taskTitle: 'למלא טופס בריאות',
  committeeName: 'ועדת תרבות',
  groupName: 'חוג ריצה',
  announcement: 'ברוכים הבאים לשנה החדשה',
  resourceTitle: 'מדריך למשפחה חדשה',
  today: day(0),
  soon: day(7),
  past: day(-30),
}

// ── Auth emulator REST helpers ────────────────────────────────────────────────
async function createAuthUser({ email, password, name }) {
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName: name, returnSecureToken: true }),
    },
  )
  if (!res.ok) throw new Error(`auth signUp failed for ${email}: ${await res.text()}`)
  const { localId } = await res.json()
  return localId
}

export async function seed() {
  const uids = {}
  for (const [key, acct] of Object.entries(ACCOUNTS)) {
    if (key === 'fresh') continue          // registers itself through the UI
    uids[key] = await createAuthUser(acct)
  }

  const env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: '127.0.0.1', port: 8080 },
  })

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const set = (path, id, data) => setDoc(doc(db, path, id), data)

    // ── Users ────────────────────────────────────────────────────────────────
    // Everyone seeded here has already consented, so their flows start at the
    // dashboard. The consent gate itself is covered by the fresh registration.
    await set('users', uids.admin, {
      uid: uids.admin, email: ACCOUNTS.admin.email, name: ACCOUNTS.admin.name,
      role: 'admin', roles: [], status: 'active', phone: '050-1111111',
      consentVersion: '1.2', consentAt: new Date(),
    })
    // A family that finished onboarding: `new_family` in `roles` is what gates
    // the task board and the forms list on the dashboard.
    await set('users', uids.super, {
      uid: uids.super, email: ACCOUNTS.super.email, name: ACCOUNTS.super.name,
      role: 'super_admin', roles: [], status: 'active',
      consentVersion: '1.2', consentAt: new Date(),
    })
    await set('users', uids.parent, {
      uid: uids.parent, email: ACCOUNTS.parent.email, name: ACCOUNTS.parent.name,
      role: 'new_family', roles: [], status: 'active', phone: '050-2222222',
      classIds: [SEED.classId], childIds: ['child-1'],
      onboardingComplete: true, tutorialSeen: true,
      consentVersion: '1.2', consentAt: new Date(),
    })
    // Matched against an admin import → lands on the pending-approval screen.
    await set('users', uids.imported, {
      uid: uids.imported, email: ACCOUNTS.imported.email, name: ACCOUNTS.imported.name,
      role: 'community', roles: [], status: 'pending', imported: true,
      consentVersion: '1.2', consentAt: new Date(),
    })

    // Two families flagged as "did not finish onboarding" for opposite
    // reasons — the health page has to tell them apart.
    // 1) Everything on file; only the wizard's last button was never pressed.
    await set('users', 'stalled-complete', {
      uid: 'stalled-complete', email: 'stalled1@e2e.test', name: 'מיכל שלמה',
      role: 'new_family', roles: [], status: 'active', phone: '050-9999999',
      classIds: [SEED.classId], consentVersion: '1.2', consentAt: new Date(),
    })
    // 2) Registered and stopped: no children, no phone, no consent.
    await set('users', 'stalled-empty', {
      uid: 'stalled-empty', email: 'stalled2@e2e.test', name: 'רון חסר',
      role: 'new_family', roles: [], status: 'active',
    })

    // ── Class + children ─────────────────────────────────────────────────────
    await set('classes', SEED.classId, {
      name: SEED.className, grade: 'ג', adminUids: [], teacherName: 'המורה רותי',
    })
    await set('children', 'child-1', {
      name: 'נועה כהן', classId: SEED.classId, parentUids: [uids.parent],
      parents: [{ name: ACCOUNTS.parent.name, email: ACCOUNTS.parent.email, phone: '050-2222222' }],
      parentEmails: [ACCOUNTS.parent.email],
    })
    await set('children', 'child-stalled', {
      name: 'ילד של מיכל', classId: SEED.classId, parentUids: ['stalled-complete'],
      parents: [{ name: 'מיכל שלמה', email: 'stalled1@e2e.test' }],
      parentEmails: ['stalled1@e2e.test'],
    })
    await set('children', 'child-2', {
      name: 'איתי לוי', classId: SEED.classId, parentUids: [],
      parents: [{ name: 'הורה אחר', email: 'other@e2e.test', phone: '050-3333333' }],
      parentEmails: ['other@e2e.test'],
    })

    // ── Content the dashboard and calendar render ────────────────────────────
    await set('events', 'event-1', {
      title: SEED.eventTitle, date: SEED.soon, time: '17:00',
      location: 'הדשא הגדול', description: 'נפגשים לפתיחת השנה',
      audience: 'all', classIds: [], attendeeUids: [], createdAt: new Date(),
    })
    await set('events', 'event-past', {
      title: SEED.pastEventTitle, date: SEED.past, time: '10:00',
      location: 'חצר בית הספר', description: 'אירוע עבר',
      audience: 'all', classIds: [], attendeeUids: [], createdAt: new Date(),
    })
    // Shaped exactly like the admin panel writes it: broadcast by targetGroups,
    // no assignedTo field anywhere.
    await set('tasks', 'task-1', {
      title: SEED.taskTitle, description: 'טופס בריאות שנתי',
      milestone: 'רישום לבית הספר', targetGroups: ['all'], classIds: [],
      status: 'pending', priority: 'high', createdAt: new Date(),
    })
    await set('announcements', 'ann-1', {
      title: SEED.announcement, body: 'שמחים לפתוח שנה חדשה יחד',
      createdAt: new Date(), createdBy: uids.admin, audience: 'all',
    })
    await set('resources', 'res-1', {
      title: SEED.resourceTitle, url: 'https://example.com/guide',
      category: 'כללי', createdAt: new Date(),
    })
    // `order` is not optional: both lists are read with orderBy('order'), and
    // Firestore silently drops documents that lack the ordered field.
    await set('committees', 'comm-1', {
      name: SEED.committeeName, description: 'אירועי קהילה ותרבות',
      icon: 'Users', color: '#1B3B70', order: 1, status: 'active',
      members: [], memberUids: [], managerUids: [], pendingUids: [],
    })
    await set('hobbyGroups', 'group-1', {
      name: SEED.groupName, description: 'ריצה משותפת בבקרים',
      order: 1, status: 'active', memberUids: [], links: [],
    })
    // Waiting to be claimed by whoever signs up with this address.
    await set('pendingFamilies', 'invited@e2e.test', {
      email: 'invited@e2e.test', name: 'משפחה שהוזמנה',
      role: 'new_family', phone: '050-4444444', address: 'רחוב הדקל 5',
    })
  })

  await env.cleanup()
  return { uids }
}
