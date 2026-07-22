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

// "כיתה X" everywhere EXCEPT kindergartens — "כיתה גן חובה" reads wrong, so
// garden names/grades are shown as-is. Works for both class names and grades.
export function classLabel(nameOrGrade) {
  if (!nameOrGrade) return ''
  return isKindergarten(nameOrGrade) ? nameOrGrade : `כיתה ${nameOrGrade}`
}
