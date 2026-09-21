import { describe, it, expect } from 'vitest'
import { hasAdminReply, unreadReplyCount, unreadIds, replyBannerText, reportThread } from './replies'

describe('unreadReplyCount', () => {
  it('counts unread message replies and answered reports together', () => {
    expect(unreadReplyCount({
      messages: [{ userUnread: true }, { userUnread: false }],
      reports: [{ userUnread: true, adminReply: 'תוקן' }],
    })).toBe(2)
  })

  it('ignores a report flagged unread that carries no answer yet', () => {
    // status changes alone must not light up the badge — only a real answer
    expect(unreadReplyCount({ reports: [{ userUnread: true, status: 'in_progress' }] })).toBe(0)
  })

  it('is zero for a member with nothing waiting', () => {
    expect(unreadReplyCount({})).toBe(0)
    expect(unreadReplyCount()).toBe(0)
    expect(unreadReplyCount({ messages: [{}], reports: [{ adminReply: 'כן' }] })).toBe(0)
  })
})

describe('hasAdminReply', () => {
  it('is true only when the team actually wrote something', () => {
    expect(hasAdminReply({ adminReply: 'בדקנו, תוקן' })).toBe(true)
    expect(hasAdminReply({ adminReply: '' })).toBe(false)
    expect(hasAdminReply({})).toBe(false)
    expect(hasAdminReply(null)).toBe(false)
  })

  it('counts an answer that came as a follow-up in the thread', () => {
    expect(hasAdminReply({ replies: [{ body: 'בודקים', fromAdmin: true }] })).toBe(true)
    // the member answering themselves is not an answer from the team
    expect(hasAdminReply({ replies: [{ body: 'עדיין קורה', fromAdmin: false }] })).toBe(false)
  })
})

describe('reportThread', () => {
  it('opens with the team answer and keeps the follow-ups in order', () => {
    const thread = reportThread({
      text: 'הכפתור לא נלחץ',
      adminReply: 'תוקן',
      replies: [
        { body: 'עדיין קורה', fromAdmin: false, at: 2 },
        { body: 'בודקים שוב', fromAdmin: true, at: 3 },
      ],
    })
    expect(thread.map(e => e.body)).toEqual(['תוקן', 'עדיין קורה', 'בודקים שוב'])
    expect(thread[0].fromAdmin).toBe(true)
  })

  it('leaves the report itself out, and survives an empty report', () => {
    expect(reportThread({ text: 'משהו נשבר' })).toEqual([])
    expect(reportThread(null)).toEqual([])
    // an empty bubble is never worth rendering
    expect(reportThread({ replies: [{ body: '', fromAdmin: true }] })).toEqual([])
  })
})

describe('unreadIds', () => {
  it('returns the ids to clear, and nothing else', () => {
    expect(unreadIds([{ id: 'a', userUnread: true }, { id: 'b' }, { id: 'c', userUnread: true }]))
      .toEqual(['a', 'c'])
    expect(unreadIds()).toEqual([])
  })
})

describe('replyBannerText', () => {
  it('keeps the Hebrew plural honest', () => {
    expect(replyBannerText(1)).toBe('קיבלת תשובה מצוות שחף')
    expect(replyBannerText(3)).toBe('קיבלת 3 תשובות מצוות שחף')
    expect(replyBannerText(0)).toBe('')
  })
})
