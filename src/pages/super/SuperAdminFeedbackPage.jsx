import { useState, useEffect } from 'react'
import { getFeedback, updateFeedbackStatus } from '../../lib/db'
import { Loader2, MessageSquarePlus } from 'lucide-react'
import clsx from 'clsx'

const STATUSES = [
  { value: 'new',      label: 'חדש' },
  { value: 'reviewed', label: 'נבדק' },
  { value: 'resolved', label: 'טופל' },
]

const STATUS_STYLE = {
  new:      'bg-amber-50 text-amber-700 border-amber-200',
  reviewed: 'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
}

export default function SuperAdminFeedbackPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFeedback().then(setItems).finally(() => setLoading(false))
  }, [])

  const changeStatus = async (id, status) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    await updateFeedbackStatus(id, status)
  }

  return (
    <div className="page-container rtl" dir="rtl">
      <h1 className="text-xl font-black text-primary-800 dark:text-primary-300 flex items-center gap-2 justify-end mb-6">
        <MessageSquarePlus size={20} />
        משוב ובאגים
      </h1>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary-400" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">אין דיווחים עדיין</div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="card p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <select
                  value={item.status || 'new'}
                  onChange={e => changeStatus(item.id, e.target.value)}
                  className={clsx('text-xs px-2.5 py-1.5 rounded-lg border font-medium cursor-pointer', STATUS_STYLE[item.status] || STATUS_STYLE.new)}
                >
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.submittedBy?.name || 'אנונימי'}</div>
                  <div className="text-xs text-gray-400">{item.submittedBy?.email}</div>
                </div>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 text-right whitespace-pre-wrap">{item.text}</p>
              {item.screenshotUrl && (
                <img src={item.screenshotUrl} alt="צילום מסך" className="mt-3 rounded-xl max-h-64 object-contain border border-gray-100 dark:border-gray-700" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
