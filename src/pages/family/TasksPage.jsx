import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getTasks, saveTask, getChildrenByParent, MILESTONES } from '../../lib/db'
import TaskCard from '../../components/ui/TaskCard'
import ProgressRing from '../../components/ui/ProgressRing'
import { CheckSquare, Loader2 } from 'lucide-react'
import clsx from 'clsx'

const FILTERS = [
  { key: 'all', label: 'הכל' },
  { key: 'pending', label: 'ממתין' },
  { key: 'in_progress', label: 'בתהליך' },
  { key: 'done', label: 'הושלם' },
]

export default function TasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return
    Promise.all([getTasks(), getChildrenByParent(user.uid)])
      .then(([allTasks, children]) => {
        const myClassIds = [...new Set(children.map(c => c.classId).filter(Boolean))]
        const role = user.role
        setTasks(allTasks.filter(t => {
          const tg = t.targetGroups || ['all']
          if (tg.includes('all') || tg.includes(role)) return true
          if (tg.includes('class')) return (t.classIds || []).some(id => myClassIds.includes(id))
          return false
        }))
        setLoading(false)
      })
      .catch(err => { console.error('tasks load failed:', err); setLoading(false) })
  }, [user])

  const myTasks = tasks
  const doneTasks = myTasks.filter(t => t.status === 'done')
  const progress = myTasks.length ? Math.round((doneTasks.length / myTasks.length) * 100) : 0

  const filtered = filter === 'all' ? myTasks : myTasks.filter(t => t.status === filter)

  const handleStatusChange = async (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const updated = { ...task, status: newStatus }
    setTasks(prev => prev.map(t => t.id === taskId ? updated : t))
    try {
      await saveTask(updated)
    } catch (err) {
      console.error('status update failed:', err)
      setTasks(prev => prev.map(t => t.id === taskId ? task : t))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin" size={32} />
      </div>
    )
  }

  return (
    <div className="page-container rtl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-primary-800 flex items-center gap-2">
            <span className="text-2xl leading-none">✅</span>
            המשימות שלי
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{doneTasks.length} מתוך {myTasks.length} הושלמו</p>
        </div>
        <ProgressRing percent={progress} size={64} strokeWidth={6} />
      </div>

      {/* Progress bar */}
      <div className="progress-bar mb-6">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={clsx(
              'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all',
              filter === f.key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
            )}
          >
            {f.label}
            {f.key !== 'all' && (
              <span className="ms-1.5 text-xs opacity-70">
                ({myTasks.filter(t => t.status === f.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tasks grouped by milestone */}
      {MILESTONES.map(milestone => {
        const milestoneTasks = filtered.filter(t => t.milestone === milestone.title)
        if (milestoneTasks.length === 0) return null

        const done = milestoneTasks.filter(t => t.status === 'done').length
        const pct = Math.round((done / milestoneTasks.length) * 100)

        return (
          <section key={milestone.id} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{milestone.icon}</span>
                <h2 className="font-bold text-gray-700 text-sm">{milestone.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">{done}/{milestoneTasks.length}</div>
                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary-400 to-secondary-400 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {milestoneTasks.map(task => (
                <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} />
              ))}
            </div>
          </section>
        )
      })}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CheckSquare size={44} className="mx-auto mb-4 opacity-25" />
          <p className="font-semibold text-gray-500">
            {filter === 'all' ? 'אין משימות פעילות כרגע' : 'אין משימות בסטטוס זה'}
          </p>
          <p className="text-sm mt-1">
            {filter === 'all' ? 'המשימות שלך יופיעו כאן כשהמנהל יוסיף אותן' : 'נסה לשנות את הסינון'}
          </p>
        </div>
      )}
    </div>
  )
}
