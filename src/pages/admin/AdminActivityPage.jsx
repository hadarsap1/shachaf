import { useState, useEffect } from 'react'
import { getMessages, getTasks, getEvents } from '../../lib/db'
import { Activity, MessageSquare, CheckSquare, Calendar, Loader2 } from 'lucide-react'

function toDate(ts) {
  if (!ts) return null
  if (ts.toDate) return ts.toDate()
  return new Date(ts)
}

function buildLogs(messages, tasks, events) {
  const logs = []

  messages.forEach(m => {
    const d = toDate(m.createdAt)
    if (d) logs.push({ id: `msg-${m.id}`, type: 'message', date: d, title: m.userName, detail: `שלח הודעה: ${m.subject}`, icon: MessageSquare, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' })
  })

  tasks.forEach(t => {
    const d = toDate(t.createdAt)
    if (d) logs.push({ id: `task-${t.id}`, type: 'task', date: d, title: 'מנהל', detail: `נוצרה משימה: ${t.title}`, icon: CheckSquare, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/30' })
  })

  events.forEach(e => {
    const d = toDate(e.createdAt)
    if (d) logs.push({ id: `event-${e.id}`, type: 'event', date: d, title: 'מנהל', detail: `נוסף אירוע: ${e.title}`, icon: Calendar, color: 'text-accent-600 dark:text-accent-400', bg: 'bg-accent-50 dark:bg-accent-900/30' })
  })

  return logs.sort((a, b) => b.date - a.date)
}

function groupByDate(logs) {
  const groups = {}
  logs.forEach(log => {
    const label = log.date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!groups[label]) groups[label] = []
    groups[label].push(log)
  })
  return groups
}

export default function AdminActivityPage() {
  const [logs, setLogs]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getMessages(), getTasks(), getEvents()])
      .then(([m, t, e]) => {
        setLogs(buildLogs(m, t, e))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const groups = groupByDate(logs)

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 dark:text-primary-300">
          <span className="text-xl leading-none">📊</span>
          יומן פעילות
        </h1>
        <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">{loading ? '...' : `${logs.length} פעולות מוקלטות`}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-primary-400" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Activity size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">אין פעילות מוקלטת</p>
        </div>
      ) : (
        Object.entries(groups).map(([date, items]) => (
          <section key={date} className="mb-6">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 px-1">{date}</h2>
            <div className="card divide-y divide-gray-50 dark:divide-gray-700">
              {items.map(log => {
                const Icon = log.icon
                return (
                  <div key={log.id} className="flex items-start gap-3 p-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${log.bg}`}>
                      <Icon size={14} className={log.color} />
                    </div>
                    <div className="flex-1 text-right">
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{log.title}</div>
                      <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{log.detail}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                      {log.date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
