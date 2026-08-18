// Fields shared by every form that opens an event (the admin panel, the quick
// form on the calendar, the committee/group forms) and every card that renders
// one — so an event opened from the phone is the same object as one opened
// from a desk.

export const EVENT_TYPE_OPTIONS = [
  { value: 'social',      label: 'חברתי' },
  { value: 'orientation', label: 'אוריינטציה' },
  { value: 'ceremony',    label: 'טקס' },
  { value: 'community',   label: 'קהילתי' },
]

// "כולם מוזמנים". The admin form has always written `required` while the cards
// and the calendar export read `isRequired`, so the flag was set and never
// shown. Forms write `isRequired` from now on; readers accept both, because
// events already saved carry the old key.
export function isEventForEveryone(ev) {
  return !!(ev?.isRequired || ev?.required)
}
