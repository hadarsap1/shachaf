import {
  isValidEventId, buildPreviewHtml, buildNotFoundHtml,
} from './_ogPreview.js'

// GET /e/<eventId>  (rewritten to /api/event-preview?id=<eventId> by vercel.json)
//
// Serves the link-preview page: the card a messaging app draws for a shared
// event, and an immediate hand-off to the event itself for a human. See
// _ogPreview.js for what the card may and may not contain — it reads nothing
// from the database and needs no credentials, which is the point.
export default function handler(req, res) {
  const id = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id
  const host = req.headers['x-forwarded-host'] || req.headers.host || ''
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0]
  const origin = host ? `${proto}://${host}` : ''

  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  if (!isValidEventId(id)) {
    // 404, not a redirect: a probe learns nothing, and a crawler does not
    // cache a bad card against the real link.
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.status(404).send(buildNotFoundHtml(origin))
    return
  }

  // Short cache: crawlers re-fetch, and the page is identical for every event
  // anyway, so there is nothing here worth caching for long.
  res.setHeader('Cache-Control', 'public, max-age=600')
  res.status(200).send(buildPreviewHtml(id, origin))
}
