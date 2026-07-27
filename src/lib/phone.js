// Israeli phone normalization, used to MATCH an imported parent record to a
// registered user account when the import file has no email column (the school
// registry exports "נייד אב" / "נייד אם" but no addresses).
//
// SECURITY NOTE: phone matching is an ADMIN-SIDE convenience only. Unlike an
// email, a phone number is not part of the Firebase auth token, so a client
// cannot prove it owns one — self-service linking stays email-only
// (autoLinkChildrenByEmail + the parentEmails Firestore rule). Never move
// phone matching into a client self-link path.

// Reduce a phone to comparable digits: strips spaces/dashes/parens, drops the
// +972 / 972 country prefix, and restores the leading 0 that spreadsheets eat
// from mobile numbers. Returns '' for anything too short to be a real number.
export function normalizeILPhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('972')) d = d.slice(3)          // +972-52-... → 52...
  if (d.length === 9 && !d.startsWith('0')) d = '0' + d  // 521234567 → 0521234567
  // Real IL numbers are 9 (03-xxxxxxx) or 10 (05x-xxxxxxx) digits with the 0
  return d.length >= 9 ? d : ''
}

// Same number? Empty/unparsable values never match, so a missing phone can't
// accidentally link two people.
export function samePhone(a, b) {
  const na = normalizeILPhone(a)
  return !!na && na === normalizeILPhone(b)
}

// Build { normalizedPhone → uid } from user docs. Numbers shared by MORE than
// one account are dropped: an ambiguous match must not auto-link the wrong
// parent (e.g. two accounts that both listed the same landline).
export function phoneIndex(users) {
  const seen = new Map()
  for (const u of users || []) {
    const key = normalizeILPhone(u?.phone)
    if (!key) continue
    seen.set(key, seen.has(key) ? null : u.uid)   // null = ambiguous
  }
  return Object.fromEntries([...seen].filter(([, uid]) => uid))
}

// Find the registered user matching an imported parent entry: email first
// (authoritative), then a unique phone match.
export function matchUserToParent(parent, { userByEmail = {}, byPhone = {} } = {}) {
  const email = String(parent?.email || '').toLowerCase().trim()
  if (email && userByEmail[email]) return userByEmail[email]
  const phone = normalizeILPhone(parent?.phone)
  return (phone && byPhone[phone]) || null
}
