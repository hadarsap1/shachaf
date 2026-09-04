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

// Short form for tight spaces (avatar-style badges): the class letter/number
// without the גן/כיתה prefix, capped so a name like "גן שחפית" can't overflow
// its badge. "גן שחפית" → "שחפית", "א1" → "א1".
export function classShortLabel(name, max = 6) {
  const s = String(name || '').replace(/^(כיתה|גן)\s+/, '').trim()
  if (!s) return '?'
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// Prefix for "members of…" links: a kindergarten has חברים בגן, not בכיתה.
export function membersOfLabel(name, grade = '') {
  return isKindergarten(name) || isKindergarten(grade) ? 'חברים/ות בגן' : 'חברים/ות בכיתה'
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

// The classes PARALLEL to a member's own: same grade level, different class —
// "השכבה שלי" (א1 alongside א2). Matching is on the stored grade STRING, so a
// class that spans several grades ("גן חובה / גן ט״ח") pairs only with a class
// that spans exactly the same ones. firestore.rules compares the very same
// string, so what the UI offers and what the rules allow cannot drift apart.
export function parallelClasses(allClasses = [], myClasses = []) {
  const myIds = new Set(myClasses.map(c => c.id))
  const myGrades = new Set(myClasses.map(c => c.grade).filter(Boolean))
  return allClasses.filter(c => !myIds.has(c.id) && c.grade && myGrades.has(c.grade))
}

// The grade values a member belongs to — mirrored to users/{uid}.grades, which
// is what the rules read to allow the parallel-class roster.
export function gradesOfClasses(classes = []) {
  return [...new Set(classes.map(c => c.grade).filter(Boolean))]
}
