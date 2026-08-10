// End-to-end smoke suite — drives the real app in Chromium against the local
// Firebase emulators. Run with:
//
//   npm run test:e2e
//
// Requirements: Java (emulators), and Playwright resolvable from Node
// (`npm i -D playwright`, or NODE_PATH pointing at a global install). If the
// bundled Chromium download was skipped, point CHROMIUM_PATH at an existing
// Chromium binary.
//
// The suite is a smoke net for release day, not a replacement for the unit
// tests: it checks that every role can get in, that the consent gate holds,
// and that the pages a family actually opens render real seeded data without
// console errors or permission-denied reads.
import { spawn } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createRequire } from 'module'
import { seed, ACCOUNTS, SEED, PROJECT_ID } from './seed.mjs'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const shotDir = join(here, 'screenshots')
// Resolved in main() — a leftover dev server from an interrupted run must not
// be mistaken for this run's server (it dies with its own parent mid-suite and
// every remaining step then fails on ERR_CONNECTION_REFUSED).
let PORT = Number(process.env.E2E_PORT || 5199)
let BASE = `http://127.0.0.1:${PORT}`

const results = []
let currentConsole = []

// ── Harness ───────────────────────────────────────────────────────────────────
async function step(name, fn) {
  const started = Date.now()
  try {
    await fn()
    results.push({ name, status: 'pass', ms: Date.now() - started })
    console.log(`  \x1b[32m✓\x1b[0m ${name}`)
  } catch (err) {
    results.push({ name, status: 'fail', ms: Date.now() - started, error: err.message })
    console.log(`  \x1b[31m✗\x1b[0m ${name}\n      ${err.message.split('\n')[0]}`)
  }
}

function group(title) { console.log(`\n\x1b[1m${title}\x1b[0m`) }

function assert(cond, msg) { if (!cond) throw new Error(msg) }

// Console noise that says nothing about the app's health. Resource-load
// failures are dropped here and judged from the request log instead, which
// carries the URL — a blocked third-party font is not an app defect, a broken
// same-origin asset is.
const IGNORED_CONSOLE = [
  /favicon/i,
  /Download the React DevTools/i,
  /\[vite\]/i,
  /Firestore .*emulator/i,
  /WebChannelConnection/i,
  /source ?map/i,
  /Failed to load resource/i,
]

let currentFailedRequests = []
const externalFailures = new Set()

function attachConsole(page) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return
    const text = msg.text()
    if (IGNORED_CONSOLE.some(re => re.test(text))) return
    currentConsole.push({ type: msg.type(), text })
  })
  page.on('pageerror', (err) => currentConsole.push({ type: 'pageerror', text: err.message }))
  page.on('requestfailed', (req) => {
    const url = req.url()
    if (url.startsWith(BASE)) currentFailedRequests.push(url)
  })
}

function takeConsole() {
  const out = currentConsole
  currentConsole = []
  currentFailedRequests = []
  return out
}

function assertClean(label) {
  const failedAssets = currentFailedRequests
  const entries = takeConsole()
  const errors = entries.filter(e => e.type !== 'warning')
  assert(failedAssets.length === 0,
    `${label}: ${failedAssets.length} same-origin request(s) failed — ${failedAssets.slice(0, 3).join(' | ')}`)
  assert(errors.length === 0,
    `${label}: ${errors.length} console error(s) — ${errors.slice(0, 3).map(e => e.text.slice(0, 160)).join(' | ')}`)
}

const permissionDenied = []
function watchPermissionDenied(page) {
  page.on('console', (msg) => {
    if (/permission[- ]denied|Missing or insufficient permissions/i.test(msg.text())) {
      permissionDenied.push({ url: page.url(), text: msg.text().slice(0, 200) })
    }
  })
}

// ── App helpers ───────────────────────────────────────────────────────────────
async function login(page, { email, password }) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder('כתובת מייל').fill(email)
  await page.getByPlaceholder('סיסמה').fill(password)
  await page.getByRole('button', { name: 'כניסה', exact: true }).click()
}

async function registerViaUi(page, { email, password, name }) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /אין לך חשבון/ }).click()
  await page.getByPlaceholder('שם מלא').fill(name)
  await page.getByPlaceholder('כתובת מייל').fill(email)
  await page.getByPlaceholder('סיסמה').fill(password)
  await page.getByRole('button', { name: 'הרשמה', exact: true }).click()
}

