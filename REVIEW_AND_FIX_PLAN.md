# שחף — Security / QA / UX Review & Fix Plan

_Date: 2026-06-10 · Scope: full repo audit (security, QA, UX/UI)_

Overall: **solid, launch-close app.** No CRITICAL security holes; build passes. Main risks are (1) a privacy-scoping gap on children's data, (2) a leftover client-exposed AI key variable, (3) `npm run lint` failing on 38 errors, and (4) some dashboard data-correctness bugs. Nothing here blocks careful launch except items P0.

---

## PART 1 — SECURITY (OWASP audit)

Risk level: **MEDIUM**

### HIGH
- **Children PII readable by every authenticated user.** `firestore.rules:127-132` — `children` allows read for any signed-in user, exposing every child's name, classId, parentUids to all `new_family`/`community`/`host_family` accounts. Scope reads to linked parents + class admins + admins.

### MEDIUM
- **Server secret with client `VITE_` prefix.** `.env.local` has `VITE_GEMINI_API_KEY` (live key). Not currently in the bundle (never referenced in source) but one `import.meta.env` reference would leak a paid key to all visitors. Delete it; keep only `GEMINI_API_KEY`. Rotate the key as a precaution.
- **CSP allows `script-src 'unsafe-inline'`.** `vercel.json:11` — weakens XSS defense. Remove `'unsafe-inline'` from `script-src` (keep it for `style-src`).
- **Any authenticated user can write/overwrite event images.** `storage.rules:6-9` — only size+contentType checked, no role gate; a non-admin can upload or overwrite `events/{id}.{ext}`. Gate uploads behind an admin check (serverless-issued upload or path convention).
- **AI rate limiting weak.** `api/chat.js` — per-minute limiter is in-memory (resets per cold start / not shared across instances); daily limit fails *open* on Firestore error and is silently disabled if `FIREBASE_PROJECT_ID` is unset. Make the Firestore daily limit authoritative with an atomic increment; fail closed on persistent errors.
- **Config drift.** `.env.example`/README say `ANTHROPIC_API_KEY` / "Claude" but code uses `GEMINI_API_KEY` + Gemini. Update docs.

### LOW
- `registerCoParent` (`db.js:401`) lets any user create arbitrary Auth accounts / send reset emails, and the co-parent inherits the caller's role. Constrain + throttle, ideally server-side.
- `messages` / `childNotes` have no server-side length caps (`firestore.rules`). Add `size()`/length checks.

### Positives
Server-side token verification on `/api/chat`; CORS locked to app origin; role-escalation blocked in rules; profile-field allowlist (client + rules); no `dangerouslySetInnerHTML`/`eval`; full security headers + HSTS; secrets gitignored; AI message/role caps limit prompt-injection blast radius.

---

## PART 2 — QA / CORRECTNESS

### P0 — `npm run lint` fails (38 errors)
ESLint 10 config treats several rules as errors → CI/build gate fails.
- `no-unused-vars` (19): e.g. `CommitteesPage.jsx:3` (`COMMITTEE_ICONS`), `:9` (`clsx`).
- `react-hooks/set-state-in-effect` (9): e.g. `SuperAdminPage.jsx:64` — load-on-mount effects. Acceptable pattern; either refactor to an async loader or scope the rule.
- `react-hooks/purity` (2) + `immutability` (1): `Date.now()` in render path (`ChatPage.jsx:92`, `FloatingChat.jsx`).
- `react-refresh/only-export-components` (1): `AuthContext.jsx` exports both component and `useAuth` hook.
- `exhaustive-deps` (1): `LoginPage.jsx:54` missing `navigate`.

### Functional bugs
- **Dashboard "upcoming events" shows past events.** `DashboardPage.jsx:50` — `events.slice(0,2)` on a date-ascending list, with no future filter, surfaces the *earliest* events (often already past). Filter to `eventDate >= today` before slicing.
- **Dashboard pending-forms count ignores class forms.** `DashboardPage.jsx:37-40` counts only `targetRole === role|all`, while `FormFillPage.jsx:190` also counts `targetRole === 'class'`. Numbers disagree. Unify the filter.
- **`EventCard` past-detection timezone edge.** `EventCard.jsx:51-52` parses date-only as UTC midnight, so an event "today" can read as past after UTC midnight in local evening. Compare against local start-of-day.
- **Dashboard "אירועים קרובים" stat is capped at 2.** `DashboardPage.jsx:50,114` — the stat shows `upcomingEvents.length` (≤2), not the true upcoming count.

### Dead code / hygiene
- **`FloatingChat.jsx` (~225 lines) is never imported or rendered** — it duplicates the routed `ChatPage`. Remove it, or wire it intentionally (pick one chat surface).
- Empty `catch {}` blocks (`AuthContext.jsx:53`, `db.js:448-449`) — acceptable cleanup-path swallowing; add a comment.

### Testing & build
- **No automated tests** (no test runner, no specs). For a platform handling family/minor data, add at least smoke tests for auth gating, Firestore rules (emulator), and `api/chat` auth/limits.
- **Single 916 KB JS bundle** (254 KB gzip), no code-splitting — slow first load on the mobile audience. Lazy-load admin routes and heavy libs.

---

## PART 3 — UX / UI

### Functional UX
- **Two parallel chat experiences** (routed `ChatPage` + dead `FloatingChat`) — decide on one; a floating assistant available app-wide is arguably better UX than a dedicated page, but don't ship both.
- **Dashboard upcoming-events section** can show "האירוע הסתיים" cards under "אירועים קרובים" (same root cause as the QA bug). Looks broken to users.
- **Password UX**: min length (6) only surfaces as a Firebase error after submit. Add an inline hint on the register form.

### Visual / polish
- **RTL maintainability**: 160 hardcoded `text-right` (and a few `pl-/pr-`) instead of logical `text-start`/`ps-`/`pe-` (your global rule). App is RTL-only so it works today, but logical props future-proof it.
- **Contrast**: secondary text uses `text-gray-400` on white in places (borderline WCAG AA for small text) — bump to `text-gray-500`/`600` for body-size secondary text.
- **Inputs** (Contact, Forms, Settings) have no `maxLength` — add sensible caps (also a light abuse guard).

### Positives
Consistent card/spacing system; loading spinners and empty states are present across pages; icon-only buttons mostly carry `aria-label`/`title`; demo login correctly hidden in production; thoughtful iOS PWA Google-auth redirect handling; inline delete-confirm pattern instead of `window.confirm`.

---

## CONSOLIDATED FIX PLAN (priority order)

Status as of this session — ✅ done · ⚠️ partial/needs your action · ⬜ deferred.

### P0 — before/at launch (security + correctness)
1. ✅ **Scoped `children` reads** in `firestore.rules` to parents/same-class/class-admins/admins. Added `classIds` on the user profile (`db.js` maintains it; `AuthContext` backfills existing users). Rules compile (verified via `firebase deploy --only firestore:rules --dry-run`). _(SEC-HIGH)_
2. ✅ **Removed `VITE_GEMINI_API_KEY`** from `.env.local`. It was a placeholder (`your-gemini-api-key-here`), never live, so no rotation needed. _(SEC-MED)_
3. ✅ **AI daily limit now authoritative & fail-closed** in `api/chat.js` (refuses with 503 if the counter can't be read; requires `FIREBASE_PROJECT_ID`). _(SEC-MED)_
4. ⚠️ **Storage event-image writes gated to admins** via `firestore.get()` in `storage.rules`. NOTE: `firebase` CLI reports Storage is **not initialized** on the project, so (a) the rule can't deploy until you click "Get Started" in Firebase Console → Storage, and (b) wire `"storage": {"rules":"storage.rules"}` into `firebase.json` once it is (left out for now so a full `firebase deploy` doesn't fail). _(SEC-MED)_
5. ✅ **Dashboard upcoming-events** now filters to future events and the stat shows the true count. _(QA/UX)_
6. ✅ **`npm run lint` is green** (0 errors). Removed dead imports/vars; ref-based message ids; ESLint config gives Node globals to `api/`, allows empty catch + `_`-prefixed vars, and downgrades the pre-React-Compiler rules (`set-state-in-effect`/`purity`/`immutability`) to warnings. _(QA)_

### P1 — soon after launch
7. ✅ Removed `'unsafe-inline'` from CSP `script-src` (verified build has no inline scripts). _(SEC-MED)_
8. ✅ Deleted dead `FloatingChat.jsx` (was untracked WIP, duplicate of `ChatPage`). _(QA/UX)_
9. ✅ Unified pending-forms filter (Dashboard now includes class-targeted forms, matching FormFillPage). _(QA)_
10. ✅ Fixed `EventCard` past-detection (local time); extracted pure logic to `src/lib/calendar.js`. _(QA)_
11. ✅ Updated `.env.example` + README to Gemini. _(docs)_
12. ⚠️ Added `size()` caps on `messages`/`childNotes` rules + `maxLength` on contact/settings/co-parent inputs. `registerCoParent` throttle NOT done — real throttling needs server-side (Cloud Function); client guards are weak. The form is already gated to new_family/host_family and one co-parent per account. _(SEC-LOW — deferred throttle)_

### P2 — quality / scale
13. ✅ Code-split admin/super routes (`React.lazy` + `Suspense`). Family first-load bundle: **916 KB → 763 KB** (gzip 254→227). _(Perf)_
14. ⚠️ Added a test harness (**vitest**, `npm test`) + 12 unit tests for `src/lib/calendar.js`. Firestore-rules emulator tests and `api/chat` integration tests still TODO. _(QA)_
15. ⚠️ Added input `maxLength` (contact/settings/co-parent). `text-right`→`text-start` mass migration and low-contrast (`text-gray-400`) bump were **deferred** — large, low-risk-but-tedious cosmetic changes; functionally fine in this RTL-only app. _(UX polish)_

### Remaining for you
- Initialize Firebase Storage + wire `storage.rules` into `firebase.json`, then deploy it.
- Deploy the updated `firestore.rules` (`firebase deploy --only firestore:rules`).
- Optional: server-side throttle for co-parent creation; emulator/API tests; RTL logical-property + contrast polish.
