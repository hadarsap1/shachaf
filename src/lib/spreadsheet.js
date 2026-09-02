import { normalizeName } from './hebrewName'

// Shared spreadsheet reader for the admin import screens (children, families,
// class member lists).
//
// WHY THIS EXISTS: read-excel-file v9 CHANGED its default export. It used to
// resolve to the rows themselves (`[[a, b], [c, d]]`); since v9 it resolves to
// one entry PER SHEET (`[{ sheet: 'Sheet1', data: [[a, b], ...] }]`). Call
// sites that kept treating the result as rows crashed with
// "rawRows[0].map is not a function" on every .xlsx import. normalizeSheetResult
// accepts BOTH shapes so an upgrade (or downgrade) can't break imports again.

// Pure + unit-tested: takes whatever readXlsxFile resolved to, returns rows.
export function normalizeSheetResult(result) {
  if (!Array.isArray(result)) return []
  // v9 shape: array of { sheet, data } — use the first sheet that has rows
  const isSheetObject = (x) => x && !Array.isArray(x) && typeof x === 'object' && Array.isArray(x.data)
  if (result.some(isSheetObject)) {
    const sheet = result.find(s => isSheetObject(s) && s.data.length) || result.find(isSheetObject)
    return sheet ? sheet.data : []
  }
  // legacy shape: already rows (array of arrays)
  return result.filter(Array.isArray)
}

// Drop rows that are entirely empty — spreadsheets often carry trailing blanks
// that would otherwise be parsed as junk records.
export function dropEmptyRows(rows) {
  return rows.filter(r => Array.isArray(r) && r.some(c => String(c ?? '').trim() !== ''))
}

export function stripBom(text) {
  return String(text ?? '').replace(/^\uFEFF/, '')
}

// Read a CSV/XLSX file into an array of row arrays (no header handling).
// Throws Hebrew, user-facing errors — the import panels surface e.message.
export async function readSheetRows(file) {
  const name = String(file?.name || '')
  // Case-insensitive: iOS/Windows hand us ".CSV" often enough to matter
  const isCsv = /\.csv$/i.test(name)
  let rows
  if (isCsv) {
    const { default: Papa } = await import('papaparse')
    // Strip the UTF-8 BOM Excel writes for Hebrew files — left in place it
    // becomes part of the first header ("\ufeffכיתה"), so every column lookup
    // that keys off the first column silently misses.
    const text = stripBom(await file.text())
    rows = Papa.parse(text, { header: false, skipEmptyLines: true }).data
  } else {
    const { default: readXlsxFile } = await import('read-excel-file/browser')
    rows = normalizeSheetResult(await readXlsxFile(file))
  }
  rows = dropEmptyRows(rows || [])
  if (!rows.length) throw new Error('הקובץ ריק או שלא זוהו בו שורות')
  if (!Array.isArray(rows[0])) {
    throw new Error('לא ניתן לקרוא את הקובץ — נסו לשמור אותו כ-CSV ולייבא מחדש')
  }
  return rows
}

// Same as readSheetRows, but returns { headers, data } where data is an array
// of objects keyed by the header row — the shape the family/class importers use.
export async function readSheetObjects(file) {
  const rows = await readSheetRows(file)
  const headers = rows[0].map(h => String(h ?? '').trim())
  const data = rows.slice(1).map(row => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] })
    return obj
  })
  return { headers, data }
}

// ── Merge helpers for the admin importers ─────────────────────────────────────
// The school phone book is re-imported every year, so an import has to ADD to
// what's on file rather than replace it: never drop a person, never silently
// overwrite a field someone already filled in, and treat a row that's already
// in the system as a no-op instead of a second copy of the same child.

// Match key for a person's name. The phone book and the app disagree about
// spacing around hyphens ("בר - און" vs "בר-און") and about the geresh, so fold
// both away before comparing.
export function personKey(name) {
  return normalizeName(name)
    .replace(/['"׳״]/g, '')
    .replace(/\s*[-־]\s*/g, '-')
    .toLowerCase()
}

// Split parsed child rows into the ones worth importing and the ones already on
// file (or repeated inside the file itself). `existing` is the children list the
// admin page already loaded.
export function splitNewChildren(rows, existing = []) {
  const byKey = new Map(existing.map(c => [personKey(c.name), c]))
  const seen = new Set()
  const toImport = []
  const duplicates = []
  for (const row of rows) {
    const key = personKey(row.name)
    if (!key) continue
    const match = byKey.get(key)
    if (match || seen.has(key)) {
      duplicates.push({ ...row, existing: match || null })
      continue
    }
    seen.add(key)
    toImport.push(row)
  }
  return { toImport, duplicates }
}

const STAFF_FIELDS = ['title', 'phone', 'email']

// Merge staff rows from a file into the saved list: fills BLANK fields, appends
// people who aren't listed yet, and never removes or replaces anything. A value
// that differs from one already on file is reported as a conflict for the admin
// to resolve by hand — an outdated phone is not worth overwriting a correction.
export function mergeStaff(current = [], incoming = []) {
  const merged = current.map(p => ({ ...p }))
  const byKey = new Map()
  merged.forEach((p, i) => { if (!byKey.has(personKey(p.name))) byKey.set(personKey(p.name), i) })
  let added = 0
  let filled = 0
  const conflicts = []
  for (const row of incoming) {
    const key = personKey(row.name)
    if (!key) continue
    const i = byKey.get(key)
    if (i === undefined) {
      merged.push({ name: normalizeName(row.name), title: row.title || '', phone: row.phone || '', email: row.email || '' })
      byKey.set(key, merged.length - 1)
      added++
      continue
    }
    const person = merged[i]
    let touched = false
    for (const field of STAFF_FIELDS) {
      const next = String(row[field] ?? '').trim()
      const now  = String(person[field] ?? '').trim()
      if (!next) continue
      if (!now) { person[field] = next; touched = true }
      else if (now !== next) conflicts.push({ name: person.name, field, current: now, incoming: next })
    }
    if (touched) filled++
  }
  return { merged, added, filled, conflicts }
}
