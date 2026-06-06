# שחף — פלטפורמת קליטה

A Hebrew RTL web application for managing school onboarding of new families. Built with React 19, Firebase, and deployed on Vercel.

---

## What it does

The platform serves three types of users:

| Role | Hebrew | Purpose |
|------|--------|---------|
| `new_family` | משפחה חדשה | Incoming families completing onboarding tasks |
| `host_family` | משפחה מארחת | Mentor families tracking their assigned new families |
| `admin` | מנהל | School staff managing tasks, events, forms, and users |
| `super_admin` | מנהל ראשי | Full access including admin promotion |

**Key features:**
- Onboarding task checklist with milestone grouping
- Calendar (month + week views) with event details and Add-to-Calendar
- AI chat assistant (Claude via `/api/chat`)
- Admin dashboard: user management, bulk CSV/Excel import, forms builder, messages, activity log
- Google login + email/password auth (redirect flow for iOS Safari)
- PWA — installable on home screen, works offline with cached shell

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + Vite 8 + Tailwind CSS v3 |
| Routing | React Router v7 |
| Auth | Firebase Auth (Google + email/password) |
| Database | Firestore |
| Hosting | Vercel |
| AI | Claude API (`claude-haiku-4-5`) via Vercel serverless function |
| PWA | vite-plugin-pwa (Workbox) |
| Spreadsheet import | xlsx |

---

## Project structure

```
shachaf/
├── api/                        # Vercel serverless functions
│   └── chat.js                 # AI chat endpoint (Claude)
├── public/
│   ├── logo.png                # App icon (also used for PWA + iOS)
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppShell.jsx    # Sidebar, mobile bottom nav, header
│   │   └── ui/                 # Shared UI components
│   │       ├── CalendarGrid.jsx
│   │       ├── EventCard.jsx
│   │       ├── EventDetailPanel.jsx
│   │       ├── ProgressRing.jsx
│   │       └── TaskCard.jsx
│   ├── context/
│   │   └── AuthContext.jsx     # Auth state, role resolution, pending-family merge
│   ├── lib/
│   │   ├── db.js               # Firestore helpers (tasks, events, users, etc.)
│   │   ├── firebase.js         # Firebase app initialization
│   │   ├── formsStorage.js     # Forms & submissions (localStorage-backed)
│   │   └── mockData.js         # Dev-mode demo users and seed data
│   └── pages/
│       ├── admin/              # Admin-only pages
│       ├── auth/               # Login page
│       ├── family/             # New-family pages (dashboard, tasks, events…)
│       ├── host/               # Host-family pages (families list)
│       └── super/              # Super-admin pages
├── .env.example                # Required environment variables
├── firestore.rules             # Firestore security rules
├── index.html
├── tailwind.config.js
└── vite.config.js
```

---

## Local setup

### Prerequisites

- Node.js ≥ 22
- A Firebase project with **Firestore** and **Authentication** enabled
- An Anthropic API key (for the AI chat feature)

### Steps

```bash
# 1. Clone and install
git clone <repo-url>
cd shachaf
npm install

# 2. Create your environment file
cp .env.example .env.local

# 3. Fill in .env.local (see section below)

# 4. Start dev server
npm run dev
```

The app runs at `http://localhost:5173`.

**Dev-only shortcut:** In development, the login page shows role buttons that bypass Firebase auth and log you in as a demo user. No real credentials needed to explore the UI.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in every value.

```
# Firebase (get from Firebase Console → Project settings → Your apps → Web app)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Anthropic — used by the /api/chat serverless function
ANTHROPIC_API_KEY=
```

`VITE_` prefix variables are embedded into the frontend bundle at build time. `ANTHROPIC_API_KEY` is server-side only and never exposed to the browser.

For production, set these in **Vercel → Project → Settings → Environment Variables**.

---

## Firebase setup

### Authentication
Enable these providers in Firebase Console → Authentication → Sign-in method:
- **Email/Password**
- **Google**

