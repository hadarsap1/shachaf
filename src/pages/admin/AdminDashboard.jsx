import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getTasks, getEvents, getUsers, getMessages } from '../../lib/db'
import StatCard from '../../components/ui/StatCard'
import {
  Users, CheckSquare, Calendar, Activity,
  Clock, TrendingUp, UserPlus, X, MessageCircle,
  Loader2, MessageSquare,
} from 'lucide-react'
import clsx from 'clsx'

const isUrl = (s) => typeof s === 'string' && s.startsWith('http')

function UsersPanel({ users, title }) {
  return (
    <div className="space-y-2">
      {users.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-6">אין משתמשים עדיין</p>
      )}
      {users.map(u => {
        const phone = u.phone?.replace(/\D/g, '') || ''
        return (
          <div key={u.uid} className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
            {isUrl(u.avatar)
              ? <img src={u.avatar} alt="" className="w-9 h-9 rounded-full flex-shrink-0 object-cover" />
              : <div className="avatar w-9 h-9 text-sm bg-primary-100 text-primary-700 flex-shrink-0">{u.name?.[0] || '?'}</div>
            }
            <div className="flex-1 text-right min-w-0">
              <div className="font-semibold text-gray-800 text-sm">{u.name}</div>
              <div className="text-xs text-gray-500 truncate">{u.email}</div>
            </div>
            {phone && (
              <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex-shrink-0">
                <MessageCircle size={14} />
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SlidePanel({ title, sub, children, onClose }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col animate-slide-from-right" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
          <div className="text-right">
            <h2 className="font-bold text-gray-800">{title}</h2>
            {sub && <p className="text-xs text-gray-500">{sub}</p>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </>
  )
}

export default function AdminDashboard() {
  const [activePanel, setActivePanel] = useState(null)
  const [tasks, setTasks]     = useState([])
  const [events, setEvents]   = useState([])
  const [users, setUsers]     = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getTasks(), getEvents(), getUsers(), getMessages()])
      .then(([t, e, u, m]) => {
        setTasks(t); setEvents(e); setUsers(u); setMessages(m)
        setLoading(false)
      })
      .catch(err => { console.error('Dashboard load failed', err); setLoading(false) })
  }, [])

  const pendingTasks    = tasks.filter(t => t.status === 'pending').length
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length
  const doneTasks       = tasks.filter(t => t.status === 'done').length
  const totalTasks      = tasks.length

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const upcomingEvents = events.filter(e => e.date && new Date(e.date) >= today).length

  const newFamilies  = users.filter(u => u.role === 'new_family')
  const hostFamilies = users.filter(u => u.role === 'host_family')
  const avgCompletion = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const unreadMessages = messages.filter(m => !m.read).length

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-primary-800">לוח בקרה</h1>
        <p className="text-sm text-gray-500 mt-0.5">סקירה כללית של פלטפורמת שחף</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 size={36} className="animate-spin text-primary-400" />
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard icon={Users}     label="משפחות חדשות"   value={newFamilies.length}  color="primary"   onClick={() => setActivePanel('new_families')} />
            <StatCard icon={UserPlus}  label="משפחות מארחות"  value={hostFamilies.length} color="secondary" onClick={() => setActivePanel('host_families')} />
            <StatCard icon={TrendingUp} label="השלמת משימות"  value={`${avgCompletion}%`} color="success"   onClick={() => setActivePanel('tasks')} />
            <StatCard icon={Clock}     label="אירועים קרובים" value={upcomingEvents}       color="accent" />
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* Task status */}
            <div className="card p-5">
              <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                <CheckSquare size={16} className="text-primary-600" />
                סטטוס משימות
              </h2>
              {totalTasks === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">אין משימות עדיין</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'ממתין',  count: pendingTasks,    color: 'bg-gray-300',    pct: (pendingTasks    / totalTasks) * 100 },
                    { label: 'בתהליך', count: inProgressTasks, color: 'bg-primary-400', pct: (inProgressTasks / totalTasks) * 100 },
                    { label: 'הושלם',  count: doneTasks,       color: 'bg-green-400',   pct: (doneTasks       / totalTasks) * 100 },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">{item.count}</span>
                        <span className="font-medium text-gray-600">{item.label}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${item.color} transition-all`} style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="card p-5">
              <h2 className="font-bold text-gray-700 mb-4">פעולות מהירות</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { to: '/admin/users',    label: 'ניהול משתמשים', icon: Users,         color: 'bg-primary-50 text-primary-600 border-primary-200' },
                  { to: '/admin/tasks',    label: 'פרסם משימה',    icon: CheckSquare,   color: 'bg-secondary-50 text-secondary-600 border-secondary-200' },
                  { to: '/admin/events',   label: 'צור אירוע',     icon: Calendar,      color: 'bg-accent-50 text-accent-600 border-accent-200' },
                  { to: '/admin/messages', label: `הודעות${unreadMessages > 0 ? ` (${unreadMessages})` : ''}`, icon: MessageSquare, color: 'bg-purple-50 text-purple-600 border-purple-200' },
                ].map(action => {
                  const Icon = action.icon
                  return (
                    <Link key={action.to} to={action.to}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border hover:scale-105 transition-all text-center ${action.color}`}>
                      <Icon size={18} />
                      <span className="text-xs font-medium">{action.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Recent messages */}
          {messages.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <Link to="/admin/messages" className="text-xs text-primary-600 hover:underline">הצג הכל</Link>
                <h2 className="font-bold text-gray-700 flex items-center gap-2">
                  <MessageSquare size={16} className="text-primary-600" />
                  הודעות אחרונות
                  {unreadMessages > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{unreadMessages}</span>
                  )}
                </h2>
              </div>
              <div className="space-y-2">
                {messages.slice(0, 3).map(msg => (
                  <Link key={msg.id} to="/admin/messages"
                    className={clsx('block p-3 rounded-xl text-right transition-colors hover:bg-gray-50',
                      !msg.read ? 'bg-blue-50' : 'bg-gray-50')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-400">
                        {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleDateString('he-IL') : ''}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {!msg.read && <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />}
                        <span className="font-semibold text-gray-800 text-sm">{msg.subject}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{msg.userName} · {msg.body}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Panels */}
          {activePanel === 'new_families' && (
            <SlidePanel title="משפחות חדשות" sub={`${newFamilies.length} משפחות`} onClose={() => setActivePanel(null)}>
              <UsersPanel users={newFamilies} />
            </SlidePanel>
          )}
          {activePanel === 'host_families' && (
            <SlidePanel title="משפחות מארחות" sub={`${hostFamilies.length} מארחות`} onClose={() => setActivePanel(null)}>
              <UsersPanel users={hostFamilies} />
            </SlidePanel>
          )}
          {activePanel === 'tasks' && (
            <SlidePanel title="פירוט משימות" sub={`${totalTasks} משימות`} onClose={() => setActivePanel(null)}>
              <div className="space-y-2">
                {tasks.length === 0 && <p className="text-center text-sm text-gray-400 py-6">אין משימות</p>}
                {tasks.map(t => (
                  <div key={t.id} className={clsx('bg-gray-50 rounded-xl p-3 text-right',
                    t.status === 'done' && 'opacity-60')}>
                    <div className="font-medium text-gray-800 text-sm">{t.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {t.status === 'done' ? '✓ הושלם' : t.status === 'in_progress' ? 'בתהליך' : 'ממתין'}
                    </div>
                  </div>
                ))}
              </div>
            </SlidePanel>
          )}
        </>
      )}
    </div>
  )
}
