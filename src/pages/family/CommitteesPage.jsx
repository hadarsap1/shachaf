import { useState, useEffect, useRef } from 'react'
import {
  getCommittees, sendCommitteeMessage,
  getEventsByCommittee, joinCommittee, leaveCommittee,
  subscribeCommitteeChat, sendCommitteeChatMessage,
  getCommitteeSummaries, saveCommitteeSummary, deleteCommitteeSummary,
  requestCommittee,
} from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
  Loader2, MessageSquare, Send, CheckCircle2, Calendar,
  ChevronLeft, MessageCircle, FileText, Plus, Trash2, X, Clock3,
} from 'lucide-react'
import clsx from 'clsx'
import ContactModal from '../../components/ui/ContactModal'

const ICON_MAP = {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
}

function CommitteeIcon({ name, size = 20, className, style }) {
  const Icon = ICON_MAP[name] || Users
  return <Icon size={size} className={className} style={style} />
}

// ── Member row ────────────────────────────────────────────────────────────────
function MemberCard({ member, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-1 px-1 rounded-lg transition-[background-color] duration-150 text-right dark:hover:bg-gray-700/50"
    >
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0 dark:bg-gray-800 dark:text-gray-400">
        {member.name?.[0] || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{member.name}</span>
          {member.title && <span className="text-xs text-gray-400">{member.title}</span>}
        </div>
        {(member.phone || member.email) && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{member.phone || member.email}</p>
        )}
      </div>
      <ChevronLeft size={14} className="text-gray-300 flex-shrink-0" />
    </button>
  )
}

