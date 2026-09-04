// GET /api/photo?u=<Firebase Storage download URL>
//
// Same-origin relay for child photos — used only by the contact-sheet builder.
//
// Why it exists: the sheet embeds every photo as a data URI so the exported
// SVG/JPEG stays self-contained (that is what makes the export work on iOS and
// keeps the canvas untainted). Building that data URI means reading the image's
// PIXELS, which needs a CORS-enabled response. A Firebase Storage bucket with
// no CORS configuration serves download URLs without those headers, so the
// browser blocks fetch() on exactly the same URL that renders fine in an <img>
// elsewhere in the app — photos show in the class roster and vanish from the
// contact sheet. Relaying through our own origin removes the cross-origin step
// entirely, with no infrastructure change. (Configuring the bucket — cors.json
// in the repo root — makes the client skip this relay; it stays as a fallback.)
//
// Nothing is exposed that the caller did not already hold: a Storage download
// URL carries its own access token, and only image objects under children/ in
// this project's bucket are relayed.

const HOST = 'firebasestorage.googleapis.com'
const MAX_BYTES = 15 * 1024 * 1024   // mirrors the upload cap in storage.rules
const PATH_PREFIX = 'children/'

// The buckets this deployment may relay from: both default names of its own
// Firebase project. A project that moved from <id>.appspot.com to
// <id>.firebasestorage.app still serves photos uploaded under the old name, and
// the download URLs in Firestore keep whichever name they were minted with — so
// pinning a single name would reject half the class. Returns null when nothing
// is configured; see parsePhotoUrl for what null means.
export function allowedBuckets(env = process.env) {
  const explicit = env.FIREBASE_STORAGE_BUCKET || env.VITE_FIREBASE_STORAGE_BUCKET
  const project = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID
    || (explicit || '').replace(/\.(appspot\.com|firebasestorage\.app)$/, '')
  if (!project) return explicit ? [explicit] : null
  const buckets = [`${project}.appspot.com`, `${project}.firebasestorage.app`]
  if (explicit && !buckets.includes(explicit)) buckets.push(explicit)
  return buckets
}

// Validate the requested URL and pull the object path out of it. Returns
// { url, bucket, path } or { error }. `buckets: null` (no bucket configured
// for this deployment) still constrains host, path and token — a relay of a
// public tokened URL the caller already has, and nothing more.
export function parsePhotoUrl(raw, buckets) {
  let url
  try { url = new URL(String(raw || '')) } catch { return { error: 'לא כתובת תקינה' } }
  if (url.protocol !== 'https:' || url.hostname !== HOST) return { error: 'מקור לא מורשה' }

  const m = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/)
  if (!m) return { error: 'לא כתובת של קובץ' }

  const bucket = m[1]
  if (buckets && !buckets.includes(bucket)) return { error: 'מקור לא מורשה' }

  let path
  try { path = decodeURIComponent(m[2]) } catch { return { error: 'לא כתובת תקינה' } }
  if (!path.startsWith(PATH_PREFIX) || path.includes('..')) return { error: 'לא תמונת ילד' }

  // A download URL without its access token is not one the caller already
  // holds — relaying it would turn this into a lookup service for the bucket.
  if (!url.searchParams.get('token')) return { error: 'חסר אסימון גישה' }

  return { url: url.toString(), bucket, path }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method not allowed' })
  }

  const raw = Array.isArray(req.query?.u) ? req.query.u[0] : req.query?.u
  const parsed = parsePhotoUrl(raw, allowedBuckets())
  if (parsed.error) return res.status(400).json({ error: parsed.error })

  let upstream
  try {
    upstream = await fetch(parsed.url)
  } catch {
    return res.status(502).json({ error: 'התמונה לא נטענה' })
  }
  if (!upstream.ok) return res.status(upstream.status === 404 ? 404 : 502).json({ error: 'התמונה לא נמצאה' })

  const type = (upstream.headers.get('content-type') || '').split(';')[0].trim()
  if (!type.startsWith('image/')) return res.status(415).json({ error: 'לא תמונה' })

  const declared = parseInt(upstream.headers.get('content-length') || '0', 10)
  if (declared > MAX_BYTES) return res.status(413).json({ error: 'התמונה גדולה מדי' })

  const buf = Buffer.from(await upstream.arrayBuffer())
  if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'התמונה גדולה מדי' })

  res.setHeader('Content-Type', type)
  res.setHeader('Content-Length', String(buf.length))
  // A child's photo is personal data: cache in the requesting browser only,
  // never in a shared/CDN cache.
  res.setHeader('Cache-Control', 'private, max-age=300')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  return res.status(200).send(buf)
}
