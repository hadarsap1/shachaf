// Link-preview page for a shared event (the card WhatsApp/Telegram/iMessage
// draw instead of a naked URL).
//
// WHAT THIS PAGE DELIBERATELY DOES NOT SAY
// A preview is fetched by the messaging platform's servers with NO sign-in, and
// the card is then visible to anyone the message reaches — including someone
// forwarded into a group who is not in the community at all. So this page
// carries the app's identity and nothing else: no event title, no date, no
// place, no description, and it reads nothing from Firestore. "יום הולדת לנועה,
// גינת כרמים, 17:00" is exactly the kind of line that must not become
// world-readable because a link was forwarded twice.
//
// The details still travel — in the message the sharer writes (lib/eventShare)
// — but that is the sharer's own choice about their own recipients, which is a
// different thing from this server publishing them to whoever holds the URL.
//
// A human who taps the card is sent straight on to the event in the app; a
// crawler stops here and reads the tags. No script is involved (the app's CSP
// blocks inline script, and a meta refresh needs none).

// Firestore ids, and the 'event-<timestamp>' ids the app mints. Anything else
// is not an event id — it is someone probing the endpoint.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/

export function isValidEventId(id) {
  return typeof id === 'string' && ID_RE.test(id)
}

// Escapes for an HTML attribute/text sink. The id is the only value that
// reaches the markup, and it is already restricted to [A-Za-z0-9_-]; this is
// the second lock, so a future caller widening the pattern cannot open an
// injection by accident.
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const PREVIEW_TITLE = 'הזמנה לאירוע — שחף+'
export const PREVIEW_DESCRIPTION =
  'פתחו את הקישור באפליקציה כדי לראות את פרטי האירוע ולאשר הגעה. הפרטים מוצגים לחברי הקהילה בלבד.'

// `origin` must be an absolute https origin — Open Graph images and urls are
// not resolved relative to the page by most crawlers.
export function buildPreviewHtml(eventId, origin) {
  const target = `/events?event=${encodeURIComponent(eventId)}`
  const safeTarget = escapeHtml(target)
  const safeOrigin = escapeHtml(String(origin || '').replace(/\/+$/, ''))
  const canonical = `${safeOrigin}/e/${escapeHtml(eventId)}`

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>${PREVIEW_TITLE}</title>
<meta name="description" content="${PREVIEW_DESCRIPTION}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="שחף+">
<meta property="og:locale" content="he_IL">
<meta property="og:title" content="${PREVIEW_TITLE}">
<meta property="og:description" content="${PREVIEW_DESCRIPTION}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${safeOrigin}/icon-512.png">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${PREVIEW_TITLE}">
<meta name="twitter:description" content="${PREVIEW_DESCRIPTION}">
<meta name="twitter:image" content="${safeOrigin}/icon-512.png">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${safeTarget}">
<link rel="canonical" href="${canonical}">
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
         display: flex; flex-direction: column; align-items: center;
         justify-content: center; min-height: 100vh; margin: 0; color: #1B3B70;
         background: #f8fafc; text-align: center; padding: 24px; }
  img { width: 96px; height: 96px; }
  a { color: #1B3B70; }
</style>
</head>
<body>
<img src="/icon-512.png" alt="שחף+">
<p>פותחים את האירוע…</p>
<p><a href="${safeTarget}">אם הדף לא נפתח מעצמו, לחצו כאן</a></p>
</body>
</html>`
}

// The page a probe gets: same shape, no destination, and never a redirect.
export function buildNotFoundHtml(origin) {
  const safeOrigin = escapeHtml(String(origin || '').replace(/\/+$/, ''))
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>שחף+</title>
<meta name="robots" content="noindex">
<meta property="og:title" content="שחף+">
<meta property="og:description" content="הפלטפורמה הקהילתית של קהילת שחף">
<meta property="og:image" content="${safeOrigin}/icon-512.png">
<style>
  body { font-family: system-ui, sans-serif; text-align: center; padding: 48px;
         color: #1B3B70; }
</style>
</head>
<body>
<p>הקישור אינו תקין.</p>
<p><a href="/events">למעבר לאירועים</a></p>
</body>
</html>`
}
