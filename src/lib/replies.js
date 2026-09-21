// "Somebody answered you" — one rule for both channels a member can write to.
//
// A parent who sends a message, or files a bug report, gets an answer from the
// admin panel. The answer used to live where the admin wrote it: the message
// thread carried a userUnread flag that only the desktop side menu showed, and
// a bug report carried no flag at all and wasn't even readable by the person
// who filed it. From the phone — where "צור קשר" is not in the bottom bar —
// the whole thing was invisible. So both channels now answer one question, and
// the dashboard, the side menu and the contact page all ask it here.

// Was this bug report answered by the team? The answer can be the first reply
// (adminReply) or any later one in the follow-up thread.
export function hasAdminReply(report) {
  if (report?.adminReply) return true
  return (report?.replies || []).some(r => r?.fromAdmin && r?.body)
}

// One thread out of a report: the team's first answer and every follow-up
// after it, in the order they were written. The report's own text stays out —
// it is shown as the opening message, not as part of the replies.
export function reportThread(report) {
  const entries = []
  if (report?.adminReply) {
    entries.push({ body: report.adminReply, fromAdmin: true, byName: 'צוות שחף', at: 0 })
  }
  for (const r of report?.replies || []) {
    if (r?.body) entries.push(r)
  }
  return entries
}

// Threads/reports carrying an answer the member has not opened yet.
export function unreadReplyCount({ messages = [], reports = [] } = {}) {
  return messages.filter(m => m?.userUnread).length
    + reports.filter(r => r?.userUnread && hasAdminReply(r)).length
}

// The ids to clear once the member has actually seen the answers.
export function unreadIds(items = []) {
  return items.filter(i => i?.userUnread).map(i => i.id)
}

// One line for the dashboard banner — plural-correct Hebrew, since "1 תשובות"
// reads like a bug to the person looking at it.
export function replyBannerText(count) {
  if (count <= 0) return ''
  return count === 1
    ? 'קיבלת תשובה מצוות שחף'
    : `קיבלת ${count} תשובות מצוות שחף`
}
