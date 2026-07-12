// Hebrew school-year label (e.g. "תשפ״ז"), computed from the date so class
// defaults never go stale between years.

const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ']

// Letters for a Hebrew year number (millennium dropped, e.g. 5787 → תשפ״ז).
export function hebrewYearLabel(hebrewYear) {
  let n = hebrewYear % 1000
  let s = ''
  while (n >= 100) { const h = Math.min(4, Math.floor(n / 100)); s += 'קרשת'[h - 1]; n -= h * 100 }
  if (n === 15) s += 'טו'
  else if (n === 16) s += 'טז'
  else s += TENS[Math.floor(n / 10)] + ONES[n % 10]
  return s.length >= 2 ? s.slice(0, -1) + '״' + s.slice(-1) : s
}

// The school year a class created now belongs to: from July onward — the year
// starting in the coming September; January–June — the year already running.
export function currentSchoolYearLabel(now = new Date()) {
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return hebrewYearLabel(startYear + 3761)
}
