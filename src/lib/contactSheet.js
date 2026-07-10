// Class contact-sheet (דף קשר) generator.
// Builds a self-contained SVG (no external images → canvas export never taints,
// works on iOS Safari) that can be rasterized to JPEG for download / WhatsApp
// share. Rendered as an <img> data URL, so user text is escaped data, not DOM.

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Clip a string to n chars so long names don't overflow a card
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

// Restore the leading zero Sheets strips from IL mobile numbers, and format
// as 0xx-xxxxxxx. Leaves anything that isn't a bare 9/10-digit IL mobile as-is.
export function formatILPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '')
  let n = d
  if (/^5\d{8}$/.test(d)) n = '0' + d            // 9 digits starting 5 → add 0
  if (/^0\d{9}$/.test(n)) return n.slice(0, 3) + '-' + n.slice(3)
  return String(raw || '').trim()
}

// ── Build editable entries from a class's children ─────────────────────────────
// entry = { name: childName, lines: ['הורה טלפון', ...], photo?: dataURL }
export function entriesFromChildren(children) {
  return [...children]
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'))
    .map(c => ({
      name: c.name || '',
      lines: (c.parents || [])
        .filter(p => p.name || p.phone)
        .map(p => [p.name, formatILPhone(p.phone)].filter(Boolean).join('  ')),
    }))
}

// ── Child photos → embedded data URLs ──────────────────────────────────────────
// Photos only appear on the sheet when a parent chose to upload one. They are
// downscaled to a small square and embedded as data URIs, preserving the
// module's invariant: the SVG stays self-contained, so canvas export never
// taints. Fetch/decode failures degrade silently to a sheet without the photo.
async function photoToDataUrl(url, size) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`photo fetch ${res.status}`)
  const blob = await res.blob()
  const objUrl = URL.createObjectURL(blob)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('photo decode failed'))
      i.src = objUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    // cover-crop to a centered square
    const s = Math.min(img.width, img.height)
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
    return canvas.toDataURL('image/jpeg', 0.8)
  } finally {
    URL.revokeObjectURL(objUrl)
  }
}

// Resolve { childName → photo dataURL } for children whose parents uploaded a
// photo. Browser-only (uses Image/canvas).
export async function loadChildPhotoMap(children, size = 112) {
  const withPhoto = children.filter(c => c.name && c.photoUrl)
  const results = await Promise.allSettled(
    withPhoto.map(c => photoToDataUrl(c.photoUrl, size))
  )
  const map = {}
  withPhoto.forEach((c, i) => {
    if (results[i].status === 'fulfilled') map[c.name] = results[i].value
  })
  return map
}

// ── Templates ──────────────────────────────────────────────────────────────────
// Each returns an SVG string sized to fit all entries.
export const TEMPLATES = [
  { id: 'cards',   label: 'כרטיסים' },
  { id: 'list',    label: 'רשימה' },
  { id: 'compact', label: 'קומפקטי' },
]

const FONT = "'Assistant','Rubik','Heebo','Arial',sans-serif"

// ── Color themes ────────────────────────────────────────────────────────────────
// palette: page (outer), panel (inner bg), panelStroke, card, cardStroke,
// title, name, text, muted, row (list stripe)
export const THEMES = [
  { id: 'pink',   label: 'ורוד',   swatch: '#fbcfd6', p: { panel: '#fdf2f4', panelStroke: '#f9c7d0', card: '#fbcfd6', cardStroke: '#e58aa0', title: '#1B3B70', name: '#1B3B70', text: '#334155', muted: '#94a3b8', row: '#ffffff' } },
  { id: 'blue',   label: 'כחול',   swatch: '#bfdbfe', p: { panel: '#eff6ff', panelStroke: '#bfdbfe', card: '#dbeafe', cardStroke: '#60a5fa', title: '#1e3a8a', name: '#1e3a8a', text: '#1e293b', muted: '#94a3b8', row: '#ffffff' } },
  { id: 'green',  label: 'ירוק',   swatch: '#bbf7d0', p: { panel: '#f0fdf4', panelStroke: '#bbf7d0', card: '#dcfce7', cardStroke: '#4ade80', title: '#14532d', name: '#14532d', text: '#1e293b', muted: '#9ca3af', row: '#ffffff' } },
  { id: 'purple', label: 'סגול',   swatch: '#e9d5ff', p: { panel: '#faf5ff', panelStroke: '#e9d5ff', card: '#f3e8ff', cardStroke: '#c084fc', title: '#581c87', name: '#581c87', text: '#1e293b', muted: '#9ca3af', row: '#ffffff' } },
  { id: 'peach',  label: 'אפרסק',  swatch: '#fed7aa', p: { panel: '#fff7ed', panelStroke: '#fed7aa', card: '#ffedd5', cardStroke: '#fb923c', title: '#7c2d12', name: '#7c2d12', text: '#1e293b', muted: '#9ca3af', row: '#ffffff' } },
  { id: 'teal',   label: 'טורקיז', swatch: '#99f6e4', p: { panel: '#f0fdfa', panelStroke: '#99f6e4', card: '#ccfbf1', cardStroke: '#2dd4bf', title: '#134e4a', name: '#134e4a', text: '#1e293b', muted: '#9ca3af', row: '#ffffff' } },
]
const paletteFor = (id) => (THEMES.find(t => t.id === id) || THEMES[0]).p

