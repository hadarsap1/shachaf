import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getTasks, saveTask, getEvents, MILESTONES, getForms, getSubmissionsForFamily, getChildrenByParent, getEmergencyMode } from '../../lib/db'
import ProgressRing from '../../components/ui/ProgressRing'
import TaskCard from '../../components/ui/TaskCard'
import EventCard from '../../components/ui/EventCard'
import EventDetailPanel from '../../components/ui/EventDetailPanel'
import { CheckSquare, Calendar, MessageCircle, ArrowLeft, Sparkles, ClipboardList, Loader2, AlertTriangle } from 'lucide-react'

function timeGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'בוקר טוב,'
  if (h < 17) return 'צהריים טובים,'
  if (h < 21) return 'אחר הצהריים טוב,'
  return 'ערב טוב,'
}

export default function DashboardPage() {
  const { user, isHostFamily } = useAuth()
  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])
  const [pendingForms, setPendingForms] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [emergency, setEmergency] = useState(null)

  useEffect(() => {
    getEmergencyMode().then(m => { if (m?.active) setEmergency(m) })
  }, [])

  useEffect(() => {
    if (!user?.uid) return
    Promise.all([getTasks(user.uid), getEvents(), getForms(), getSubmissionsForFamily(user.uid), getChildrenByParent(user.uid)])
      .then(([taskData, eventData, allForms, allSubmissions, children]) => {
        setTasks(taskData)
        const role = user.role
        const today = new Date().toISOString().slice(0, 10)
        // Only future events, matching the user's target groups.
        setEvents(eventData.filter(ev => {
          if (ev.date && ev.date < today) return false
          const tg = ev.targetGroups || []
          return !tg.length || tg.includes('all') || tg.includes(role)
        }))
        // Pending-forms count mirrors FormFillPage (includes class-targeted forms).
        const myClassIds = [...new Set(children.map(c => c.classId).filter(Boolean))]
        const myForms = allForms.filter(f =>
          f.status === 'published' && (
            f.targetRole === user.role ||
            f.targetRole === 'all' ||
            (f.targetRole === 'class' && (f.classIds || []).some(id => myClassIds.includes(id)))
          )
        )
        setPendingForms(myForms.filter(f => !allSubmissions.find(s => s.formId === f.id)).length)
      })
      .catch(err => { console.error('Dashboard load failed:', err) })
      .finally(() => setLoading(false))
  }, [user])

  const myTasks = tasks
  const doneTasks = myTasks.filter(t => t.status === 'done')
  const progress = myTasks.length ? Math.round((doneTasks.length / myTasks.length) * 100) : 0

  const upcomingEvents = events.slice(0, 2)
  const urgentTasks = myTasks.filter(t => t.status !== 'done' && t.priority === 'high').slice(0, 3)

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

  const currentMilestone = MILESTONES.find(m => {
    const msTasksDone = myTasks.filter(t => t.milestone === m.title && t.status === 'done').length
    const msTasks = myTasks.filter(t => t.milestone === m.title).length
    return msTasksDone < msTasks
  }) || MILESTONES[MILESTONES.length - 1]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-primary-400" />
      </div>
    )
  }

  return (
    <div className="page-container rtl" dir="rtl">
      {/* Emergency banner */}
      {emergency && (
        <Link
          to="/emergency"
          className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 mb-5 hover:shadow-card-hover transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <div className="flex-1 text-right">
            <div className="font-bold text-red-800 text-sm">{emergency.title || 'שגרת חירום פעילה'}</div>
            {emergency.message && <div className="text-xs text-red-600 mt-0.5 line-clamp-1">{emergency.message}</div>}
            <div className="text-xs text-red-500 mt-0.5">לחצו לצפייה בלוח השיעורים</div>
          </div>
          <ArrowLeft size={16} className="text-red-400 flex-shrink-0" />
        </Link>
      )}

      {/* Greeting banner */}
      <div className="bg-gradient-to-l from-primary-600 to-secondary-500 rounded-3xl p-5 sm:p-6 mb-6 text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-40 h-40 rounded-full bg-white/5 -translate-x-10 -translate-y-10" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium">{timeGreeting()}</p>
              <h1 className="text-2xl font-black mt-0.5">{user?.name}</h1>
              <p className="text-primary-100 text-sm mt-1">
                {isHostFamily ? 'אתם עוזרים לקלוט משפחות חדשות — תודה!' : 'ברוכים הבאים לקהילת שחף!'}
              </p>
            </div>
            <ProgressRing percent={progress} size={72} strokeWidth={6} />
          </div>

          <div className="mt-4 bg-white/20 backdrop-blur rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">{currentMilestone.icon}</span>
            <div>
              <div className="text-xs text-primary-100">אתם נמצאים בשלב</div>
              <div className="font-bold text-sm">{currentMilestone.title}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Link to="/tasks" className="card p-3 text-center hover:shadow-card-hover transition-shadow">
          <div className="text-2xl font-black text-primary-600">{myTasks.filter(t => t.status !== 'done').length}</div>
          <div className="text-xs text-gray-500 mt-0.5">משימות פתוחות</div>
        </Link>
        <Link to="/events" className="card p-3 text-center hover:shadow-card-hover transition-shadow">
          <div className="text-2xl font-black text-secondary-500">{events.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">אירועים קרובים</div>
        </Link>
        <Link to="/chat" className="card p-3 text-center hover:shadow-card-hover transition-shadow">
          <div className="text-2xl font-black text-accent-500">
            <Sparkles size={22} className="mx-auto" />
          </div>
          <div className="text-xs text-gray-500 mt-0.5">עוזר חכם</div>
        </Link>
      </div>

      {/* Pending forms banner */}
      {pendingForms > 0 && (
        <Link
          to="/forms"
          className="card p-4 flex items-center gap-3 mb-6 bg-amber-50 border border-amber-200 hover:shadow-card-hover transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <ClipboardList size={18} className="text-amber-600" />
          </div>
          <div className="flex-1 text-right">
            <div className="font-semibold text-amber-900 text-sm">יש לך {pendingForms} טופס{pendingForms > 1 ? 'ים' : ''} למילוי</div>
            <div className="text-xs text-amber-700 mt-0.5">לחצו כדי למלא את הפרטים הנדרשים</div>
          </div>
          <ArrowLeft size={16} className="text-amber-400 flex-shrink-0" />
        </Link>
      )}

      {/* Next tasks */}
      {urgentTasks.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="section-title flex items-center gap-2">
              <CheckSquare size={18} className="text-primary-600" />
              משימות לביצוע
            </div>
            <Link to="/tasks" className="text-xs text-primary-600 flex items-center gap-1 hover:underline">
              הכל
              <ArrowLeft size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {urgentTasks.map(task => (
              <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming events */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="section-title flex items-center gap-2">
            <Calendar size={18} className="text-primary-600" />
            אירועים קרובים
          </div>
          <Link to="/events" className="text-xs text-primary-600 flex items-center gap-1 hover:underline">
            הכל
            <ArrowLeft size={12} />
          </Link>
        </div>
        {upcomingEvents.length === 0 ? (
          <div className="card p-6 text-center text-gray-400">
            <Calendar size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">אין אירועים קרובים כרגע</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {upcomingEvents.map(event => (
              <EventCard key={event.id} event={event} onCardClick={() => setSelectedEvent(event)} />
            ))}
          </div>
        )}
      </section>

      {/* AI Chat CTA */}
      <Link
        to="/chat"
        className="card p-4 flex items-center gap-4 hover:shadow-card-hover transition-all duration-200 bg-gradient-to-l from-primary-50 to-secondary-50 border border-primary-100"
      >
        <div className="p-3 bg-primary-600 rounded-2xl text-white">
          <MessageCircle size={22} />
        </div>
        <div className="flex-1 text-right">
          <div className="font-semibold text-gray-800 text-sm">יש לך שאלה?</div>
          <div className="text-xs text-gray-500 mt-0.5">העוזר החכם שלנו זמין 24/7</div>
        </div>
        <ArrowLeft size={16} className="text-primary-400" />
      </Link>

      {selectedEvent && (
        <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  )
}
