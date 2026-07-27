// Grade levels + class labeling helpers.
//
// A class may span MULTIPLE grade levels (e.g. גן שחף is both גן חובה and
// גן ט״ח). To stay backward compatible with every place that reads
// cls.grade as a string, multi-grades are stored as one string joined with
// GRADE_SEP ("גן חובה / גן ט״ח") — gradeList() splits it back for editing.

export const GRADES = ['גן טט״ח', 'גן ט״ח', 'גן חובה', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב']

export const GRADE_SEP = ' / '

export function gradeList(grade) {
  return String(grade || '').split(GRADE_SEP).map(s => s.trim()).filter(Boolean)
}

export function isKindergarten(s) {
  return typeof s === 'string' && s.trim().startsWith('גן')
}

// Normalize a class name for MATCHING (import files vs existing classes).
// Strips quotes and BOTH the "כיתה" and "גן" prefixes, so a registry export
// that says "שחפית" matches the existing class "גן שחפית" instead of creating
// a duplicate. Matching only — never use the result as a display name.
export function normalizeClassName(s) {
  return String(s || '')
    .replace(/['׳"״]/g, '')
    .replace(/^(כיתה|גן)\s+/, '')
    .trim()
    .toLowerCase()
}

// Grade to store for a class auto-created during import. Only a real grade
// value counts: a name like "שחפית" must NOT become grade "ש" (that produced
// classes displayed as "כיתה שחפית" instead of "גן שחפית").
export function inferGrade(className) {
  const raw = String(className || '').trim()
  if (isKindergarten(raw)) return 'גן חובה'
  const first = raw[0] || ''
  // single-letter grades ("א", "ב1", "ג'") — the letter is the grade
  return GRADES.includes(first) ? first : ''
}

// "כיתה X" everywhere EXCEPT kindergartens. A class counts as a kindergarten
// when its NAME starts with גן ("גן שחף") OR its GRADE is a garden grade —
// e.g. name "חופית" with grade "גן חובה" is labeled "גן חופית", not
// "כיתה חופית". Also accepts a bare grade as the first argument.
export function classLabel(nameOrGrade, grade = '') {
  if (!nameOrGrade) return ''
  if (isKindergarten(nameOrGrade)) return nameOrGrade
  if (isKindergarten(grade)) return `גן ${nameOrGrade}`
  return `כיתה ${nameOrGrade}`
}