Add your production domain (e.g. `shachaf.vercel.app`) to **Authorized domains**.

### Firestore
Deploy the security rules:
```bash
npx firebase deploy --only firestore:rules
```

The rules are in `firestore.rules`. Key collections:

| Collection | Description |
|------------|-------------|
| `users/{uid}` | User profile (name, email, role, phone, address) |
| `tasks/{id}` | Onboarding tasks with assignedTo, milestone, status |
| `events/{id}` | School events with date, time, type, targetGroups |
| `pendingFamilies/{email}` | Pre-imported families waiting to register |
| `messages/{id}` | Contact form submissions |
| `activityLog/{id}` | Admin activity feed |

---

## Role system

Roles are stored in `users/{uid}.role`. The auth flow:

1. User signs up (Google or email).
2. `AuthContext` checks `pendingFamilies/{email}` — if found, the imported role (`new_family` or `host_family`) and profile data are applied and the pending record is deleted.
3. If no pending record exists, the default role is `new_family`.
4. Admins promote users via Admin → Users → select user → change role dropdown.

**Super admin** can also promote other users to `admin` via `/super/admins`.

---

## Deployment

The project deploys to Vercel automatically on push to `main` (if connected via the Vercel GitHub integration). To deploy manually:

```bash
npm run build       # Verify build passes first
npx vercel --prod   # Deploy to production
```

The `api/chat.js` serverless function is picked up automatically by Vercel from the `/api` directory.

---

## Key architectural decisions

**iOS Safari auth** — `signInWithPopup` is unreliable on iOS WebKit. The app detects iOS via `navigator.userAgent` and uses `signInWithRedirect` instead. `getRedirectResult` is called on every page load to complete the flow after the redirect returns.

**Optimistic updates** — All mutations (save task, delete event, change role) update local state immediately and roll back on Firestore error. This keeps the UI snappy on slow connections.

**RTL-first layout** — The entire app uses `dir="rtl"`. Tailwind logical properties (`ms-`, `me-`, `ps-`, `pe-`, `text-start`) are used for spacing and alignment. The Hebrew week starts on Sunday.

**Forms storage** — Admin-created forms and user submissions are stored in `localStorage` (not Firestore). This is intentional for the MVP; migrating to Firestore is straightforward.

**Pending families** — Admins can import a CSV/Excel of families before they register. Imported records sit in `pendingFamilies/{email}`. When a matching email signs up, the profile is pre-filled and the pending record is cleaned up.

---

## Development notes

- **Mock login** is only active when `import.meta.env.DEV` is true. Demo users are defined in `src/lib/mockData.js`.
- **Chat rate limiting** is enforced in `api/chat.js`: 30 messages per user per day (keyed by Firebase UID from the Bearer token).
- **PWA updates** are applied automatically on the next page load (`registerType: 'autoUpdate'`). No manual reload prompt needed.
- The `xlsx` library is loaded lazily (dynamic import inside `parseFile`) to keep the initial bundle lean.

---

## Handoff checklist for a new developer

- [ ] Firebase project created with Auth and Firestore enabled
- [ ] Authorized domains configured in Firebase Auth
- [ ] `firestore.rules` deployed
- [ ] All environment variables set in Vercel
- [ ] `ANTHROPIC_API_KEY` added to Vercel (server-side only, no `VITE_` prefix)
- [ ] Vercel project linked to the GitHub repository
- [ ] Demo login disabled before going to production (already gated behind `import.meta.env.DEV`)
- [ ] Replace the logo files in `/public/` with the school's actual branding. Run `sips` (macOS) or use any image editor to regenerate the sizes:
  - `logo.png` — original high-res source (≥ 512×512)
  - `icon-512.png` — 512×512 PWA icon
  - `icon-192.png` — 192×192 PWA icon
  - `apple-touch-icon.png` — 180×180 iOS home screen icon
  - `favicon-32.png` — 32×32 browser tab favicon