function header(w, title, subtitle, p) {
  return `
    <text x="${w / 2}" y="60" text-anchor="middle" font-family="${FONT}" font-size="42" font-weight="800" fill="${p.title}">${esc(title)}</text>
    ${subtitle ? `<text x="${w / 2}" y="98" text-anchor="middle" font-family="${FONT}" font-size="22" fill="${p.muted}">${esc(subtitle)}</text>` : ''}`
}

function footer(w, h, p) {
  return `<text x="${w / 2}" y="${h - 24}" text-anchor="middle" font-family="${FONT}" font-size="20" fill="${p.muted}">קהילת שחף 🕊️</text>`
}

// No direction="rtl" on the root: it flips text-anchor semantics (end↔start)
// and breaks right-aligned templates. Hebrew glyphs still shape correctly via
// Unicode bidi within each <text>. Anchoring is done explicitly per template.
// xmlns:xlink is declared because photo circles emit both href + xlink:href.
function svgWrap(w, h, body, p) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="#ffffff"/>
    <rect x="10" y="10" width="${w - 20}" height="${h - 20}" rx="24" fill="${p.panel}" stroke="${p.panelStroke}" stroke-width="2"/>
    ${body}
  </svg>`
}

// Circular child photo (clip-path) — or an initial-letter disc when the entry
// has no uploaded photo but the sheet is in photo mode, so rows stay aligned.
function photoCircle(id, cx, cy, r, entry, p) {
  if (entry.photo) {
    const href = esc(entry.photo)
    return `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
      <image href="${href}" xlink:href="${href}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${p.cardStroke}" stroke-width="2"/>`
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${p.cardStroke}" opacity="0.35"/>
    <text x="${cx}" y="${cy + r * 0.36}" text-anchor="middle" font-family="${FONT}" font-size="${Math.round(r * 1.05)}" font-weight="700" fill="${p.name}">${esc((entry.name || '?')[0])}</text>`
}

function cardsTemplate(entries, title, subtitle, p) {
  const w = 1080, cols = 2, pad = 40, gap = 24
  const top = 140
  const cardW = (w - pad * 2 - gap * (cols - 1)) / cols
  const hasPhotos = entries.some(e => e.photo)
  const cardH = hasPhotos ? 208 : 150
  const rows = Math.ceil(entries.length / cols)
  const h = top + rows * (cardH + gap) + 80
  let body = header(w, title, subtitle, p)
  entries.forEach((e, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const x = pad + col * (cardW + gap)
    const y = top + row * (cardH + gap)
    const cx = x + cardW / 2
    body += `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="20" fill="${p.card}" stroke="${p.cardStroke}" stroke-width="2" stroke-dasharray="6 5"/>`
    if (hasPhotos) {
      body += photoCircle(`cph${i}`, cx, y + 48, 32, e, p)
      body += `<text x="${cx}" y="${y + 112}" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="700" fill="${p.name}">${esc(clip(e.name, 26))}</text>`
      e.lines.slice(0, 3).forEach((ln, k) => {
        body += `<text x="${cx}" y="${y + 142 + k * 26}" text-anchor="middle" font-family="${FONT}" font-size="20" fill="${p.text}">${esc(clip(ln, 32))}</text>`
      })
    } else {
      body += `<text x="${cx}" y="${y + 42}" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="700" fill="${p.name}">${esc(clip(e.name, 26))}</text>`
      e.lines.slice(0, 3).forEach((ln, k) => {
        body += `<text x="${cx}" y="${y + 78 + k * 28}" text-anchor="middle" font-family="${FONT}" font-size="21" fill="${p.text}">${esc(clip(ln, 32))}</text>`
      })
    }
  })
  body += footer(w, h, p)
  return svgWrap(w, h, body, p)
}

