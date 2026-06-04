import { MOCK_ACTIVITY_LOGS } from '../../lib/mockData'
import { Activity } from 'lucide-react'

const ACTION_CONFIG = {
  completed_task: { label: 'השלים משימה', color: 'text-green-600', bg: 'bg-green-50' },
  sent_message: { label: 'שלח הודעה', color: 'text-blue-600', bg: 'bg-blue-50' },
  chatbot_query: { label: 'שאלה לעוזר', color: 'text-purple-600', bg: 'bg-purple-50' },
  published_event: { label: 'פרסם אירוע', color: 'text-accent-600', bg: 'bg-accent-50' },
  logged_in: { label: 'כניסה למערכת', color: 'text-gray-600', bg: 'bg-gray-100' },
}

const groupByDate = (logs) => {
  const groups = {}
  logs.forEach(log => {
    const date = new Date(log.createdAt).toLocaleDateString('he-IL', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
    if (!groups[date]) groups[date] = []
    groups[date].push(log)
  })
  return groups
}

export default function AdminActivityPage() {
  const groups = groupByDate(MOCK_ACTIVITY_LOGS)

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2">
          <Activity size={22} />
          יומן פעילות
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{MOCK_ACTIVITY_LOGS.length} פעולות מוקלטות</p>
      </div>

      {Object.entries(groups).map(([date, logs]) => (
        <section key={date} className="mb-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 px-1">{date}</h2>
          <div className="card divide-y divide-gray-50">
            {logs.map(log => {
              const config = ACTION_CONFIG[log.action] || { label: log.action, color: 'text-gray-600', bg: 'bg-gray-100' }
              return (
                <div key={log.id} className="flex items-start gap-3 p-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                    <Activity size={14} className={config.color} />
                  </div>
                  <div className="flex-1 text-right">
                    <div className="flex items-center gap-2 justify-end flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{log.userName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color} font-medium`}>
                        {config.label}
                      </span>
                    </div>
                    {log.detail && (
                      <p className="text-xs text-gray-500 mt-0.5">{log.detail}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                    {new Date(log.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {MOCK_ACTIVITY_LOGS.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Activity size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">אין פעילות מוקלטת</p>
        </div>
      )}
    </div>
  )
}
