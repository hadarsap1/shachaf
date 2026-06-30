import { useState, useEffect } from 'react'
import { getFeedback, updateFeedbackStatus } from '../../lib/db'
import { MessageSquare, Loader2, Check, Clock, Archive } from 'lucide-react'
import clsx from 'clsx'

const STATUS_LABEL = { new: 'חדש', in_progress: 'בטיפול', done: 'טופל' }
const STATUS_STYLE = {
  new:         'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  done:        'bg-green-50 text-green-700 border-green-200',
}

export default function SuperAdminFeedbackPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFeedback().then(data => { setItems(data); setLoading(false) })
  }, [])

  const changeStatus = async (id, status) => {
    await updateFeedbackStatus(id, status)
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={28} className="animate-spin text-primary-400" />
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare size={22} className="text-primary-600" />
        <h1 className="text-xl font-black text-primary-800">פניות ורעיונות</h1>
        <span className="text-sm text-gray-400">({items.filter(i => i.status === 'new').length} חדשים)</span>
      </div>

      {items.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-25" />
          <p>אין פניות עדיין</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map(item => {
          const ts = item.createdAt?.toDate ? item.createdAt.toDate() : null
          return (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <select
                  value={item.status || 'new'}
                  onChange={e => changeStatus(item.id, e.target.value)}
                  className={clsx(
                    'text-xs px-2.5 py-1 rounded-full border font-medium cursor-pointer flex-shrink-0',
                    STATUS_STYLE[item.status || 'new']
                  )}
                >
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-800">{item.submittedBy?.name || 'אנונימי'}</span>
                  {ts && <p className="text-xs text-gray-400 mt-0.5">{ts.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
                </div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed text-right whitespace-pre-wrap">{item.text}</p>
              {item.screenshotUrl && (
                <a href={item.screenshotUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block">
                  <img src={item.screenshotUrl} alt="צילום מסך" className="max-h-48 rounded-xl border border-gray-100 object-contain" />
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