// ── Chat panel ────────────────────────────────────────────────────────────────
function CommitteeChat({ committee, user }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    const unsub = subscribeCommitteeChat(committee.id, msgs => {
      setMessages(msgs)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    })
    return unsub
  }, [committee.id])

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    setSending(true)
    setText('')
    try {
      await sendCommitteeChatMessage(committee.id, user.uid, user.name || '', trimmed)
    } finally {
      setSending(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Messages */}
      <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">אין הודעות עדיין — התחל שיחה!</p>
        )}
        {messages.map(msg => {
          const isMe = msg.uid === user.uid
          return (
            <div key={msg.id} className={clsx('flex flex-col gap-0.5', isMe ? 'items-end' : 'items-start')}>
              {!isMe && <span className="text-xs text-gray-400 px-1">{msg.name}</span>}
              <div className={clsx(
                'max-w-[80%] px-3 py-2 rounded-2xl text-sm',
                isMe
                  ? 'bg-primary-600 text-white rounded-tl-sm'
                  : 'bg-gray-100 text-gray-800 rounded-tr-sm'
              )}>
                {msg.text}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 transition-[background-color] duration-150 active:scale-[0.96]"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          placeholder="כתוב הודעה..."
          className="flex-1 input resize-none text-sm text-right leading-relaxed"
          style={{ minHeight: '2.5rem', maxHeight: '6rem' }}
        />
      </div>
    </div>
  )
}

// ── Summaries panel ───────────────────────────────────────────────────────────
function CommitteeSummaries({ committee, isAdmin }) {
  const [summaries, setSummaries] = useState(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', date: new Date().toISOString().slice(0, 10), content: '', decisions: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCommitteeSummaries(committee.id)
      .then(setSummaries)
      .finally(() => setLoading(false))
  }, [committee.id])

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    const newSummary = {
      id: 'summary-' + Date.now(),
      committeeId: committee.id,
      title: form.title.trim(),
      date: form.date,
      content: form.content.trim(),
      decisions: form.decisions.split('\n').map(s => s.trim()).filter(Boolean),
    }
    const saved = await saveCommitteeSummary(newSummary)
    setSummaries(s => [saved, ...(s || [])])
    setForm({ title: '', date: new Date().toISOString().slice(0, 10), content: '', decisions: '' })
    setAdding(false)
    setSaving(false)
  }

  const handleDelete = async (id) => {
    await deleteCommitteeSummary(id)
    setSummaries(s => s.filter(x => x.id !== id))
  }

  if (loading) return <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-gray-300" /></div>

  return (
    <div className="space-y-3">
      {isAdmin && (
        <button
          onClick={() => setAdding(a => !a)}
          className="flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-800 transition-[color] duration-150"
        >
          {adding ? <X size={14} /> : <Plus size={14} />}
          {adding ? 'ביטול' : 'הוסף סיכום'}
        </button>
      )}

      {adding && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100 dark:bg-gray-900 dark:border-gray-700">
          <input
            className="input text-sm text-right"
            placeholder="כותרת הסיכום"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <input
            type="date"
            className="input text-sm"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          />
          <textarea
            rows={3}
            className="input text-sm text-right resize-none"
            placeholder="תקציר הישיבה..."
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          />
          <textarea
            rows={2}
            className="input text-sm text-right resize-none"
            placeholder={`החלטות (שורה לכל החלטה):\nהחלטה 1\nהחלטה 2`}
            value={form.decisions}
            onChange={e => setForm(f => ({ ...f, decisions: e.target.value }))}
          />
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim() || !form.content.trim()}
            className="w-full py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-[background-color] duration-150 active:scale-[0.96]"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            שמור סיכום
          </button>
        </div>
      )}

      {summaries?.length === 0 && !adding && (
        <p className="text-xs text-gray-400 text-center py-4">אין סיכומים עדיין</p>
      )}

      {summaries?.map(s => (
        <div key={s.id} className="border border-gray-100 rounded-xl p-4 space-y-2 dark:border-gray-700">
          <div className="flex items-start justify-between gap-2">
            <div className="text-right flex-1">
              <p className="font-semibold text-gray-800 text-sm dark:text-gray-100">{s.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(s.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => handleDelete(s.id)}
                className="text-gray-300 hover:text-red-400 transition-[color] duration-150 flex-shrink-0"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <p className="text-sm text-gray-600 leading-relaxed text-right dark:text-gray-300">{s.content}</p>
          {s.decisions?.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-500 mb-1.5 dark:text-gray-400">החלטות:</p>
              <ul className="space-y-1">
                {s.decisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700 text-right dark:text-gray-200">
                    <span className="w-4 h-4 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 dark:text-primary-300 dark:bg-primary-900/40">{i + 1}</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Committee card ─────────────────────────────────────────────────────────────
function CommitteeCard({ committee }) {
  const { user, isAdmin } = useAuth()
  const [memberUids, setMemberUids] = useState(committee.memberUids || [])
  const [joinLoading, setJoinLoading] = useState(false)
  const [activePanel, setActivePanel] = useState(null) // 'members' | 'events' | 'chat' | 'summaries' | 'message'
  const [events, setEvents] = useState([])
  const [msgBody, setMsgBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)

  const isMember = memberUids.includes(user?.uid)
  const hasContacts = committee.members?.length > 0

  const toggle = (panel) => setActivePanel(p => p === panel ? null : panel)

  const handleJoin = async () => {
    if (!user) return
    setJoinLoading(true)
    try {
      if (isMember) {
        await leaveCommittee(committee.id, user.uid)
        setMemberUids(u => u.filter(id => id !== user.uid))
        if (activePanel === 'chat') setActivePanel(null)
      } else {
        await joinCommittee(committee.id, user.uid)
        setMemberUids(u => [...u, user.uid])
      }
    } finally {
      setJoinLoading(false)
    }
  }

  const handleShowEvents = async () => {
    if (activePanel !== 'events' && events.length === 0) {
      const evts = await getEventsByCommittee(committee.id)
      setEvents(evts)
    }
    toggle('events')
  }

  const handleSendMsg = async () => {
    if (!msgBody.trim()) return
    setSending(true)
    try {
      await sendCommitteeMessage(committee.id, user.uid, user.name || '', msgBody.trim())
      setSent(true)
      setMsgBody('')
      setTimeout(() => { setSent(false); setActivePanel(null) }, 2500)
    } catch { /* ignore */ } finally { setSending(false) }
  }

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: (committee.color || '#1B3B70') + '20' }}>
            <CommitteeIcon name={committee.icon} size={22} style={{ color: committee.color || '#1B3B70' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-gray-800 dark:text-gray-100">{committee.name}</h3>
              {/* Join/Leave badge */}
              <button
                onClick={handleJoin}
                disabled={joinLoading}
                className={clsx(
                  'flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full transition-[background-color,color] duration-150',
                  isMember
                    ? 'bg-primary-100 text-primary-700 hover:bg-red-50 hover:text-red-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-primary-50 hover:text-primary-700'
                )}
              >
                {joinLoading ? <Loader2 size={11} className="animate-spin inline" /> : isMember ? '✓ חבר' : '+ הצטרף'}
              </button>
            </div>
            {committee.description && (
              <p className="text-sm text-gray-500 mt-1 leading-relaxed dark:text-gray-400">{committee.description}</p>
            )}
            {memberUids.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">{memberUids.length} חברים</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {hasContacts && (
            <button onClick={() => toggle('members')}
              className={clsx('text-xs font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-[background-color,color] duration-150',
                activePanel === 'members' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}>
              <Users size={12} />
              צוות
            </button>
          )}
          <button onClick={handleShowEvents}
            className={clsx('text-xs font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-[background-color,color] duration-150',
              activePanel === 'events' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}>
            <Calendar size={12} />
            אירועים
          </button>
          <button onClick={() => toggle('summaries')}
            className={clsx('text-xs font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-[background-color,color] duration-150',
              activePanel === 'summaries' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}>
            <FileText size={12} />
            סיכומים
          </button>
          {isMember && (
            <button onClick={() => toggle('chat')}
              className={clsx('text-xs font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-[background-color,color] duration-150',
                activePanel === 'chat' ? 'bg-primary-600 text-white' : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
              )}>
              <MessageCircle size={12} />
              צ׳אט
            </button>
          )}
          {!isMember && (
            <button onClick={() => toggle('message')}
              className={clsx('text-xs font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-[background-color,color] duration-150',
                activePanel === 'message' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}>
              <MessageSquare size={12} />
              שלח הודעה
            </button>
          )}
        </div>
      </div>

      {/* ── Panels ── */}

      {activePanel === 'members' && hasContacts && (
        <div className="px-5 pb-4 border-t border-gray-50">
          {committee.members.map((m, i) => (
            <MemberCard key={i} member={m} onClick={() => setSelectedMember(m)} />
          ))}
        </div>
      )}

      {activePanel === 'events' && (
        <div className="px-5 pb-4 border-t border-gray-50 pt-3">
          {events.length === 0
            ? <p className="text-xs text-gray-400 text-right">אין אירועים מתוכננים לוועדה זו</p>
            : (
              <div className="space-y-2">
                {events.map(ev => (
                  <div key={ev.id} className="flex items-center justify-between text-sm">
                    <span className="text-xs text-gray-400">{ev.date} {ev.time || ''}</span>
                    <div className="text-right">
                      <p className="font-medium text-gray-800 text-sm dark:text-gray-100">{ev.title}</p>
                      {ev.location && <p className="text-xs text-gray-400">{ev.location}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {activePanel === 'summaries' && (
        <div className="px-5 pb-5 border-t border-gray-50 pt-4">
          <CommitteeSummaries committee={committee} isAdmin={isAdmin} />
        </div>
      )}

      {activePanel === 'chat' && isMember && (
        <div className="px-5 pb-5 border-t border-gray-50 pt-4">
          <CommitteeChat committee={committee} user={user} />
        </div>
      )}

      {activePanel === 'message' && !isMember && (
        <div className="px-5 pb-5 border-t border-gray-50 pt-4">
          {sent ? (
            <div className="flex items-center gap-2 text-green-600 text-sm justify-center py-2 dark:text-green-400">
              <CheckCircle2 size={16} />ההודעה נשלחה לוועדה
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-2 text-right">הודעתך תגיע למנהלי הוועדה</p>
              <textarea value={msgBody} onChange={e => setMsgBody(e.target.value)}
                rows={3} maxLength={2000}
                className="input w-full resize-none text-sm text-right"
                placeholder="כתוב הודעתך לוועדה..." />
              <button onClick={handleSendMsg} disabled={sending || !msgBody.trim()}
                className="mt-2 w-full py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-[background-color] duration-150 active:scale-[0.96]">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                שלח
              </button>
            </>
          )}
        </div>
      )}

      {selectedMember && (
        <ContactModal person={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </div>
  )
}

// ── Request new committee ────────────────────────────────────────────────────
function RequestCommitteePanel({ onClose, onRequested }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await requestCommittee({ name: name.trim(), description: description.trim(), requestedBy: user.uid, requestedByName: user.name || '' })
      setDone(true)
      onRequested?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-gray-800 z-50 flex flex-col animate-slide-from-right" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100">בקשה להקמת ועדה חדשה</h2>
        </div>
        {done ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 size={26} className="text-green-600 dark:text-green-400" />
            </div>
            <p className="font-bold text-gray-800 dark:text-gray-100">הבקשה נשלחה!</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">מנהל הקהילה יבדוק את הבקשה ויאשר אותה בהקדם</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1 text-right">שם הוועדה</label>
              <input value={name} onChange={e => setName(e.target.value)} required
                className="input w-full text-right" placeholder="לדוגמה: ועד הורים כיתה ג'" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1 text-right">מה הוועדה תעשה?</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={4} className="input w-full text-right text-sm resize-none leading-relaxed" placeholder="תארו את מטרת הוועדה..." />
            </div>
            <button type="submit" disabled={saving || !name.trim()}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {saving ? 'שולח...' : 'שליחת בקשה'}
            </button>
          </form>
        )}
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function CommitteesPage() {
  const { user } = useAuth()
  const [committees, setCommittees] = useState([])
  const [loading, setLoading]       = useState(true)
  const [showRequest, setShowRequest] = useState(false)

  useEffect(() => {
    getCommittees().then(setCommittees).finally(() => setLoading(false))
  }, [])

  const activeCommittees = committees.filter(c => c.status !== 'pending')
  const myPending = committees.filter(c => c.status === 'pending' && c.requestedBy === user?.uid)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" dir="rtl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <button onClick={() => setShowRequest(true)}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors flex-shrink-0">
          <Plus size={15} />
          בקש ועדה חדשה
        </button>
        <div className="text-right">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 justify-end dark:text-white">
            ועדות
            <span className="text-2xl leading-none">🔗</span>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">ועדות הקהילה ואנשי הקשר שלהן</p>
        </div>
      </div>

      {myPending.length > 0 && (
        <div className="mb-4 space-y-2">
          {myPending.map(c => (
            <div key={c.id} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm justify-end">
              הבקשה שלך ל"{c.name}" ממתינה לאישור מנהל
              <Clock3 size={15} className="flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary-400" /></div>
      ) : activeCommittees.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={44} className="mx-auto mb-4 opacity-25" />
          <p className="font-semibold text-gray-500 dark:text-gray-400">אין ועדות פעילות כרגע</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeCommittees.map(c => <CommitteeCard key={c.id} committee={c} />)}
        </div>
      )}

      {showRequest && (
        <RequestCommitteePanel
          onClose={() => setShowRequest(false)}
          onRequested={() => getCommittees().then(setCommittees)}
        />
      )}
    </div>
  )
}
