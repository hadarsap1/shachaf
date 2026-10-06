// How to put the app on the home screen, per platform — one source for the
// install banner, the settings tutorial and the help page.
//
// The usual reason "it can't be added" on an iPhone is not the app: the invite
// link was opened from WhatsApp (or Instagram, Gmail…), and the browser inside
// those apps has no "Add to Home Screen" at all. It has to be opened in Safari
// first. WhatsApp's viewer is Safari's own view controller, whose user agent
// is identical to Safari's — it cannot be detected, so the instructions always
// say it. The in-app browsers that CAN be detected get a dedicated message.

// iPadOS 13+ reports itself as a Mac; a Mac with a touch screen is an iPad.
export function isIOSDevice(ua = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints || 0) {
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  return /Macintosh/i.test(ua) && maxTouchPoints > 1
}

const IN_APP_MARKERS = [
  [/FBAN|FBAV|FB_IAB/i, 'פייסבוק'],
  [/Instagram/i, 'אינסטגרם'],
  [/WhatsApp/i, 'וואטסאפ'],
  [/\bLine\//i, 'Line'],
  [/LinkedInApp/i, 'לינקדאין'],
  [/\bGSA\//i, 'Google'],
  [/Telegram/i, 'טלגרם'],
]

// The name of the app whose built-in browser this is, '' for an unnamed one,
// or null when this is a real browser. Only meaningful on iOS.
export function inAppBrowserName(ua = navigator.userAgent) {
  for (const [re, name] of IN_APP_MARKERS) if (re.test(ua)) return name
  // Safari and the other iOS browsers (Chrome, Firefox, Edge) all carry a
  // "Safari/" token; an app embedding a bare web view does not.
  if (/AppleWebKit/i.test(ua) && !/Safari\//i.test(ua)) return ''
  return null
}

export const IOS_OPEN_IN_SAFARI =
  'נכנסתם מקישור בוואטסאפ? קודם פתחו את הקישור ב-Safari (סמל המצפן או "פתח ב-Safari"). בתוך וואטסאפ אין אפשרות להוסיף למסך הבית'

export const IOS_ADD_STEP =
  'iPhone: ב-Safari לחצו על כפתור השיתוף (בגרסאות חדשות הוא בתוך תפריט •••), גללו למטה ובחרו "הוסף למסך הבית". אם האפשרות לא מופיעה, לחצו על "עוד"'

export const ANDROID_ADD_STEP =
  'Android: ב-Chrome לחצו על תפריט שלוש הנקודות ← "הוסף למסך הבית" או "התקן אפליקציה"'
