import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import DietaryBadges from './DietaryBadges'
import EventCard from './EventCard'
import { dietaryLabel, DIETARY_OPTIONS } from '../../lib/dietary'

const baseEvent = {
  id: 'e1', title: 'פיקניק כיתתי', description: 'כיף בפארק',
  date: '2030-05-01', time: '16:00', location: 'הפארק', type: 'social',
}

describe('DietaryBadges', () => {
  it('renders nothing when the event has no restrictions', () => {
    expect(renderToString(<DietaryBadges event={baseEvent} />)).toBe('')
  })

  it('renders a "ללא X" pill per restriction tag', () => {
    const html = renderToString(
      <DietaryBadges event={{ ...baseEvent, dietaryRestrictions: ['peanuts', 'sesame'] }} />
    )
    expect(html).toContain('ללא בוטנים')
    expect(html).toContain('ללא שומשום')
    expect(html).not.toContain('ללא גלוטן')
  })

  it('renders the free-text note in full (non-compact) mode only', () => {
    const withNote = { ...baseEvent, dietaryNote: 'נא להימנע מחטיפים ביתיים' }
    expect(renderToString(<DietaryBadges event={withNote} />)).toContain('נא להימנע מחטיפים ביתיים')
    expect(renderToString(<DietaryBadges event={withNote} compact />)).not.toContain('נא להימנע מחטיפים ביתיים')
  })
})

describe('EventCard with dietary restrictions', () => {
  it('shows compact restriction badges on the card', () => {
    const html = renderToString(
      <EventCard event={{ ...baseEvent, dietaryRestrictions: ['gluten'] }} />
    )
    expect(html).toContain('ללא גלוטן')
  })

  it('renders unchanged for events without restrictions (back-compat)', () => {
    const html = renderToString(<EventCard event={baseEvent} />)
    expect(html).toContain('פיקניק כיתתי')
    expect(html).not.toContain('ללא ')
  })
})

describe('dietaryLabel', () => {
  it('maps every known option and falls back to the raw value', () => {
    for (const o of DIETARY_OPTIONS) expect(dietaryLabel(o.value)).toBe(o.label)
    expect(dietaryLabel('custom-thing')).toBe('custom-thing')
  })
})
