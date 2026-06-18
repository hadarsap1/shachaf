# Platforms & Services — Shachaf

## Infrastructure

| Service | Purpose | Project/Account |
|---------|---------|----------------|
| **Firebase** | Auth · Firestore · Storage | `sachaf-66ba1` |
| **Vercel** | SPA hosting + serverless API (`api/chat.js`) | vercel.com |
| **GitHub** | Source control | this repo |

## AI / ML

| Service | Model | Purpose |
|---------|-------|---------|
| **Google Gemini** | `gemini-2.5-flash` | AI chat assistant (`/chat`) |

## Frontend Stack

| Tool | Version | Role |
|------|---------|------|
| React | 19 | UI framework |
| Vite | 8 (Rolldown) | Build tool |
| Tailwind CSS | 3 | Styling |
| React Router | 7 | Client-side routing |
| Firebase JS SDK | 12 | Auth · Firestore · Storage client |

## Key Libraries

| Library | Purpose |
|---------|---------|
| `papaparse` | CSV file parsing (family import) |
| `read-excel-file` | Excel file parsing (family import) |
| `lucide-react` | Icons |
| `clsx` | Conditional CSS class utility |

## Environment Variables

### Vercel (server-side, `api/chat.js`)

| Variable | Purpose |
|----------|---------|
| `FIREBASE_API_KEY` | Token validation via Identity Toolkit |
| `FIREBASE_PROJECT_ID` | Firestore REST API endpoint |
| `GEMINI_API_KEY` | Google Gemini AI |

### Local (`.env.local`, prefixed `VITE_`)

| Variable | Purpose |
|----------|---------|
| `VITE_FIREBASE_API_KEY` | Firebase client SDK |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth |
| `VITE_FIREBASE_PROJECT_ID` | Firestore |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase config |
| `VITE_FIREBASE_APP_ID` | Firebase config |

## Google Drive / Sheets

No direct API integration. The import page instructs users to export Google Sheets as Excel (`.xlsx`) manually.
