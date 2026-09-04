import { describe, it, expect, vi, afterEach } from 'vitest'
import handler, { parsePhotoUrl, allowedBuckets } from './photo.js'

const BUCKETS = ['shachaf.appspot.com']
const OK = 'https://firebasestorage.googleapis.com/v0/b/shachaf.appspot.com/o/children%2Fabc%2Fphoto.jpg?alt=media&token=t-1'

describe('allowedBuckets', () => {
  it('accepts both default bucket names of the project', () => {
    expect(allowedBuckets({ FIREBASE_PROJECT_ID: 'p' }))
      .toEqual(['p.appspot.com', 'p.firebasestorage.app'])
  })

  it('derives the project from the configured bucket, old name or new', () => {
    for (const b of ['p.appspot.com', 'p.firebasestorage.app']) {
      expect(allowedBuckets({ VITE_FIREBASE_STORAGE_BUCKET: b }))
        .toEqual(['p.appspot.com', 'p.firebasestorage.app'])
    }
  })

  it('keeps a custom bucket name that is neither default', () => {
    expect(allowedBuckets({ FIREBASE_STORAGE_BUCKET: 'custom-bucket', FIREBASE_PROJECT_ID: 'p' }))
      .toEqual(['p.appspot.com', 'p.firebasestorage.app', 'custom-bucket'])
  })

  it('is null when nothing is configured', () => {
    expect(allowedBuckets({})).toBe(null)
  })
})

describe('parsePhotoUrl', () => {
  it('accepts a child photo download URL of the configured bucket', () => {
    const r = parsePhotoUrl(OK, BUCKETS)
    expect(r.error).toBe(undefined)
    expect(r.bucket).toBe('shachaf.appspot.com')
    expect(r.path).toBe('children/abc/photo.jpg')
  })

  it('relays only Firebase Storage over https — no other host, scheme or internal address', () => {
    for (const u of [
      'https://evil.example/x.jpg',
      'http://firebasestorage.googleapis.com/v0/b/shachaf.appspot.com/o/children%2Fa.jpg?token=t',
      'https://firebasestorage.googleapis.com.evil.example/v0/b/shachaf.appspot.com/o/children%2Fa.jpg?token=t',
      'http://169.254.169.254/latest/meta-data/',
      'file:///etc/passwd',
      'not a url',
      '',
      undefined,
    ]) {
      expect(parsePhotoUrl(u, BUCKETS).error, String(u)).toBeTruthy()
    }
  })

  it('rejects another project bucket when one is configured', () => {
    const other = OK.replace('shachaf.appspot.com', 'someone-else.appspot.com')
    expect(parsePhotoUrl(other, BUCKETS).error).toBeTruthy()
    // …and allows it when this deployment configured no bucket of its own
    expect(parsePhotoUrl(other, null).error).toBe(undefined)
  })

  it('relays child photos only — not avatars, not other folders, not traversal', () => {
    const swap = (p) => `https://firebasestorage.googleapis.com/v0/b/shachaf.appspot.com/o/${p}?alt=media&token=t`
    expect(parsePhotoUrl(swap('users%2Fu1%2Favatar.jpg'), BUCKETS).error).toBeTruthy()
    expect(parsePhotoUrl(swap('feedback%2Ff1.png'), BUCKETS).error).toBeTruthy()
    expect(parsePhotoUrl(swap('children%2F..%2Ffeedback%2Ff1.png'), BUCKETS).error).toBeTruthy()
    expect(parsePhotoUrl(swap('children%2Fabc%2Fphoto.jpg'), BUCKETS).error).toBe(undefined)
  })

  it('requires the access token the caller already holds', () => {
    expect(parsePhotoUrl(OK.replace('&token=t-1', ''), BUCKETS).error).toBeTruthy()
  })
})

// ── the handler itself, with Storage stubbed out ──────────────────────────────
function mockRes() {
  const res = { headers: {}, code: 0, body: null }
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v }
  res.status = (c) => { res.code = c; return res }
  res.json = (b) => { res.body = b; return res }
  res.send = (b) => { res.body = b; return res }
  return res
}
const stubStorage = (init) => vi.stubGlobal('fetch', vi.fn(async () => init))

afterEach(() => vi.unstubAllGlobals())

describe('handler', () => {
  it('relays the image bytes with its own content type', async () => {
    stubStorage({
      ok: true, status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg', 'content-length': '4' }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    })
    const res = mockRes()
    await handler({ method: 'GET', query: { u: OK } }, res)
    expect(res.code).toBe(200)
    expect(res.headers['content-type']).toBe('image/jpeg')
    expect(res.headers['cache-control']).toBe('private, max-age=300')
    expect(Buffer.from(res.body)).toEqual(Buffer.from([1, 2, 3, 4]))
  })

  it('refuses a URL that is not a child photo, without calling Storage', async () => {
    stubStorage({ ok: true })
    const res = mockRes()
    await handler({ method: 'GET', query: { u: 'https://evil.example/x.jpg' } }, res)
    expect(res.code).toBe(400)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('refuses to relay a non-image, whatever the object turns out to be', async () => {
    stubStorage({
      ok: true, status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: async () => new ArrayBuffer(0),
    })
    const res = mockRes()
    await handler({ method: 'GET', query: { u: OK } }, res)
    expect(res.code).toBe(415)
  })

  it('passes a missing object through as 404', async () => {
    stubStorage({ ok: false, status: 404, headers: new Headers() })
    const res = mockRes()
    await handler({ method: 'GET', query: { u: OK } }, res)
    expect(res.code).toBe(404)
  })

  it('is GET only', async () => {
    const res = mockRes()
    await handler({ method: 'POST', query: {} }, res)
    expect(res.code).toBe(405)
  })
})