async function acceptConsent(page) {
  const approve = page.getByRole('button', { name: /מאשר\/ת — המשך/ })
  await approve.waitFor({ timeout: 20000 })
  await page.locator('input[type="checkbox"]').first().check()
  await approve.click()
  await approve.waitFor({ state: 'detached', timeout: 20000 })
}

async function logout(page) {
  // The logout control lives behind the shell's account area; clearing auth
  // state directly is enough for the suite and avoids depending on chrome.
  await page.evaluate(() => {
    indexedDB.deleteDatabase('firebaseLocalStorageDb')
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.context().clearCookies()
}

async function expectText(page, text, timeout = 15000) {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout })
}

// First-login users get the welcome tutorial as a full-screen overlay, which
// swallows every click underneath it until it is dismissed.
async function dismissTutorial(page) {
  const skip = page.getByRole('button', { name: 'דלג על ההדרכה' })
  try {
    await skip.waitFor({ timeout: 4000 })
    await skip.click()
    await skip.waitFor({ state: 'detached', timeout: 5000 })
  } catch { /* already seen, or this user never gets it */ }
}

async function shoot(page, name) {
  try { await page.screenshot({ path: join(shotDir, `${name}.png`), fullPage: false }) } catch {}
}

// Horizontal overflow is the classic mobile regression — nothing may stick out
// past the viewport.
async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)
  assert(overflow <= 2, `${label}: page scrolls horizontally by ${overflow}px`)
}

// ── Dev server ────────────────────────────────────────────────────────────────
function startVite() {
  const child = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: root,
    env: {
      ...process.env,
      VITE_USE_EMULATORS: '1',
      VITE_FIREBASE_API_KEY: 'fake-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: '127.0.0.1',
      VITE_FIREBASE_PROJECT_ID: PROJECT_ID,
      VITE_FIREBASE_STORAGE_BUCKET: `${PROJECT_ID}.appspot.com`,
      VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      VITE_FIREBASE_APP_ID: '1:000000000000:web:e2e',
      VITE_SENTRY_DSN: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', () => {})
  child.stderr.on('data', d => process.stderr.write(`[vite] ${d}`))
  return child
}

async function findFreePort(from) {
  const { createServer } = await import('net')
  for (let port = from; port < from + 40; port++) {
    const free = await new Promise((resolve) => {
      const srv = createServer()
      srv.once('error', () => resolve(false))
      srv.once('listening', () => srv.close(() => resolve(true)))
      srv.listen(port, '127.0.0.1')
    })
    if (free) return port
  }
  throw new Error(`no free port in ${from}..${from + 40}`)
}

async function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 400))
  }
  throw new Error(`dev server did not start at ${url}`)
}

