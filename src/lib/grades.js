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
