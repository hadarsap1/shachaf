// Informed-consent text and versioning — the legal basis for all data
// collection in the app (Israeli Privacy Protection Law; see
// docs/security-compliance-plan-2026-07.md §5.1 and annex A).
//
// IMPORTANT: any NEW use of personal data added to the app must be added to
// PURPOSES below AND the version bumped — users are then re-prompted to
// consent on their next visit. users/{uid}.consentVersion + consentAt are
// the stored evidence of consent.

export const CONSENT_VERSION = '1.1'

export const CONSENT_PURPOSES = [
  'הפקת דף קשר כיתתי וקהילתי לחברי הקהילה',
  'ליווי תהליך הקליטה — משימות, טפסים וחיבור למשפחה מארחת',
  'תיאום אירועים ופעילויות קהילתיות (כולל רישום הגעה)',
  'תקשורת קהילתית — ועדות, קבוצות עניין והודעות',
]

export const CONSENT_EXPOSURE =
  'הורים בכיתת ילדך (שם, טלפון, כיתת הילד), צוות הניהול של הקהילה, ' +
  'ומשפחה מארחת שהוקצתה לך. שם ילדך וכיתתו יוצגו להורי הכיתה; ' +
  'תמונת ילד תוצג רק אם העלית אותה מרצונך.'

// Where the data physically lives — required disclosure (transfer-of-data
// regulations). Referenced by the consent dialog, the privacy policy and the
// "My Privacy" page so the wording stays identical everywhere.
export const CONSENT_DATA_LOCATION =
  'המידע נשמר בתשתית הענן Google Firebase (Google Cloud Platform), בשרתי Google ' +
  'הממוקמים מחוץ לישראל (באיחוד האירופי ובארה"ב), בכפוף להסכמי עיבוד נתונים ' +
  'מחייבים העומדים בדרישות ה-GDPR ותקנות העברת מידע לחו"ל מכוח חוק הגנת הפרטיות.'

export const CONSENT_POINTS = [
  {
    title: 'איפה המידע נשמר',
    body: CONSENT_DATA_LOCATION,
  },
  {
    title: 'המידע לא מועבר לצד שלישי',
    body: 'המידע לא יועבר לשום גורם חיצוני ולא ישמש לכל מטרה מסחרית. ' +
      'המערכת מאוחסנת בתשתית הענן של Google בהתאם להסכמי עיבוד נתונים מחייבים.',
  },
  {
    title: 'הגבלות תזונה ואלרגיה',
    body: 'מנוהלות במערכת ברמת אירוע או כיתה בלבד (למשל "אירוע נטול בוטנים"), ' +
      'ללא קישור לילד מסוים — המערכת אינה אוספת ואינה שומרת מידע רפואי על אדם מזוהה.',
  },
  {
    title: 'שדות רשות',
    body: 'תמונה, כתובת, טלפון ותמונת ילד אינם חובה — ניתן להצטרף בלעדיהם ' +
      'ולמחוק אותם בכל עת מההגדרות.',
  },
  {
    title: 'זכויותיך',
    body: 'עיון, תיקון ומחיקה של המידע — מתוך "הגדרות" או בפנייה לצוות הניהול. ' +
      'ניתן למחוק את החשבון כולו בכל עת.',
  },
]

export const CONSENT_CHECKBOX_LABEL =
  'קראתי ואני מסכים/ה לאיסוף ולשימוש במידע כמפורט לעיל, לרבות הצגת פרטי ילדי כמתואר.'

// Does this user still need to confirm the current consent version?
export function needsConsent(user) {
  return !!user && user.consentVersion !== CONSENT_VERSION
}

// Has this user (or any user doc, e.g. another parent) approved the CURRENT
// consent version? Used to gate DISPLAY of a member's data to others: until a
// parent joined and approved the policy, neither their details nor their
// children's may be shown anywhere.
export function hasConsented(user) {
  return !!user && user.consentVersion === CONSENT_VERSION
}

// A child may be displayed (roster, contact sheet, birthdays…) only when at
// least one of their LINKED parents approved the current policy version.
// `parentsByUid` maps uid → user doc (missing docs count as not-consented).
export function childHasConsentedParent(child, parentsByUid) {
  return (child?.parentUids || []).some(uid => hasConsented(parentsByUid[uid]))
}
