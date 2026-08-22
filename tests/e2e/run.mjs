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
  // Start each step with empty buckets. Closing a browser context cancels
  // whatever it still had in flight, and those aborted requests would
  // otherwise be blamed on whichever step ran next.
  currentConsole = []
  currentFailedRequests = []
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
    if (!url.startsWith(BASE)) return
    // Navigating while an image is still loading cancels it, and that is not a
    // broken asset. Only genuine transport failures count — a missing file
    // returns a 404 response and never lands here anyway.
    if (req.failure()?.errorText === 'net::ERR_ABORTED') return
    currentFailedRequests.push(`${url} (${req.failure()?.errorText})`)
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
    // colorScheme is pinned: the app seeds its theme from prefers-color-scheme,
    // so without this the theme assertions would depend on the host.
    const ctx = await browser.newContext({ viewport, locale: 'he-IL', colorScheme: 'light' })
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

      // The one report channel available to someone who cannot get in at all.
      await step('מי שלא מצליח להתחבר יכול לשלוח דיווח ממסך הכניסה', async () => {
        await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
        await page.getByRole('button', { name: /לא מצליחים להיכנס/ }).click()
        const dialog = page.getByRole('dialog', { name: 'דיווח על בעיית התחברות' })
        await dialog.waitFor({ timeout: 10000 })
        await dialog.getByLabel('מה קרה?').fill('לחצתי על כניסה עם Google והמסך נתקע בטעינה')
        await dialog.getByLabel(/מייל או טלפון לחזרה/).fill('stuck@e2e.test')
        await dialog.getByRole('button', { name: 'שליחת הדיווח' }).click()
        await page.getByText('הדיווח נשלח').waitFor({ timeout: 15000 })
        await shoot(page, 'login-report')
        assertClean('דיווח ממסך הכניסה')
      })

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
      await step('הרשמה עם שם באנגלית נחסמת עם הסבר', async () => {
        await registerViaUi(page, { ...ACCOUNTS.fresh, name: 'David Cohen' })
        await expectText(page, 'יש להזין את השם בעברית')
        assert(!page.url().includes('/dashboard'), 'ההרשמה נמשכה למרות שם באנגלית')
        assertClean('חסימת שם באנגלית')
      })

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

      await step('סימון משימה כבוצעה נשמר למשפחה ושורד רענון', async () => {
        const card = page.locator('.card', { hasText: SEED.taskTitle }).first()
        // pending → בתהליך → הושלם
        await card.getByRole('button', { name: 'לחץ לעדכון סטטוס' }).click()
        await card.getByText('בתהליך').first().waitFor({ timeout: 10000 })
        await card.getByRole('button', { name: 'לחץ לעדכון סטטוס' }).click()
        await card.getByText('הושלם').first().waitFor({ timeout: 10000 })
        // The card flips optimistically, before the write is acknowledged —
        // reloading the instant it turns green would cancel the request in
        // flight and test nothing.
        await page.waitForTimeout(2000)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.locator('.card', { hasText: SEED.taskTitle }).first()
          .getByText('הושלם').first().waitFor({ timeout: 15000 })
        await shoot(page, 'task-done')
        assertClean('סימון משימה')
      })

      // The whole point of per-family progress: one family's tick is invisible
      // to the next family looking at the same task document.
      await step('משפחה אחרת עדיין רואה את אותה משימה כפתוחה', async () => {
        const other = await newPage({ width: 1280, height: 900 })
        await login(other, ACCOUNTS.fresh)
        await other.waitForURL(/\/dashboard/, { timeout: 25000 })
        await dismissTutorial(other)
        await other.goto(`${BASE}/tasks`, { waitUntil: 'domcontentloaded' })
        const card = other.locator('.card', { hasText: SEED.taskTitle }).first()
        await card.waitFor({ timeout: 15000 })
        await card.getByText('ממתין').first().waitFor({ timeout: 10000 })
        assert(await card.getByText('הושלם').count() === 0,
          'הסימון של משפחה אחת דלף למשפחה אחרת')
        await other.context().close()
      })

      await step('דף האירועים מציג אירוע עתידי ולא אירוע שחלף', async () => {
        await page.goto(`${BASE}/events`, { waitUntil: 'domcontentloaded' })
        await expectText(page, SEED.eventTitle)
        assertClean('דף אירועים')
      })

      await step('קישור ישיר לאירוע פותח את האירוע עצמו', async () => {
        // What a WhatsApp invitation actually does: land on the event, not on
        // the calendar with the guest hunting for it.
        await page.goto(`${BASE}/events?event=event-1`, { waitUntil: 'domcontentloaded' })
        await page.getByRole('button', { name: /^אני מגיע\/ה$|לחץ לביטול/ }).first().waitFor({ timeout: 15000 })
        await expectText(page, SEED.eventTitle)
        await page.getByRole('button', { name: 'שיתוף האירוע' }).first().waitFor({ timeout: 10000 })
        assertClean('קישור ישיר לאירוע')
      })

      await step('קישור לאירוע שאינו קיים אומר זאת ולא נשאר ריק', async () => {
        await page.goto(`${BASE}/events?event=no-such-event`, { waitUntil: 'domcontentloaded' })
        await expectText(page, 'האירוע שקיבלת בקישור אינו זמין לך')
      })

      await step('קישור לאירוע שנפתח ללא התחברות מגיע לאירוע אחרי הכניסה', async () => {
        // The whole point of a shared link: a guest whose session lapsed lands
        // on the event, not on the dashboard with the invitation forgotten.
        const guest = await newPage({ width: 1280, height: 900 })
        await guest.goto(`${BASE}/events?event=event-1`, { waitUntil: 'domcontentloaded' })
        await guest.waitForURL(/\/login\?next=/, { timeout: 10000 })
        await guest.getByPlaceholder('כתובת מייל').fill(ACCOUNTS.parent.email)
        await guest.getByPlaceholder('סיסמה').fill(ACCOUNTS.parent.password)
        await guest.getByRole('button', { name: 'כניסה', exact: true }).click()
        await guest.waitForURL(/\/events\?event=event-1/, { timeout: 20000 })
        await expectText(guest, SEED.eventTitle)
        await guest.context().close()
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

      await step('לוח השנה מציג יום הולדת של ילד ושל הורה, בצבעים שונים', async () => {
        await page.goto(`${BASE}/events`, { waitUntil: 'domcontentloaded' })
        await page.getByRole('button', { name: 'לוח שנה' }).click()
        const child  = page.getByText(`🎂 ${SEED.childBirthday}`).first()
        const parent = page.getByText(`🎈 ${SEED.parentBirthday}`).first()
        await child.waitFor({ timeout: 15000 })
        await parent.waitFor({ timeout: 15000 })
        const childColor  = await child.evaluate(el => getComputedStyle(el).color)
        const parentColor = await parent.evaluate(el => getComputedStyle(el).color)
        assert(childColor !== parentColor,
          `ילד והורה מוצגים באותו צבע (${childColor})`)
        await shoot(page, 'calendar-birthdays')
        assertClean('ימי הולדת בלוח השנה')
      })

      await step('יום הולדת של הורה שלא שיתף אינו מוצג לאיש', async () => {
        const body = await page.locator('body').innerText()
        assert(!body.includes(SEED.hiddenBirthday),
          'יום הולדת של הורה שלא סימן שיתוף דלף ללוח השנה')
      })

      await step('מתג מצב התצוגה יושב בתוך המסגרת שלו ומחליף ערכת נושא', async () => {
        await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' })
        const toggle = page.getByRole('switch')
        await toggle.waitFor({ timeout: 15000 })
        // The knob must stay inside the track — the RTL bug pushed it out.
        const fits = await toggle.evaluate((btn) => {
          const track = btn.getBoundingClientRect()
          const knob = btn.firstElementChild.getBoundingClientRect()
          return knob.left >= track.left - 0.5 && knob.right <= track.right + 0.5
        })
        assert(fits, 'ידית המתג חורגת מהמסגרת')
        assert(await toggle.getAttribute('aria-checked') === 'false', 'המתג לא התחיל במצב בהיר')
        await toggle.click()
        await page.waitForFunction(() => document.documentElement.classList.contains('dark'), null, { timeout: 5000 })
        await shoot(page, 'settings-theme-toggle')
        await toggle.click()
        assertClean('מתג מצב תצוגה')
      })

      await step('קרדיט הבנייה מופיע בתחתית ההגדרות ומקושר לאתר', async () => {
        const credit = page.getByRole('link', { name: 'hadarsap.online' })
        await credit.waitFor({ timeout: 10000 })
        assert(await credit.getAttribute('href') === 'https://hadarsap.online/',
          'הקישור לא מצביע לאתר הנכון')
        assert((await credit.getAttribute('rel') || '').includes('noopener'),
          'קישור חיצוני בלי rel="noopener"')
        await expectText(page, 'האתר נבנה ע״י')
      })

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

      // The report filed from the login screen has to actually land somewhere
      // a human looks — a report nobody reads is worse than no report.
      // "Did not finish onboarding" was unactionable without this: the page
      // has to say whether anything is actually missing.
      await step('בקרת התקינות מסבירה מה חסר לכל משפחה שלא סיימה קליטה', async () => {
        const su = await newPage({ width: 1440, height: 900 })
        await login(su, ACCOUNTS.super)
        await su.waitForURL(/\/admin/, { timeout: 25000 })
        await su.goto(`${BASE}/super/health`, { waitUntil: 'domcontentloaded' })
        await su.getByText('לא השלימו את תהליך הקליטה').first().click()

        // The family that has everything on file — nothing to chase.
        const complete = su.locator('li', { hasText: 'מיכל שלמה' }).first()
        await complete.waitFor({ timeout: 15000 })
        await complete.getByText(/כל הפרטים קיימים/).waitFor({ timeout: 10000 })

        // The family that stopped right after registering.
        const empty = su.locator('li', { hasText: 'רון חסר' }).first()
        await empty.getByText('לא שויכו ילדים').waitFor({ timeout: 10000 })
        await empty.getByText('אין טלפון').waitFor({ timeout: 10000 })
        await empty.getByText('לא אישרו את התקנון').waitFor({ timeout: 10000 })

        await shoot(su, 'health-onboarding-reasons')

        // One click closes only the family with nothing missing; the one with
        // real gaps has to stay on the list.
        await su.getByRole('button', { name: /סמן כהושלם את 1 המשפחות/ }).click()
        await su.getByText('מיכל שלמה').first().waitFor({ state: 'detached', timeout: 15000 })
        await su.getByText('רון חסר').first().waitFor({ timeout: 10000 })
        assertClean('בקרת תקינות')
        await su.context().close()
      })

      await step('הדיווח ממסך הכניסה מגיע לתיבת המשוב של המנהל הראשי', async () => {
        const su = await newPage({ width: 1440, height: 900 })
        await login(su, ACCOUNTS.super)
        await su.waitForURL(/\/admin/, { timeout: 25000 })
        await su.goto(`${BASE}/super/feedback`, { waitUntil: 'domcontentloaded' })
        await expectText(su, 'לחצתי על כניסה עם Google')
        await expectText(su, 'לא הצליח להתחבר')
        await shoot(su, 'admin-feedback-login-report')
        await su.context().close()
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
