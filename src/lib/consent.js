// Informed-consent text and versioning — the legal basis for all data
// collection in the app (Israeli Privacy Protection Law; see
// docs/security-compliance-plan-2026-07.md §5.1 and annex A).
//
// IMPORTANT: any NEW use of personal data added to the app must be added to
// PURPOSES below AND the version bumped — users are then re-prompted to
// consent on their next visit. users/{uid}.consentVersion + consentAt are
// the stored evidence of consent.

export const CONSENT_VERSION = '1.3'

// The oldest consent still good enough to DISPLAY a member's details to other
// members (class roster, contact sheet, birthdays).
//
// Re-consent and display are two different questions. Bumping CONSENT_VERSION
// re-prompts everyone — that part is exact-match and stays that way. But it
// must not retroactively revoke what a parent already agreed to: when 1.3 added
// parent birthdays (opt-in, and separately gated by birthdayShared), every
// parent who had approved 1.2 silently vanished from their class roster —
// their children included — until they happened to open the app again. A whole
// class read as four children.
//
// So display asks a narrower question: did this member approve a policy from
// which today's display follows? Bump this ONLY when a new version changes what
// other members get to see about someone — then old consent genuinely no longer
// covers it. Adding a purpose that is opt-in, or that shows a member their own
// data, is not such a change.
export const DISPLAY_CONSENT_SINCE = '1.0'

// Compares dotted numeric versions ('1.10' > '1.9'), so the baseline above can
// pass 9 without a surprise.
export function compareConsentVersions(a, b) {
  const parts = (v) => String(v || '').split('.').map(n => parseInt(n, 10) || 0)
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1
  }
  return 0
}

export const CONSENT_PURPOSES = [
  'הפקת דף קשר כיתתי וקהילתי לחברי הקהילה',
  'ליווי תהליך הקליטה — משימות, טפסים וחיבור למשפחה קולטת',
  'תיאום אירועים ופעילויות קהילתיות (כולל רישום הגעה)',
  'תקשורת קהילתית — ועדות, קבוצות עניין והודעות',
  'תיאום סירי לידה — שיבוץ מתנדבים לימי בישול והעברת פרטי מסירה למי שנרשם',
  'הצגת ימי הולדת בלוח השנה המשותף — של ילדים, ושל הורים שבחרו לשתף',
]

export const CONSENT_EXPOSURE =
  'הורים בכיתת ילדך (שם, טלפון, כיתת הילד), צוות הניהול של הקהילה, ' +
  'ומשפחה קולטת שהוקצתה לך. שם ילדך וכיתתו יוצגו להורי הכיתה; ' +
  'תמונת ילד תוצג רק אם העלית אותה מרצונך. ' +
  'פתחת סיר לידה? כתובת המסירה וקוד הכניסה שתמסור יוצגו אך ורק למי ' +
  'שנרשם לתאריך בישול בסיר שלך (ולצוות הניהול), ולא לשאר חברי הקהילה. ' +
  'תאריך הלידה שלך אינו מוצג לאיש, אלא אם סימנת במפורש בהגדרות שברצונך ' +
  'שיופיע בלוח השנה — ואז יוצגו רק היום והחודש להורי הכיתה, בלי שנת הלידה.'

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
    title: 'סירי לידה',
    body: 'כתובת המסירה, קוד הכניסה והעדפות המשפחה נשמרים בנפרד ונחשפים רק ' +
      'למתנדבים שנרשמו לתאריך בישול באותו סיר. ניתן לסגור את הסיר בכל עת ' +
      'והפרטים יימחקו יחד איתו.',
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

// Has this user (or any user doc, e.g. another parent) approved a policy that
// covers today's display? Used to gate DISPLAY of a member's data to others:
// until a parent joined and approved the policy, neither their details nor
// their children's may be shown anywhere. A parent who approved an earlier
// version keeps being shown — see DISPLAY_CONSENT_SINCE — while still being
// asked to approve the current one on their next visit (needsConsent).
export function hasConsented(user) {
  return !!user?.consentVersion
    && compareConsentVersions(user.consentVersion, DISPLAY_CONSENT_SINCE) >= 0
}

// A child may be displayed (roster, contact sheet, birthdays…) only when at
// least one of their LINKED parents approved the policy (see hasConsented).
// `parentsByUid` maps uid → user doc (missing docs count as not-consented).
export function childHasConsentedParent(child, parentsByUid) {
  return (child?.parentUids || []).some(uid => hasConsented(parentsByUid[uid]))
}