function listTemplate(entries, title, subtitle, p) {
  const w = 1080, pad = 48, top = 140
  const hasPhotos = entries.some(e => e.photo)
  const rowH = hasPhotos ? 88 : 76
  const textX = hasPhotos ? w - pad - 76 : w - pad
  const h = top + entries.length * rowH + 80
  let body = header(w, title, subtitle, p)
  entries.forEach((e, i) => {
    const y = top + i * rowH
    if (i % 2 === 0) body += `<rect x="${pad - 12}" y="${y - 4}" width="${w - (pad - 12) * 2}" height="${rowH - 8}" rx="12" fill="${p.row}"/>`
    if (hasPhotos) body += photoCircle(`lph${i}`, w - pad - 32, y + rowH / 2 - 4, 30, e, p)
    body += `<text x="${textX}" y="${y + 30}" text-anchor="end" font-family="${FONT}" font-size="26" font-weight="700" fill="${p.name}">${esc(clip(e.name, 30))}</text>
      <text x="${textX}" y="${y + 58}" text-anchor="end" font-family="${FONT}" font-size="21" fill="${p.text}">${esc(clip(e.lines.join('   ·   '), 60))}</text>`
  })
  body += footer(w, h, p)
  return svgWrap(w, h, body, p)
}

function compactTemplate(entries, title, subtitle, p) {
  const w = 1080, cols = 3, pad = 32, gap = 16, top = 140
  const cardW = (w - pad * 2 - gap * (cols - 1)) / cols
  const hasPhotos = entries.some(e => e.photo)
  const cardH = hasPhotos ? 164 : 118
  const rows = Math.ceil(entries.length / cols)
  const h = top + rows * (cardH + gap) + 76
  let body = header(w, title, subtitle, p)
  entries.forEach((e, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const x = pad + col * (cardW + gap)
    const y = top + row * (cardH + gap)
    const cx = x + cardW / 2
    body += `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="16" fill="${p.card}"/>`
    if (hasPhotos) {
      body += photoCircle(`sph${i}`, cx, y + 36, 24, e, p)
      body += `<text x="${cx}" y="${y + 84}" text-anchor="middle" font-family="${FONT}" font-size="21" font-weight="700" fill="${p.name}">${esc(clip(e.name, 20))}</text>`
      e.lines.slice(0, 2).forEach((ln, k) => {
        body += `<text x="${cx}" y="${y + 110 + k * 23}" text-anchor="middle" font-family="${FONT}" font-size="17" fill="${p.text}">${esc(clip(ln, 24))}</text>`
      })
    } else {
      body += `<text x="${cx}" y="${y + 34}" text-anchor="middle" font-family="${FONT}" font-size="21" font-weight="700" fill="${p.name}">${esc(clip(e.name, 20))}</text>`
      e.lines.slice(0, 2).forEach((ln, k) => {
        body += `<text x="${cx}" y="${y + 62 + k * 24}" text-anchor="middle" font-family="${FONT}" font-size="17" fill="${p.text}">${esc(clip(ln, 24))}</text>`
      })
    }
  })
  body += footer(w, h, p)
  return svgWrap(w, h, body, p)
}

export function buildSheetSvg({ template, title, subtitle, entries, theme }) {
  const list = entries.filter(e => e.name)
  const p = paletteFor(theme)
  if (template === 'list') return listTemplate(list, title, subtitle, p)
  if (template === 'compact') return compactTemplate(list, title, subtitle, p)
  return cardsTemplate(list, title, subtitle, p)
}

// ── Rasterize SVG → JPEG blob ──────────────────────────────────────────────────
// Uses a data: URL (not a Blob object URL): the object-URL path fails to load
// as an <img> for SVG in some engines and taints the canvas in others; the
// data URL is the reliable path (same one the on-screen preview uses).
export function svgToJpegBlob(svg, quality = 0.92) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const scale = 1.5   // crisp text on retina / print
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(b => {
          if (b) return resolve(b)
          // Fallback for engines where toBlob yields null
          try {
            const bin = atob(canvas.toDataURL('image/jpeg', quality).split(',')[1])
            const arr = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
            resolve(new Blob([arr], { type: 'image/jpeg' }))
          } catch (e) { reject(e) }
        }, 'image/jpeg', quality)
      } catch (e) { reject(e) }
    }
    img.onerror = () => reject(new Error('svg load failed'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}
