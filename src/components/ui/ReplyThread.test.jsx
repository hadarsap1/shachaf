import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ReplyBubbles, ReplyBox } from './ReplyThread'

const entries = [
  { body: 'עדיין לא עובד', fromAdmin: false, byName: 'גל', at: 1 },
  { body: 'בודקים', fromAdmin: true, byName: 'הדר', at: 2 },
  { body: 'תוקן', fromAdmin: true, at: 3 },
]

describe('ReplyBubbles', () => {
  it('names the two sides as the member sees them', () => {
    const html = renderToString(<ReplyBubbles entries={entries} />)
    expect(html).toContain('את/ה')
    expect(html).toContain('הדר')
    // תשובה של הצוות בלי שם חותמת נשארת בשם המותג
    expect(html).toContain('צוות שחף')
    expect(html).not.toContain('חבר קהילה')
  })

  it('names the member for the team reading the same thread', () => {
    const html = renderToString(<ReplyBubbles entries={entries} viewer="admin" />)
    expect(html).toContain('גל')
    expect(html).not.toContain('את/ה')
  })

  it('renders nothing at all for an empty thread', () => {
    expect(renderToString(<ReplyBubbles entries={[]} />)).toBe('')
    expect(renderToString(<ReplyBubbles />)).toBe('')
  })
})

describe('ReplyBox', () => {
  it('offers a labelled box and a send button in both layouts', () => {
    const compact = renderToString(<ReplyBox onSend={() => {}} />)
    expect(compact).toContain('כתבו תשובה...')
    expect(compact).toContain('aria-label="שלח תשובה"')

    const full = renderToString(
      <ReplyBox compact={false} onSend={() => {}} placeholder="כתבו תשובה שההורה יראה באפליקציה..." />
    )
    expect(full).toContain('כתבו תשובה שההורה יראה באפליקציה...')
    expect(full).toContain('שלח תשובה')
  })

  it('keeps the send button out of reach while the box is empty', () => {
    // כפתור שנראה פעיל ולא שולח הוא בדיוק התלונה שהגיעה מהקהילה
    expect(renderToString(<ReplyBox onSend={() => {}} />)).toContain('disabled=""')
  })
})
