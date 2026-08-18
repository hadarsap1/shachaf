import { describe, it, expect } from 'vitest'
import { isEventForEveryone, EVENT_TYPE_OPTIONS } from './eventFields'

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
})
