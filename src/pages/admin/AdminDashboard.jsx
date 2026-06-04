import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MOCK_STATS, MOCK_ACTIVITY_LOGS, MOCK_TASKS,
  MOCK_NEW_FAMILIES, MOCK_HOST_FAMILIES,
} from '../../lib/mockData'
import StatCard from '../../components/ui/StatCard'
import { Users, CheckSquare, Calendar, Activity, Clock, TrendingUp, UserPlus, X, MessageCircle } from 'lucide-react'
import clsx from 'clsx'

const ACTION_LABELS = {
  completed_task: { label: 'השלים משימה', color: 'text-green-600', bg: 'bg-green-50' },
  sent_message:   { label: 'שלח הודעה',   color: 'text-blue-600',  bg: 'bg-blue-50' },
  chatbot_query:  { label: 'שאלה לעוזר',  color: 'text-purple-600',bg: 'bg-purple-50' },
  published_event:{ label: 'פרסם אירוע',  color: 'text-accent-600',bg: 'bg-accent-50' },
}

// ---- Panel content components ----

function NewFamiliesPanel() {
  const hostMap = Object.fromEntries(MOCK_HOST_FAMILIES.map(h => [h.id, h.name]))

  return (
    <div className="space-y-2">
      {MOCK_NEW_FAMILIES.map(f => {
        const pct = Math.round((f.tasksDone / f.tasksTotal) * 100)
        const hostName = hostMap[f.hostFamilyId] || '—'
        const phone = f.phone?.replace(/\D/g, '') || ''

        return (
          <div key={f.id} className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="avatar w-9 h-9 text-sm bg-primary-100 text-primary-700 flex-shrink-0">
                {f.avatar}
              </div>
              <div className="flex-1 text-right min-w-0">
                <div className="font-semibold text-gray-800 text-sm">{f.name}</div>
                <div className="text-xs text-gray-500 truncate">מארחת: {hostName}</div>
              </div>
              {phone && (
                <a
                  href={`https://wa.me/${phone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex-shrink-0"
                >
                  <MessageCircle size={14} />
                </a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary-400 to-secondary-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 flex-shrink-0 w-12 text-left">
                {f.tasksDone}/{f.tasksTotal}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HostFamiliesPanel() {
  const newFamilyMap = Object.fromEntries(MOCK_NEW_FAMILIES.map(f => [f.id, f]))

  return (
    <div className="space-y-2">
      {MOCK_HOST_FAMILIES.map(h => {
        const assigned = h.assignedIds.map(id => newFamilyMap[id]).filter(Boolean)

        return (
          <div key={h.id} className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="avatar w-9 h-9 text-sm bg-secondary-100 text-secondary-700 flex-shrink-0">
                {h.avatar}
              </div>
              <div className="flex-1 text-right">
                <div className="font-semibold text-gray-800 text-sm">{h.name}</div>
                <div className="text-xs text-gray-500">
                  {assigned.length > 0 ? `${assigned.length} משפחות בטיפול` : 'ללא משפחות כרגע'}
                </div>
              </div>
            </div>
            {assigned.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {assigned.map(f => (
                  <span key={f.id} className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-600">
                    {f.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TasksPanel() {
  const byFamily = MOCK_NEW_FAMILIES.map(f => {
    const familyTasks = MOCK_TASKS.filter(t => t.assignedTo === f.id)
    const done = familyTasks.filter(t => t.status === 'done').length
    const inProgress = familyTasks.filter(t => t.status === 'in_progress').length
    const pending = familyTasks.filter(t => t.status === 'pending').length
    const pct = familyTasks.length ? Math.round((done / familyTasks.length) * 100) : Math.round((f.tasksDone / f.tasksTotal) * 100)
    return { ...f, done: familyTasks.length ? done : f.tasksDone, inProgress, pending, pct }
  })

  return (
    <div className="space-y-2">
      {byFamily.map(f => (
        <div key={f.id} className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">{f.pct}%</span>
            <span className="text-sm font-semibold text-gray-800">{f.name}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-400 to-secondary-400 transition-all"
              style={{ width: `${f.pct}%` }}
            />
          </div>
          <div className="flex justify-end gap-3 mt-1.5 text-xs text-gray-400">
            <span className="text-green-600">{f.done} הושלמו</span>
            {f.inProgress > 0 && <span className="text-primary-500">{f.inProgress} בתהליך</span>}
            {f.pending > 0 && <span>{f.pending} ממתינות</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- Slide Panel ----

const PANELS = {
  new_families: { title: 'משפחות חדשות', sub: `${MOCK_STATS.totalNewFamilies} משפחות`, Content: NewFamiliesPanel },
  host_families: { title: 'משפחות מארחות', sub: `${MOCK_STATS.totalHostFamilies} מארחות`, Content: HostFamiliesPanel },
  task_completion: { title: 'השלמת משימות', sub: 'פירוט לפי משפחה', Content: TasksPanel },
}

function SlidePanel({ panelKey, onClose }) {
  const panel = PANELS[panelKey]
  if (!panel) return null
  const { Content } = panel

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col animate-slide-from-right" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
          <div className="text-right">
            <h2 className="font-bold text-gray-800">{panel.title}</h2>
            <p className="text-xs text-gray-500">{panel.sub}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <Content />
        </div>
      </div>
    </>
  )
}

// ---- Dashboard ----

export default function AdminDashboard() {
  const [activePanel, setActivePanel] = useState(null)
  const pendingTasks = MOCK_TASKS.filter(t => t.status === 'pending').length
  const inProgressTasks = MOCK_TASKS.filter(t => t.status === 'in_progress').length
  const doneTasks = MOCK_TASKS.filter(t => t.status === 'done').length

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-primary-800">לוח בקרה</h1>
        <p className="text-sm text-gray-500 mt-0.5">סקירה כללית של פלטפורמת שחף</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={Users} label="משפחות חדשות" value={MOCK_STATS.totalNewFamilies} color="primary"
          onClick={() => setActivePanel('new_families')}
        />
        <StatCard
          icon={UserPlus} label="משפחות מארחות" value={MOCK_STATS.totalHostFamilies} color="secondary"
          onClick={() => setActivePanel('host_families')}
        />
        <StatCard
          icon={TrendingUp} label="השלמת משימות" value={`${MOCK_STATS.avgTaskCompletion}%`} color="success"
          onClick={() => setActivePanel('task_completion')}
        />
        <StatCard
          icon={Clock} label="אירועים קרובים" value={MOCK_STATS.upcomingEvents} color="accent"
        />
      </div>

      {/* Task overview */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
            <CheckSquare size={16} className="text-primary-600" />
            סטטוס משימות
          </h2>
          <div className="space-y-3">
            {[
              { label: 'ממתין',  count: pendingTasks,    color: 'bg-gray-300',    width: `${(pendingTasks    / MOCK_TASKS.length) * 100}%` },
              { label: 'בתהליך', count: inProgressTasks, color: 'bg-primary-400', width: `${(inProgressTasks / MOCK_TASKS.length) * 100}%` },
              { label: 'הושלם',  count: doneTasks,       color: 'bg-green-400',   width: `${(doneTasks       / MOCK_TASKS.length) * 100}%` },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">{item.count}</span>
                  <span className="font-medium text-gray-600">{item.label}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${item.color} transition-all`} style={{ width: item.width }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card p-5">
          <h2 className="font-bold text-gray-700 mb-4">פעולות מהירות</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { to: '/admin/users',    label: 'הוסף משפחה', icon: UserPlus,    color: 'bg-primary-50 text-primary-600 border-primary-200' },
              { to: '/admin/tasks',    label: 'פרסם משימה', icon: CheckSquare, color: 'bg-secondary-50 text-secondary-600 border-secondary-200' },
              { to: '/admin/events',   label: 'צור אירוע',  icon: Calendar,    color: 'bg-accent-50 text-accent-600 border-accent-200' },
              { to: '/admin/activity', label: 'פעילות',     icon: Activity,    color: 'bg-purple-50 text-purple-600 border-purple-200' },
            ].map(action => {
              const Icon = action.icon
              return (
                <Link
                  key={action.to}
                  to={action.to}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border hover:scale-105 transition-all text-center ${action.color}`}
                >
                  <Icon size={18} />
                  <span className="text-xs font-medium">{action.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <Link to="/admin/activity" className="text-xs text-primary-600 hover:underline">הצג הכל</Link>
          <h2 className="font-bold text-gray-700 flex items-center gap-2">
            <Activity size={16} className="text-primary-600" />
            פעילות אחרונה
          </h2>
        </div>
        <div className="space-y-3">
          {MOCK_ACTIVITY_LOGS.map(log => {
            const config = ACTION_LABELS[log.action] || { label: log.action, color: 'text-gray-600', bg: 'bg-gray-50' }
            return (
              <div key={log.id} className="flex items-start gap-3">
                <span className="text-xs text-gray-400 flex-shrink-0 pt-0.5">
                  {new Date(log.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="flex-1 min-w-0 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-sm font-medium text-gray-800">{log.userName}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{log.detail}</p>
                </div>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                  <Activity size={12} className={config.color} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Slide panel */}
      {activePanel && (
        <SlidePanel panelKey={activePanel} onClose={() => setActivePanel(null)} />
      )}
    </div>
  )
}
