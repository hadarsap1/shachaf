import { useState, useEffect } from 'react'
import { getMessages, markMessageRead } from '../../lib/db'
import { MessageSquare, Check, Loader2, User, Mail } from 'lucide-react'
import clsx from 'clsx'

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
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    getMessages().then(m => { setMessages(m); setLoading(false) })
  }, [])

  async function handleSelect(msg) {
    setSelected(msg)
    if (!msg.read) {
      await markMessageRead(msg.id)
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m))
    }
  }

  const unread = messages.filter(m => !m.read).length

  if (loading) {
    return (
      <div className="page-container rtl flex items-center justify-center py-20" dir="rtl">
        <Loader2 size={32} className="animate-spin text-primary-400" />
      </div>
    )
  }

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2">
          <MessageSquare size={22} />
          הודעות
        </h1>
        {unread > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unread}</span>
        )}
      </div>

      {messages.length === 0 ? (
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
                      <span className="font-semibold text-sm text-gray-800 truncate">{msg.subject}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <User size={11} />
                      {msg.userName} · {ROLE_LABELS[msg.userRole] || msg.userRole}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(msg.createdAt)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{msg.body}</p>
              </button>
            ))}
          </div>

          {/* Message detail */}
          {selected && (
            <div className="card p-5 space-y-4">
              <div>
                <h2 className="font-bold text-gray-800 text-base">{selected.subject}</h2>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><User size={12} />{selected.userName}</span>
                  <span className="flex items-center gap-1"><Mail size={12} />{selected.userEmail}</span>
                  <span>{ROLE_LABELS[selected.userRole] || selected.userRole}</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{formatDate(selected.createdAt)}</div>
              </div>
              <hr />
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selected.body}</p>
              <a
                href={`mailto:${selected.userEmail}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2"
              >
                <Mail size={14} />
                השב במייל
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
