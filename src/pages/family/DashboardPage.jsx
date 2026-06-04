import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { MOCK_TASKS, MOCK_EVENTS, MOCK_MILESTONES } from '../../lib/mockData'
import { getForms, getSubmissions } from '../../lib/formsStorage'
import ProgressRing from '../../components/ui/ProgressRing'
import TaskCard from '../../components/ui/TaskCard'
import EventCard from '../../components/ui/EventCard'
import { CheckSquare, Calendar, MessageCircle, ArrowLeft, Sparkles, ClipboardList } from 'lucide-react'

export default function DashboardPage() {
  const { user, isHostFamily } = useAuth()
  const [tasks, setTasks] = useState(MOCK_TASKS)
  const [pendingForms, setPendingForms] = useState(0)

  useEffect(() => {
    if (!user) return
    const myForms = getForms().filter(f =>
      f.status === 'published' && (f.targetRole === user.role || f.targetRole === 'all')
    )
    const mySubmissions = getSubmissions().filter(s => s.userId === user.id)
    const pending = myForms.filter(f => !mySubmissions.find(s => s.formId === f.id))
    setPendingForms(pending.length)
  }, [user])

  const myTasks = tasks.filter(t => t.assignedTo === 'new-1')
  const doneTasks = myTasks.filter(t => t.status === 'done')
  const progress = Math.round((doneTasks.length / myTasks.length) * 100)

  const upcomingEvents = MOCK_EVENTS.slice(0, 2)
  const urgentTasks = myTasks.filter(t => t.status !== 'done' && t.priority === 'high').slice(0, 3)

  const handleStatusChange = (taskId, newStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
  }

  const currentMilestone = MOCK_MILESTONES.find(m => {
    const msTasksDone = myTasks.filter(t => t.milestone === m.title && t.status === 'done').length
    const msTasks = myTasks.filter(t => t.milestone === m.title).length
    return msTasksDone < msTasks
  }) || MOCK_MILESTONES[MOCK_MILESTONES.length - 1]

  return (
    <div className="page-container rtl" dir="rtl">
      {/* Greeting banner */}
      <div className="bg-gradient-to-l from-primary-600 to-secondary-500 rounded-3xl p-5 sm:p-6 mb-6 text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-40 h-40 rounded-full bg-white/5 -translate-x-10 -translate-y-10" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium">שלום,</p>
              <h1 className="text-2xl font-black mt-0.5">{user?.name} 👋</h1>
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
          <div className="text-2xl font-black text-secondary-500">{upcomingEvents.length}</div>
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
        <div className="grid sm:grid-cols-2 gap-3">
          {upcomingEvents.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
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
    </div>
  )
}
