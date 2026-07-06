// Class contact-sheet (דף קשר) generator.
// Builds a self-contained SVG (no external images → canvas export never taints,
// works on iOS Safari) that can be rasterized to JPEG for download / WhatsApp
// share. Rendered as an <img> data URL, so user text is escaped data, not DOM.

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Clip a string to n chars so long names don't overflow a card
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

// ── Build editable entries from a class's children ─────────────────────────────
// entry = { name: childName, lines: ['הורה טלפון', ...] }
export function entriesFromChildren(children) {
  return [...children]
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'))
    .map(c => ({
      name: c.name || '',
      lines: (c.parents || [])
        .filter(p => p.name || p.phone)
        .map(p => [p.name, p.phone].filter(Boolean).join('  ')),
    }))
}

// ── Templates ──────────────────────────────────────────────────────────────────
// Each returns an SVG string sized to fit all entries.
export const TEMPLATES = [
  { id: 'cards',   label: 'כרטיסים' },
  { id: 'list',    label: 'רשימה' },
  { id: 'compact', label: 'קומפקטי' },
]

const FONT = "'Assistant','Rubik','Heebo','Arial',sans-serif"

function header(w, title, subtitle) {
  return `
    <text x="${w / 2}" y="60" text-anchor="middle" font-family="${FONT}" font-size="42" font-weight="800" fill="#1B3B70">${esc(title)}</text>
    ${subtitle ? `<text x="${w / 2}" y="98" text-anchor="middle" font-family="${FONT}" font-size="22" fill="#64748b">${esc(subtitle)}</text>` : ''}`
}

function footer(w, h) {
  return `<text x="${w / 2}" y="${h - 24}" text-anchor="middle" font-family="${FONT}" font-size="20" fill="#94a3b8">קהילת שחף 🕊️</text>`
}

function svgWrap(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" direction="rtl">
    <rect width="${w}" height="${h}" fill="#ffffff"/>
    <rect x="10" y="10" width="${w - 20}" height="${h - 20}" rx="24" fill="#fdf2f4" stroke="#f9c7d0" stroke-width="2"/>
    ${body}
  </svg>`
}

function cardsTemplate(entries, title, subtitle) {
  const w = 1080, cols = 2, pad = 40, gap = 24
  const top = 140
  const cardW = (w - pad * 2 - gap * (cols - 1)) / cols
  const cardH = 150
  const rows = Math.ceil(entries.length / cols)
  const h = top + rows * (cardH + gap) + 80
  let body = header(w, title, subtitle)
  entries.forEach((e, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const x = pad + col * (cardW + gap)
    const y = top + row * (cardH + gap)
    const cx = x + cardW / 2
    const lines = e.lines.slice(0, 3)
    body += `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="20" fill="#fbcfd6" stroke="#5fb6c9" stroke-width="2" stroke-dasharray="6 5"/>
      <text x="${cx}" y="${y + 42}" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="700" fill="#1B3B70">${esc(clip(e.name, 26))}</text>`
    lines.forEach((ln, k) => {
      body += `<text x="${cx}" y="${y + 78 + k * 28}" text-anchor="middle" font-family="${FONT}" font-size="21" fill="#334155">${esc(clip(ln, 32))}</text>`
    })
  })
  body += footer(w, h)
  return svgWrap(w, h, body)
}

function listTemplate(entries, title, subtitle) {
  const w = 1080, pad = 48, top = 140, rowH = 76
  const h = top + entries.length * rowH + 80
  let body = header(w, title, subtitle)
  entries.forEach((e, i) => {
    const y = top + i * rowH
    if (i % 2 === 0) body += `<rect x="${pad - 12}" y="${y - 4}" width="${w - (pad - 12) * 2}" height="${rowH - 8}" rx="12" fill="#ffffff"/>`
    body += `<text x="${w - pad}" y="${y + 30}" text-anchor="end" font-family="${FONT}" font-size="26" font-weight="700" fill="#1B3B70">${esc(clip(e.name, 30))}</text>
      <text x="${w - pad}" y="${y + 58}" text-anchor="end" font-family="${FONT}" font-size="21" fill="#475569">${esc(clip(e.lines.join('   ·   '), 60))}</text>`
  })
  body += footer(w, h)
  return svgWrap(w, h, body)
}

function compactTemplate(entries, title, subtitle) {
  const w = 1080, cols = 3, pad = 32, gap = 16, top = 140
  const cardW = (w - pad * 2 - gap * (cols - 1)) / cols
  const cardH = 118
  const rows = Math.ceil(entries.length / cols)
  const h = top + rows * (cardH + gap) + 76
  let body = header(w, title, subtitle)
  entries.forEach((e, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const x = pad + col * (cardW + gap)
    const y = top + row * (cardH + gap)
    const cx = x + cardW / 2
    body += `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="16" fill="#fbcfd6"/>
      <text x="${cx}" y="${y + 34}" text-anchor="middle" font-family="${FONT}" font-size="21" font-weight="700" fill="#1B3B70">${esc(clip(e.name, 20))}</text>`
    e.lines.slice(0, 2).forEach((ln, k) => {
      body += `<text x="${cx}" y="${y + 62 + k * 24}" text-anchor="middle" font-family="${FONT}" font-size="17" fill="#334155">${esc(clip(ln, 24))}</text>`
    })
  })
  body += footer(w, h)
  return svgWrap(w, h, body)
}

export function buildSheetSvg({ template, title, subtitle, entries }) {
  const list = entries.filter(e => e.name)
  if (template === 'list') return listTemplate(list, title, subtitle)
  if (template === 'compact') return compactTemplate(list, title, subtitle)
  return cardsTemplate(list, title, subtitle)
}

// ── Rasterize SVG → JPEG blob ──────────────────────────────────────────────────
export function svgToJpegBlob(svg, quality = 0.92) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      // 1.5× for crisp text on retina/print
      const scale = 1.5
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('svg load failed')) }
    img.src = url
  })
}