// ── Suite ─────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(shotDir, { recursive: true })
  console.log('→ seeding emulators…')
  await seed()

  PORT = await findFreePort(PORT)
  BASE = `http://127.0.0.1:${PORT}`
  console.log(`→ starting dev server on ${BASE} …`)
  const vite = startVite()
  await waitForServer(BASE)

  const { chromium } = require('playwright')
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  })

  const newPage = async (viewport) => {
    const ctx = await browser.newContext({ viewport, locale: 'he-IL' })
    // Third-party requests (Google Fonts) are cut off: the suite is about this
    // app's own behaviour, and a network that may or may not reach fonts.google
    // otherwise turns every navigation into a 30s stall on `networkidle`.
    await ctx.route('**/*', (route) => {
      const url = route.request().url()
      if (url.startsWith(BASE) || url.includes('127.0.0.1') || url.startsWith('data:')) return route.continue()
      externalFailures.add(new URL(url).host)
      return route.abort()
    })
    const page = await ctx.newPage()
    attachConsole(page)
    watchPermissionDenied(page)
    return page
  }

  try {
    // ── Public surface ──────────────────────────────────────────────────────
    group('דפים ציבוריים')
    {
      const page = await newPage({ width: 1280, height: 900 })
      await step('מסך הכניסה נטען עם מיתוג שחף+ וללא שגיאות קונסול', async () => {
        await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
        await expectText(page, 'ברוכים הבאים לשחף+')
        assert(await page.locator('img[alt="שחף+"]').count() > 0, 'לוגו שחף+ לא נמצא')
        assert((await page.title()).includes('שחף+'), `כותרת דפדפן לא צפויה: ${await page.title()}`)
        await shoot(page, 'login-desktop')
        assertClean('מסך כניסה')
      })

      for (const [path, needle] of [
        ['/legal/privacy', 'פרטיות'],
        ['/legal/terms', 'תנאי'],
        ['/legal/accessibility', 'נגישות'],
      ]) {
        await step(`דף משפטי ${path} נגיש בלי התחברות`, async () => {
          await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
          await expectText(page, needle)
          assertClean(path)
        })
      }

      await step('נתיב לא מוכר מפנה למסך הכניסה', async () => {
        await page.goto(`${BASE}/no-such-page`, { waitUntil: 'domcontentloaded' })
        await page.waitForURL(/\/login/, { timeout: 10000 })
        takeConsole()
      })

      await step('מסך מוגן ללא התחברות מפנה למסך הכניסה', async () => {
        await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' })
        await page.waitForURL(/\/login/, { timeout: 10000 })
        takeConsole()
      })
      await page.context().close()
    }

    // ── Brand-new registration + consent gate ───────────────────────────────
    group('הרשמה של משתמש חדש')
    {
      const page = await newPage({ width: 1280, height: 900 })
      await step('הרשמה עם מייל וסיסמה מגיעה למסך ההסכמה', async () => {
        await registerViaUi(page, ACCOUNTS.fresh)
        await page.getByRole('button', { name: /מאשר\/ת — המשך/ }).waitFor({ timeout: 25000 })
        await shoot(page, 'consent-gate')
      })

      await step('שער ההסכמה חוסם תוכן — אין נתוני קהילה לפני אישור', async () => {
        const body = await page.locator('body').innerText()
        assert(!body.includes(SEED.eventTitle), 'תוכן אירועים דלף לפני אישור התקנון')
        assert(!body.includes(SEED.announcement), 'הודעות דלפו לפני אישור התקנון')
      })

      await step('אישור התקנון פותח את הדשבורד', async () => {
        await acceptConsent(page)
        await page.waitForURL(/\/dashboard/, { timeout: 20000 })
        await expectText(page, SEED.eventTitle)
        await shoot(page, 'dashboard-new-user')
        assertClean('דשבורד משתמש חדש')
      })

      await step('רענון דף שומר על ההתחברות ולא מבקש הסכמה שוב', async () => {
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForURL(/\/dashboard/, { timeout: 20000 })
        assert(await page.getByRole('button', { name: /מאשר\/ת — המשך/ }).count() === 0,
          'מסך ההסכמה הופיע שוב אחרי רענון')
        assertClean('רענון דשבורד')
      })
      await page.context().close()
    }

    // ── Invited family (pendingFamilies match) ──────────────────────────────
    group('משפחה שהוזמנה מייבוא')
    {
      const page = await newPage({ width: 1280, height: 900 })
      // A pendingFamilies match makes the account `new_family` + status
      // `pending`, and the onboarding gate is checked before the approval gate
      // — so this user starts in the onboarding wizard and only meets the
      // "waiting for approval" screen after finishing it. What must hold either
      // way is that no community content is reachable yet.
      await step('נרשם עם מייל מהייבוא ולא מקבל גישה לתוכן הקהילה', async () => {
        await registerViaUi(page, { email: 'invited@e2e.test', password: 'Test123456', name: 'משפחה שהוזמנה' })
        await acceptConsent(page)
        await page.waitForTimeout(2000)
        const body = await page.locator('body').innerText()
        assert(/ממתין לאישור|ברוכים הבאים/.test(body),
          `לא הוצג מסך אונבורדינג ולא מסך המתנה. תוכן: ${body.slice(0, 200)}`)
        assert(!body.includes(SEED.eventTitle), 'אירועי הקהילה נגישים לפני אישור החשבון')
        assert(!body.includes(SEED.taskTitle), 'משימות הקהילה נגישות לפני אישור החשבון')
        await shoot(page, 'invited-onboarding')
      })

      await step('משתמש שהוזמן לא יכול לעקוף את השער דרך כתובת ישירה', async () => {
        await page.goto(`${BASE}/events`, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(2000)
        const body = await page.locator('body').innerText()
        assert(!body.includes(SEED.eventTitle), 'ניווט ישיר ל-/events עקף את שער האונבורדינג/אישור')
      })
      await page.context().close()
    }

    // ── Existing parent ─────────────────────────────────────────────────────
    group('הורה קיים בקהילה')
    {
      const page = await newPage({ width: 1280, height: 900 })
      await step('כניסה עם מייל וסיסמה מגיעה לדשבורד', async () => {
        await login(page, ACCOUNTS.parent)
        await page.waitForURL(/\/dashboard/, { timeout: 25000 })
        await dismissTutorial(page)
        await expectText(page, ACCOUNTS.parent.name.slice(0, 4))
        assertClean('כניסת הורה')
      })

      await step('הדשבורד מציג את האירוע הקרוב ואת הכיתה של הילד', async () => {
        await expectText(page, SEED.eventTitle)
        const body = await page.locator('body').innerText()
        assert(body.includes(SEED.className), 'הכיתה של הילד לא מופיעה בדשבורד')
        await shoot(page, 'dashboard-parent')
      })

      await step('לוח המשימות של המשפחה מציג את המשימה שהמנהל פרסם', async () => {
        await page.goto(`${BASE}/tasks`, { waitUntil: 'domcontentloaded' })
        await expectText(page, SEED.taskTitle)
        await shoot(page, 'tasks-parent')
        assertClean('דף משימות')
      })

      await step('דף האירועים מציג אירוע עתידי ולא אירוע שחלף', async () => {
        await page.goto(`${BASE}/events`, { waitUntil: 'domcontentloaded' })
        await expectText(page, SEED.eventTitle)
        assertClean('דף אירועים')
      })

      await step('אישור הגעה לאירוע נשמר ושורד רענון', async () => {
        await dismissTutorial(page)
        await page.getByText(SEED.eventTitle).first().click()
        const rsvp = page.getByRole('button', { name: /^אני מגיע\/ה$/ })
        await rsvp.waitFor({ timeout: 15000 })
        await rsvp.click()
        await page.getByRole('button', { name: /לחץ לביטול/ }).waitFor({ timeout: 15000 })
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.getByText(SEED.eventTitle).first().click()
        await page.getByRole('button', { name: /לחץ לביטול/ }).waitFor({ timeout: 15000 })
        await shoot(page, 'event-rsvp')
        assertClean('אישור הגעה')
      })

      for (const [path, label] of [
        ['/class', 'הכיתה שלי'],
        ['/committees', 'ועדות'],
        ['/community', 'קבוצות קהילה'],
        ['/resources', 'מידע שימושי'],
        ['/tasks', 'משימות'],
        ['/settings', 'הגדרות'],
        ['/my-privacy', 'הפרטיות שלי'],
        ['/help', 'עזרה'],
        ['/contact', 'צור קשר'],
        ['/businesses', 'עסקים בקהילה'],
        ['/meal-trains', 'סירי לידה'],
      ]) {
        await step(`דף ${label} (${path}) נטען ללא שגיאות`, async () => {
          await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(1500)
          const url = page.url()
          assert(url.includes(path), `הופנה מחוץ לדף: ${url}`)
          assertClean(path)
        })
      }

      await step('בקשת הצטרפות לוועדה נרשמת ומופיעה מיד', async () => {
        await page.goto(`${BASE}/committees`, { waitUntil: 'domcontentloaded' })
        await expectText(page, SEED.committeeName)
        const join = page.getByRole('button', { name: /בקש להצטרף/ }).first()
        await join.waitFor({ timeout: 15000 })
        await join.click()
        // Joining publishes the member's name to the committee, so it goes
        // through its own consent checkbox before anything is written.
        const dialog = page.getByRole('dialog', { name: /אישור הצטרפות/ })
        await dialog.waitFor({ timeout: 10000 })
        await dialog.locator('input[type="checkbox"]').check()
        await dialog.getByRole('button', { name: /מאשר\/ת — הצטרפות/ }).click()
        await page.getByRole('button', { name: /ממתין לאישור|✓ חבר/ }).first().waitFor({ timeout: 15000 })
        await shoot(page, 'committee-join')
        assertClean('הצטרפות לוועדה')
      })
      await page.context().close()
    }

    // ── Imported user awaiting approval ─────────────────────────────────────
    group('משתמש מיובא שממתין לאישור')
    {
      const page = await newPage({ width: 1280, height: 900 })
      await step('משתמש בסטטוס pending לא מגיע לדשבורד', async () => {
        await login(page, ACCOUNTS.imported)
        await page.waitForTimeout(4000)
        const body = await page.locator('body').innerText()
        assert(!body.includes(SEED.announcement), 'משתמש ממתין לאישור רואה תוכן קהילתי')
        await shoot(page, 'imported-pending')
      })
      await page.context().close()
    }

    // ── Admin ───────────────────────────────────────────────────────────────
    group('מנהל')
    {
      const page = await newPage({ width: 1440, height: 900 })
      await step('כניסת מנהל מגיעה למסך הניהול', async () => {
        await login(page, ACCOUNTS.admin)
        await page.waitForURL(/\/admin/, { timeout: 25000 })
        await page.waitForTimeout(1500)
        await shoot(page, 'admin-dashboard')
        assertClean('מסך ניהול')
      })

      for (const [path, label] of [
        ['/admin/users', 'חברים'],
        ['/admin/classes', 'כיתות'],
        ['/admin/children', 'ילדים'],
        ['/admin/events', 'אירועים'],
        ['/admin/tasks', 'משימות'],
        ['/admin/committees', 'ועדות'],
        ['/admin/community', 'קבוצות קהילה'],
        ['/admin/resources', 'מידע שימושי'],
        ['/admin/messages', 'הודעות'],
        ['/admin/activity', 'פעילות'],
        ['/admin/emergency', 'מצב חירום'],
        ['/admin/import', 'ייבוא'],
        ['/admin/forms', 'טפסים'],
      ]) {
        await step(`מסך ניהול ${label} (${path}) נטען ללא שגיאות`, async () => {
          await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(1500)
          assert(page.url().includes(path), `הופנה מחוץ לדף: ${page.url()}`)
          assertClean(path)
        })
      }

      await step('רשימת החברים מציגה את המשתמשים שנרשמו', async () => {
        await page.goto(`${BASE}/admin/users`, { waitUntil: 'domcontentloaded' })
        await expectText(page, ACCOUNTS.parent.name)
        await shoot(page, 'admin-users')
      })
      await page.context().close()
    }

    // ── Mobile ──────────────────────────────────────────────────────────────
    group('מובייל (390×844)')
    {
      const page = await newPage({ width: 390, height: 844 })
      await step('מסך כניסה במובייל ללא גלישה אופקית', async () => {
        await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
        await expectText(page, 'ברוכים הבאים לשחף+')
        await assertNoHorizontalOverflow(page, 'מסך כניסה')
        await shoot(page, 'login-mobile')
        assertClean('מסך כניסה מובייל')
      })

      await step('דשבורד וניווט תחתון במובייל ללא גלישה אופקית', async () => {
        await login(page, ACCOUNTS.parent)
        await page.waitForURL(/\/dashboard/, { timeout: 25000 })
        await dismissTutorial(page)
        await expectText(page, SEED.eventTitle)
        await assertNoHorizontalOverflow(page, 'דשבורד')
        await shoot(page, 'dashboard-mobile')
        assertClean('דשבורד מובייל')
      })

      for (const path of ['/events', '/class', '/committees', '/settings']) {
        await step(`מובייל: ${path} ללא גלישה אופקית`, async () => {
          await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(1200)
          await assertNoHorizontalOverflow(page, path)
          assertClean(`מובייל ${path}`)
        })
      }
      await page.context().close()
    }

    // ── Session end ─────────────────────────────────────────────────────────
    group('סיום סשן')
    {
      const page = await newPage({ width: 1280, height: 900 })
      await step('התנתקות מחזירה למסך הכניסה', async () => {
        await login(page, ACCOUNTS.parent)
        await page.waitForURL(/\/dashboard/, { timeout: 25000 })
        await logout(page)
        await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' })
        await page.waitForURL(/\/login/, { timeout: 15000 })
        takeConsole()
      })
      await page.context().close()
    }
  } finally {
    await browser.close()
    vite.kill('SIGTERM')
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const failed = results.filter(r => r.status === 'fail')
  console.log(`\n\x1b[1m${results.length - failed.length}/${results.length} בדיקות עברו\x1b[0m`)
  if (externalFailures.size) {
    console.log(`\n\x1b[33mמשאבים חיצוניים שלא נטענו (חסומים בסביבת הבדיקה, לא באג):\x1b[0m ${[...externalFailures].join(', ')}`)
  }
  if (permissionDenied.length) {
    console.log(`\n\x1b[33mשגיאות הרשאה מ-Firestore (${permissionDenied.length}):\x1b[0m`)
    for (const p of permissionDenied.slice(0, 15)) console.log(`  ${p.url} — ${p.text}`)
  }
  if (failed.length) {
    console.log('\n\x1b[31mנכשלו:\x1b[0m')
    for (const f of failed) console.log(`  ✗ ${f.name}\n      ${f.error}`)
  }
  writeFileSync(join(here, 'last-run.json'), JSON.stringify(
    { ranAt: new Date().toISOString(), results, permissionDenied, externalFailures: [...externalFailures] },
    null, 2))
  process.exit(failed.length ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })
