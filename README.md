# שחף — פלטפורמת קליטה

A Hebrew RTL web application for managing school onboarding of new families. Built with React 19, Firebase, and deployed on Vercel.

---

## What it does

The platform serves five types of users:

| Role | Hebrew | Purpose |
|------|--------|---------|
| `new_family` | משפחה חדשה | Incoming families completing onboarding tasks |
| `host_family` | משפחה מארחת | Mentor families tracking their assigned new families |
| `community` | קהילה | Existing community members (events, committees, resources) |
| `admin` | מנהל | School staff managing tasks, events, forms, users, and committees |
| `super_admin` | מנהל ראשי | Full access including admin promotion |

**Key features:**
- Onboarding task checklist with milestone grouping and status progression
- Calendar (month + list views) with Google Calendar / ICS export (past events hidden from export)
- Class page — weekly schedule, class team contacts, per-child private notes
- Forms builder — admin creates forms, families fill and re-edit submissions; co-parent submissions are shared (one submission per family per form)
- Committees directory — descriptions, member lists, contact info
- AI chat assistant (Google Gemini via `/api/chat`) — context-aware of the family's tasks and milestones
- Two-parent support — first parent registers a co-parent from Settings; both share children, tasks, and form submissions
- Admin dashboard: user management, bulk CSV/Excel import, forms builder, activity log, messages
- Google login + email/password auth (redirect flow for iOS Safari)
- PWA — installable on home screen, works offline with cached shell

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + Vite 8 (Rolldown) + Tailwind CSS v3 |
| Routing | React Router v7 |
| Auth | Firebase Auth (Google + email/password) |
| Database | Firestore |
| Storage | Firebase Storage (event images) |
| Hosting | Vercel |
| AI | Google Gemini (`gemini-2.5-flash`) via Vercel serverless function |
| PWA | vite-plugin-pwa (Workbox, autoUpdate) |
| Spreadsheet import | papaparse (CSV) + read-excel-file (Excel, lazy-loaded) |

---

## Project structure

```
shachaf/
├── api/
│   └── chat.js                 # Vercel serverless: AI chat (Gemini), rate-limited per UID
├── public/
│   ├── logo.png                # App icon (also PWA + iOS home screen)
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.jsx    # Sidebar, mobile bottom nav, page title header
│   │   │   └── InstallBanner.jsx
│   │   └── ui/                 # Shared components
│   │       ├── CalendarGrid.jsx
│   │       ├── EventCard.jsx   # Shows past-event state, Google/ICS export
│   │       ├── EventDetailPanel.jsx
│   │       ├── ProgressRing.jsx
│   │       └── TaskCard.jsx    # Status toggle with completion animation
│   ├── context/
│   │   └── AuthContext.jsx     # Auth state, role resolution, pending-family merge
│   ├── lib/
│   │   ├── db.js               # All Firestore helpers + registerCoParent
│   │   ├── firebase.js         # Firebase app init, exports firebaseConfig
│   │   ├── formsStorage.js     # ID generators only (newFormId, newFieldId)
│   │   └── mockData.js         # Dev-mode demo users
│   └── pages/
│       ├── admin/              # Admin-only pages
│       ├── auth/               # Login / register page
│       ├── family/             # new_family + host_family pages
│       ├── host/               # Host-family pages (assigned families list)
│       └── super/              # Super-admin pages
├── .env.example
├── firestore.rules
├── index.html
├── tailwind.config.js
└── vite.config.js
```

---

## Local setup

### Prerequisites

- Node.js ≥ 22
- A Firebase project with **Firestore**, **Authentication**, and **Storage** enabled
- A Google Gemini API key (for the AI chat feature)

### Steps

```bash
# 1. Clone and install
git clone <repo-url>
cd shachaf
npm install

# 2. Create your environment file
cp .env.example .env.local

# 3. Fill in .env.local

# 4. Start dev server
npm run dev
```

The app runs at `http://localhost:5173`.

**Dev-only shortcut:** In development, the login page shows role buttons that bypass Firebase auth and log you in as a demo user for any role. No real credentials needed.

---

## Environment variables

```
# Firebase (Firebase Console → Project settings → Your apps → Web app)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Google Gemini — server-side only, never exposed to the browser (no VITE_ prefix)
GEMINI_API_KEY=
```

`VITE_` variables are embedded into the frontend bundle at build time. Set all of them in **Vercel → Project → Settings → Environment Variables** for production.

---

## Firebase setup

### Authentication
Enable in Firebase Console → Authentication → Sign-in method:
- **Email/Password**
- **Google**

Add your production domain to **Authorized domains**.

### Firestore
Deploy the security rules:
```bash
firebase deploy --only firestore:rules
```

Key collections:

| Collection | Description |
|------------|-------------|
| `users/{uid}` | Profile: name, email, role, phone, address, childIds, coParent? |
| `tasks/{id}` | Onboarding tasks with targetGroups, classIds, milestone, status |
| `events/{id}` | School/class events with date, time, type, imageUrl? |
| `forms/{id}` | Admin-created forms with fields, targetRole, classIds, status |
| `submissions/{id}` | Form submissions: userId, coParentUids, formId, data |
| `children/{id}` | Child records: name, classId, parentUids[] |
| `adminNotes/{childId}` | Admin-only notes per child (not visible to families) |
| `childNotes/{parentId_childId}` | Per-parent private notes per child |
| `committees/{id}` | Committee name, description, members, contact |
| `announcements/{id}` | Class/school announcements |
| `pendingFamilies/{email}` | Pre-imported families waiting to register |
| `messages/{id}` | Contact form submissions (admin-read only) |
| `activityLog/{id}` | Admin activity feed |
| `aiUsage/{uid}` | Per-user AI message counter for rate limiting |

---

## Role system

Roles are stored in `users/{uid}.role`. The auth flow:

1. User signs up (Google or email/password).
2. `AuthContext` checks `pendingFamilies/{email}` — if found, the imported role and profile data are applied and the pending record is deleted.
3. If no pending record, default role is `new_family`.
4. Admins promote users in Admin → Users → select user → role dropdown.
5. Super admins can promote to `admin` via `/super/admins`.

---

## Two-parent families

Each parent has a **separate account** with their own email. A child can have multiple `parentUids` in their Firestore document. The first parent to sign up can register a co-parent from Settings:

1. `registerCoParent` in `db.js` creates a Firebase Auth account via a **secondary app instance** — this avoids signing out the current user.
2. The co-parent's Firestore profile is created under their own UID (using secondary auth, so security rules pass).
3. All children linked to the current parent get the co-parent's UID added to their `parentUids`.
4. A password reset email is sent so the co-parent can set their own password.
5. The current parent's profile gets a `coParent` field for display in Settings.

Form submissions use `coParentUids[]` — if one parent submits, the other sees the submission and can edit it. Editing updates the same document in-place.

---

## Deployment

```bash
npm run build       # Verify build passes
vercel --prod       # Deploy to production
firebase deploy --only firestore:rules   # Deploy security rules
```

The `api/chat.js` serverless function is picked up automatically by Vercel.

---

## Key architectural decisions

**iOS Safari auth** — `signInWithPopup` is unreliable on iOS WebKit. The app uses `signInWithRedirect` on iOS. `getRedirectResult` is called on every page load.

**Secondary app for co-parent registration** — Creating a Firebase Auth user from the client normally signs out the current user. A named secondary `initializeApp` instance with its own auth maintains a separate session, used only for the registration call then immediately cleaned up with `deleteApp`.

**Optimistic updates** — All mutations update local state immediately and roll back on error. Keeps the UI snappy on slow mobile connections.

**RTL-first layout** — The entire app uses `dir="rtl"`. Tailwind logical properties (`ms-`, `me-`, `ps-`, `pe-`, `text-start`) are used throughout. Hebrew week starts on Sunday.

**Admin notes vs child notes** — `adminNotes/{childId}` is admin-only (invisible to families). `childNotes/{parentId}_{childId}` is per-parent-private. Neither is visible to the other party.

**Forms in Firestore** — Forms and submissions are stored in Firestore (`forms/`, `submissions/`). `formsStorage.js` now only exports ID generators (`newFormId`, `newFieldId`); all data operations go through `db.js`.

**Spreadsheet import** — `xlsx` was replaced with `papaparse` (CSV) + `read-excel-file/browser` (Excel). Both are loaded with dynamic `import()` to keep the initial bundle lean. The `/browser` subpath is required for Vite 8/Rolldown compatibility.

---

## Handoff checklist for a new developer

- [ ] Firebase project created with Auth, Firestore, and Storage enabled
- [ ] Authorized domains configured in Firebase Auth
- [ ] `firestore.rules` deployed
- [ ] All environment variables set in Vercel
- [ ] `ANTHROPIC_API_KEY` added to Vercel (server-side only, no `VITE_` prefix)
- [ ] Vercel project linked to the GitHub repository
- [ ] Demo login disabled before going to production (already gated behind `import.meta.env.DEV`)
- [ ] Replace logo files in `/public/` with the school's actual branding:
  - `logo.png` — original high-res source (≥ 512×512)
  - `icon-512.png` — 512×512 PWA icon
  - `icon-192.png` — 192×192 PWA icon
  - `apple-touch-icon.png` — 180×180 iOS home screen icon
  - `favicon-32.png` — 32×32 browser tab favicon
