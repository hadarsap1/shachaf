import { describe, it, expect } from 'vitest'
import { hasAdminReply, unreadReplyCount, unreadIds, replyBannerText } from './replies'

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
