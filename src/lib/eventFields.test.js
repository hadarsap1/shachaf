import { describe, it, expect } from 'vitest'
import { isEventForEveryone, EVENT_TYPE_OPTIONS, EVENT_TYPE_NONE, eventTypeLabel, eventTypeHint } from './eventFields'

describe('isEventForEveryone', () => {
  // The admin panel wrote `required`; the cards and the calendar export read
  // `isRequired`, so ticking "כולם מוזמנים" showed nothing anywhere.
  it('accepts either key, so events saved by the old form still show the badge', () => {
    expect(isEventForEveryone({ required: true })).toBe(true)
    expect(isEventForEveryone({ isRequired: true })).toBe(true)
  })

  it('is false when the flag is off or the event is missing', () => {
    expect(isEventForEveryone({ required: false, isRequired: false })).toBe(false)
    expect(isEventForEveryone({})).toBe(false)
    expect(isEventForEveryone(null)).toBe(false)
  })
})

describe('EVENT_TYPE_OPTIONS', () => {
  it('covers every type the cards know how to label', () => {
    expect(EVENT_TYPE_OPTIONS.map(o => o.value))
      .toEqual(['social', 'orientation', 'ceremony', 'community'])
  })

  it('explains every type, because "אוריינטציה" explained nothing', () => {
    for (const o of EVENT_TYPE_OPTIONS) expect(o.hint.length).toBeGreaterThan(0)
    expect(eventTypeHint('orientation')).toBe('מפגש היכרות למשפחות חדשות')
  })

  it('keeps the stored values untouched when a label changes', () => {
    // אירועים שנשמרו כ-orientation ממשיכים להציג את התווית החדשה
    expect(eventTypeLabel('orientation')).toBe('היכרות וקליטה')
  })
})

describe('eventTypeLabel', () => {
  it('gives every screen the same name for the same event', () => {
    // community נקרא "קהילה" בכרטיס האירוע ו"קהילתי" בכל שאר המסכים
    expect(eventTypeLabel('community')).toBe('קהילתי')
    expect(eventTypeLabel('social')).toBe('חברתי')
  })

  it('is empty for an event nobody classified, so no badge is drawn', () => {
    expect(eventTypeLabel(EVENT_TYPE_NONE.value)).toBe('')
    expect(eventTypeLabel('')).toBe('')
    expect(eventTypeLabel(undefined)).toBe('')
    // ערך ישן או לא מוכר לא ידלוף למסך כמחרוזת גולמית
    expect(eventTypeLabel('whatever')).toBe('')
  })
})
