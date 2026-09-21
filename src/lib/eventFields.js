// Fields shared by every form that opens an event (the admin panel, the quick
// form on the calendar, the committee/group forms) and every card that renders
// one — so an event opened from the phone is the same object as one opened
// from a desk.

// סיווג האירוע הוא תווית שכל הקהילה רואה, ולכן הוא לא נבחר במקומה של מי
// שפותחת את האירוע: בלי בחירה אין תגית בכלל. עד היום הטופס נפתח על "חברתי",
// כך שאסיפת עדכון שכבתית יצאה לקהילה מתויגת כאירוע חברתי בלי שאיש בחר בזה.
// ה-hint הוא מה שהטופס מסביר על כל סוג, כי "אוריינטציה" לא אמר כלום לאף אחד.
// ה-value נשאר כפי שהוא נשמר בבסיס הנתונים גם כשהתווית משתנה.
export const EVENT_TYPE_OPTIONS = [
  { value: 'social',      label: 'חברתי',         hint: 'מסיבה, פיקניק או מפגש חברתי' },
  { value: 'orientation', label: 'היכרות וקליטה', hint: 'מפגש היכרות למשפחות חדשות' },
  { value: 'ceremony',    label: 'טקס',           hint: 'טקס כיתתי, שכבתי או בית ספרי' },
  { value: 'community',   label: 'קהילתי',        hint: 'פעילות שפתוחה לכל קהילת שחף' },
]

// הבחירה הריקה, וגם מה שנשמר עליה: מחרוזת ריקה ולא null, כדי שעריכת אירוע
// קיים תוכל לנקות סיווג שנקבע בטעות.
export const EVENT_TYPE_NONE = { value: '', label: 'ללא סיווג' }

// תווית אחת לכל המסכים. עד היום כל מסך החזיק מפה משלו, ו-community הופיע
// כ"קהילה" בכרטיס האירוע וכ"קהילתי" בכל שאר המקומות - אותו אירוע, שני שמות.
// אירוע בלי סיווג (או עם ערך שאינו מוכר) מחזיר מחרוזת ריקה, והמסכים לא
// מציירים עליו תגית.
export function eventTypeLabel(type) {
  return EVENT_TYPE_OPTIONS.find(o => o.value === type)?.label || ''
}

export function eventTypeHint(type) {
  return EVENT_TYPE_OPTIONS.find(o => o.value === type)?.hint || ''
}

// "כולם מוזמנים". The admin form has always written `required` while the cards
// and the calendar export read `isRequired`, so the flag was set and never
// shown. Forms write `isRequired` from now on; readers accept both, because
// events already saved carry the old key.
export function isEventForEveryone(ev) {
  return !!(ev?.isRequired || ev?.required)
}
