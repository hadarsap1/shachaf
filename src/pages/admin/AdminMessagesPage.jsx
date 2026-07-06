import { useState, useEffect } from 'react'
import { getMessages, markMessageRead, getCommitteeMessages, markCommitteeMessageRead, getCommittees, addMessageReply } from '../../lib/db'
import { MessageSquare, Loader2, User, Mail, Network, Send } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../context/AuthContext'
import AdminAnnouncementsPage from './AdminAnnouncementsPage'

function Thread({ replies }) {
  if (!replies?.length) return null
  return (
    <div className="space-y-2">
      {replies.map((r, i) => (
        <div key={i} className={clsx('max-w-[85%] rounded-2xl px-3.5 py-2',
          r.fromAdmin ? 'bg-primary-600 text-white ms-auto' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100')}>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.body}</p>
          <div className={clsx('text-[10px] mt-0.5', r.fromAdmin ? 'text-primary-100' : 'text-gray-400')}>
            {r.byName || (r.fromAdmin ? 'צוות' : 'הורה')}
          </div>
        </div>
      ))}
    </div>
  )
}

const ROLE_LABELS = {
  new_family:  'משפחה חדשה',
  host_family: 'משפחה מארחת',
  admin:       'מנהל',
  super_admin: 'מנהל ראשי',
}

function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AdminMessagesPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('messages')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [committeeMessages, setCommitteeMessages] = useState([])
  const [committeeNames, setCommitteeNames] = useState({}) // committeeId → name
  const [loadingCommittee, setLoadingCommittee] = useState(false)
  const [selectedCMsg, setSelectedCMsg] = useState(null)

  useEffect(() => {
    getMessages()
      .then(m => setMessages(m))
      .catch(err => console.error('AdminMessagesPage load failed', err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab !== 'committees' || committeeMessages.length > 0) return
    setLoadingCommittee(true)
    Promise.all([getCommitteeMessages(), getCommittees()])
      .then(([msgs, committees]) => {
        setCommitteeMessages(msgs)
        setCommitteeNames(Object.fromEntries(committees.map(c => [c.id, c.name])))
      })
      .catch(err => console.error('committee messages load failed', err))
      .finally(() => setLoadingCommittee(false))
  }, [tab])

  async function handleSelect(msg) {
    setSelected(msg)
    setReplyText('')
    if (!msg.read) {
      await markMessageRead(msg.id)
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m))
    }
  }

  async function handleReply() {
    if (!replyText.trim() || !selected) return
    setReplying(true)
    try {
      const entry = await addMessageReply(selected.id, { body: replyText.trim(), fromAdmin: true, byName: user?.name || 'צוות' })
      const upd = (m) => ({ ...m, replies: [...(m.replies || []), entry] })
      setSelected(upd)
      setMessages(prev => prev.map(m => m.id === selected.id ? upd(m) : m))
      setReplyText('')
    } catch (e) {
      console.error('reply failed', e)
    } finally {
      setReplying(false)
    }
  }

  const unread = messages.filter(m => !m.read).length

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 dark:text-primary-300">
          <span className="text-xl leading-none">💬</span>
          הודעות
        </h1>
        {unread > 0 && tab === 'messages' && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unread}</span>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit me-auto dark:bg-gray-800">
        {[{ id: 'messages', label: 'פניות' }, { id: 'committees', label: 'הודעות לוועדות' }, { id: 'announcements', label: 'הודעות כלליות' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Announcements tab */}
      {tab === 'announcements' && <AdminAnnouncementsPage embedded />}

      {/* Committee messages tab */}
      {tab === 'committees' && loadingCommittee && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary-400" />
        </div>
      )}
      {tab === 'committees' && !loadingCommittee && (committeeMessages.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <Network size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">אין הודעות לוועדות עדיין</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 items-start">
          <div className="space-y-2">
            {committeeMessages.map(msg => (
              <button
                key={msg.id}
                onClick={async () => {
                  setSelectedCMsg(msg)
                  if (!msg.read) {
                    await markCommitteeMessageRead(msg.id)
                    setCommitteeMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m))
                  }
                }}
                className={clsx(
                  'w-full text-right card p-4 border-2 transition-all',
                  selectedCMsg?.id === msg.id
                    ? 'border-primary-500 bg-primary-50'
                    : msg.read
                      ? 'border-transparent hover:border-gray-200'
                      : 'border-primary-200 bg-blue-50 hover:border-primary-400'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {!msg.read && <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />}
                      <span className="font-semibold text-sm text-gray-800 truncate dark:text-gray-100">
                        {committeeNames[msg.committeeId] || 'ועדה'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 dark:text-gray-400">
                      <User size={11} />
                      {msg.userName}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(msg.createdAt)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-2 line-clamp-2 dark:text-gray-400">{msg.body}</p>
              </button>
            ))}
          </div>
          {selectedCMsg && (
            <div className="card p-5 space-y-4">
              <div>
                <h2 className="font-bold text-gray-800 text-base dark:text-gray-100">
                  {committeeNames[selectedCMsg.committeeId] || 'ועדה'}
                </h2>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1"><User size={12} />{selectedCMsg.userName}</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{formatDate(selectedCMsg.createdAt)}</div>
              </div>
              <hr />
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed dark:text-gray-200">{selectedCMsg.body}</p>
            </div>
          )}
        </div>
      ))}

      {/* Messages tab */}
      {tab === 'messages' && loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary-400" />
        </div>
      )}

      {tab === 'messages' && !loading && (messages.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">אין הודעות עדיין</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 items-start">
          {/* Message list */}
          <div className="space-y-2">
            {messages.map(msg => (
              <button
                key={msg.id}
                onClick={() => handleSelect(msg)}
                className={clsx(
                  'w-full text-right card p-4 border-2 transition-all',
                  selected?.id === msg.id
                    ? 'border-primary-500 bg-primary-50'
                    : msg.read
                      ? 'border-transparent hover:border-gray-200'
                      : 'border-primary-200 bg-blue-50 hover:border-primary-400'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {!msg.read && <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />}
                      <span className="font-semibold text-sm text-gray-800 truncate dark:text-gray-100">{msg.subject}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 dark:text-gray-400">
                      <User size={11} />
                      {msg.userName} · {ROLE_LABELS[msg.userRole] || msg.userRole}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(msg.createdAt)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-2 line-clamp-2 dark:text-gray-400">{msg.body}</p>
              </button>
            ))}
          </div>

          {/* Message detail */}
          {selected && (
            <div className="card p-5 space-y-4">
              <div>
                <h2 className="font-bold text-gray-800 text-base dark:text-gray-100">{selected.subject}</h2>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1"><User size={12} />{selected.userName}</span>
                  <span className="flex items-center gap-1"><Mail size={12} />{selected.userEmail}</span>
                  <span>{ROLE_LABELS[selected.userRole] || selected.userRole}</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{formatDate(selected.createdAt)}</div>
              </div>
              <hr />
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed dark:text-gray-200">{selected.body}</p>

              {/* Reply thread */}
              {selected.replies?.length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <Thread replies={selected.replies} />
                </div>
              )}

              {/* In-app reply */}
              <div className="pt-2">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={2}
                  placeholder="כתבו תשובה שההורה יראה באפליקציה..."
                  className="input w-full text-right text-sm resize-none"
                />
                <div className="flex items-center justify-between mt-2 gap-2">
                  <a href={`mailto:${selected.userEmail}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <Mail size={12} /> השב במייל במקום
                  </a>
                  <button onClick={handleReply} disabled={replying || !replyText.trim()}
                    className="btn-primary text-sm py-1.5 px-4 inline-flex items-center gap-2 disabled:opacity-50">
                    {replying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    שלח תשובה
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
