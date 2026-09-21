import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import EventCard from './EventCard'

const baseEvent = {
  id: 'e1', title: 'אסיפת עדכון שכבת ג', description: 'מפגש הורים',
  date: '2030-05-01', time: '20:00', location: 'חדר האוכל',
}

describe('EventCard type badge', () => {
  it('shows the chosen type, with the same name every other screen uses', () => {
    expect(renderToString(<EventCard event={{ ...baseEvent, type: 'community' }} />))
      .toContain('קהילתי')
    expect(renderToString(<EventCard event={{ ...baseEvent, type: 'orientation' }} />))
      .toContain('היכרות וקליטה')
  })

  it('draws no badge at all when nobody classified the event', () => {
    // הבאג שדווח: אירוע שנפתח בלי לבחור סוג יצא לקהילה מתויג "חברתי"
    const html = renderToString(<EventCard event={{ ...baseEvent, type: '' }} />)
    expect(html).toContain('אסיפת עדכון שכבת ג')
    expect(html).not.toContain('חברתי')
  })

  it('does not leak a stale or unknown value onto the card', () => {
    expect(renderToString(<EventCard event={{ ...baseEvent, type: 'whatever' }} />))
      .not.toContain('whatever')
  })
})
