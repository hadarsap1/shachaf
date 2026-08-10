// Names in the community are shown to other families — in the class roster, on
// the contact sheet, in committee member lists. A roster that mixes "דוד כהן"
// with "David Cohen" is hard to scan and impossible to sort, so a member's own
// name is required to be Hebrew.
//
// "Hebrew" here means: at least one Hebrew letter, and nothing outside the
// Hebrew letters plus the punctuation real names contain — a space, a hyphen
// (בן-גוריון), and an apostrophe or geresh (ג'ורג'). No Latin letters, no
// digits, no emoji.

const HEBREW_LETTER = /[א-ת]/
// Hebrew letters, the Yiddish ligatures, space, both hyphens a Hebrew keyboard
// produces (ASCII "-" and the maqaf "־"), and the quote characters that stand
// in for a geresh/gershayim.
const ALLOWED_ONLY = /^[א-תװ-״ '"׳״־-]+$/

export const MAX_NAME_LENGTH = 100

export const HEBREW_NAME_ERROR = 'יש להזין את השם בעברית (אותיות עבריות, רווח ומקף בלבד)'

// Collapse the whitespace people paste in, so " דוד   כהן " and "דוד כהן" are
// the same name.
export function normalizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export function isHebrewName(value) {
  const name = normalizeName(value)
  if (!name || name.length > MAX_NAME_LENGTH) return false
  if (!HEBREW_LETTER.test(name)) return false
  return ALLOWED_ONLY.test(name)
}

// null when the name is fine, otherwise the message to show under the field.
export function hebrewNameError(value) {
  const name = normalizeName(value)
  if (!name) return 'נא להזין שם'
  if (name.length > MAX_NAME_LENGTH) return `השם ארוך מדי (עד ${MAX_NAME_LENGTH} תווים)`
  return isHebrewName(name) ? null : HEBREW_NAME_ERROR
}
