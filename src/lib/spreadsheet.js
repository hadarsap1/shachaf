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

// Read a CSV/XLSX file into an array of row arrays (no header handling).
// Throws Hebrew, user-facing errors — the import panels surface e.message.
export async function readSheetRows(file) {
  const name = String(file?.name || '')
  // Case-insensitive: iOS/Windows hand us ".CSV" often enough to matter
  const isCsv = /\.csv$/i.test(name)
  let rows
  if (isCsv) {
    const { default: Papa } = await import('papaparse')
    const text = await file.text()
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
