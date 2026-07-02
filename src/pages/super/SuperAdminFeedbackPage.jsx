import { useState, useEffect } from 'react'
import { getFeedback, updateFeedbackStatus, replyToFeedback } from '../../lib/db'
import { Loader2, MessageSquarePlus, Send, ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'

const STATUSES = [
  { value: 'new',      label: 'חדש' },
  { value: 'reviewed', label: 'נבדק' },
  { value: 'resolved', label: 'טופל' },
]

const STATUS_STYLE = {
  new:      'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  reviewed: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  resolved: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
}

function FeedbackItem({ item, onStatusChange }) {
  const [expanded, setExpanded] = useState(!item.status || item.status === 'new')
  const [reply, setReply] = useState(item.adminReply || '')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(!!item.adminReply)

  const ts = item.createdAt?.toDate ? item.createdAt.toDate()
    : item.createdAt ? new Date(item.createdAt) : null

  const handleSendReply = async () => {
    if (!reply.trim()) return
    setSending(true)
    try {
      await replyToFeedback(item.id, reply.trim())
      setSent(true)
      onStatusChange(item.id, 'resolved')
    } finally { setSending(false) }
  }

  return (
    <div className={clsx(
      'card border transition-colors',
      (!item.status || item.status === 'new') ? 'border-amber-300 dark:border-amber-700' : 'border-gray-100 dark:border-gray-700'
    )}>
      <div className="flex items-start justify-between gap-3 p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-2 flex-shrink-0">
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          <select
            value={item.status || 'new'}
            onClick={e => e.stopPropagation()}
            onChange={e => { e.stopPropagation(); onStatusChange(item.id, e.target.value) }}
            className={clsx('text-xs px-2.5 py-1.5 rounded-lg border font-medium cursor-pointer', STATUS_STYLE[item.status] || STATUS_STYLE.new)}
          >
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="text-right flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.submittedBy?.name || 'אנונימי'}</div>
          <div className="text-xs text-gray-400 truncate">{item.submittedBy?.email}</div>
          {ts && <div className="text-xs text-gray-300 mt-0.5">{ts.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-50 dark:border-gray-700 px-4 pb-4 pt-3 space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-300 text-right whitespace-pre-wrap leading-relaxed">{item.text}</p>
          {item.screenshotUrl && (
            <img src={item.screenshotUrl} alt="צילום מסך"
              className="rounded-xl max-h-64 object-contain border border-gray-100 dark:border-gray-700 ms-auto block" />
          )}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-2 text-right">
              {sent ? 'תגובת מנהל' : 'שלח תגובה למשתמש'}
            </label>
            <div className="flex gap-2 items-end">
              <button
                onClick={handleSendReply}
                disabled={sending || !reply.trim() || sent}
                className={clsx('flex-shrink-0 p-2.5 rounded-xl transition-colors',
                  sent ? 'bg-green-100 text-green-600 dark:bg-green-900/30 cursor-default'
                       : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40')}
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
              <textarea
                value={reply}
                onChange={e => { setReply(e.target.value); if (sent) setSent(false) }}
                rows={2}
                placeholder="כתוב תגובה או עדכון..."
                className="input flex-1 text-right resize-none text-sm"
              />
            </div>
            {sent && <p className="text-xs text-green-600 dark:text-green-400 text-right mt-1">✓ תגובה נשמרה</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SuperAdminFeedbackPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    getFeedback().then(setItems).finally(() => setLoading(false))
  }, [])

  const changeStatus = async (id, status) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    await updateFeedbackStatus(id, status)
  }

  const newCount = items.filter(i => !i.status || i.status === 'new').length
  const filtered = filter === 'all' ? items : items.filter(i => (i.status || 'new') === filter)

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {[{ v: 'all', l: 'הכל' }, ...STATUSES.map(s => ({ v: s.value, l: s.label }))].map(({ v, l }) => (
            <button key={v} onClick={() => setFilter(v)}
              className={clsx('px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5',
                filter === v ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-300')}>
              {l}
              {v === 'new' && newCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{newCount}</span>
              )}
            </button>
          ))}
        </div>
        <h1 className="text-xl font-black text-primary-800 dark:text-primary-300 flex items-center gap-2">
          <MessageSquarePlus size={20} />
          משוב ובאגים
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageSquarePlus size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{filter === 'all' ? 'אין דיווחים עדיין' : 'אין פריטים בסטטוס זה'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <FeedbackItem key={item.id} item={item} onStatusChange={changeStatus} />
          ))}
        </div>
      )}
    </div>
  )
}
