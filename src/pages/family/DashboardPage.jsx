import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getTasks, saveTask, getEvents, getForms, getSubmissionsForFamily,
  getChildrenByParent, getEmergencyMode, getHobbyGroups, getCommittees, getClasses,
} from '../../lib/db'
import TaskCard from '../../components/ui/TaskCard'
import EventCard from '../../components/ui/EventCard'
import EventDetailPanel from '../../components/ui/EventDetailPanel'
import {
  CheckSquare, Calendar, MessageCircle, ArrowLeft, ClipboardList,
  Loader2, AlertTriangle, Heart, Network, Users, Settings2, GripVertical,
  Eye, EyeOff, ChevronUp, ChevronDown, X, GraduationCap,
} from 'lucide-react'
import clsx from 'clsx'

// ── Widget registry ────────────────────────────────────────────────────────────
const WIDGET_DEFS = [
  { id: 'class',     label: 'הכיתה שלי',         icon: GraduationCap },
  { id: 'events',    label: 'אירועים קרובים',     icon: Calendar },
  { id: 'activity',  label: 'פעילות קהילה',    icon: Heart },
  { id: 'tasks',     label: 'משימות לביצוע',   icon: CheckSquare },
  { id: 'forms',     label: 'טפסים למילוי',    icon: ClipboardList },
  { id: 'ai',        label: 'עוזר חכם',        icon: MessageCircle },
]
const DEFAULT_WIDGET_ORDER = WIDGET_DEFS.map(w => w.id)
const WIDGETS_KEY = 'shachaf_dash_widgets'

function loadWidgetConfig() {
  try {
    const stored = localStorage.getItem(WIDGETS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Merge stored order/visibility with any new widgets
      const ids = parsed.map(w => w.id)
      const merged = [
        ...parsed,
        ...DEFAULT_WIDGET_ORDER.filter(id => !ids.includes(id)).map(id => ({ id, visible: true })),
      ]
      return merged
    }
  } catch {}
  return DEFAULT_WIDGET_ORDER.map(id => ({ id, visible: true }))
}

function saveWidgetConfig(cfg) {
  try { localStorage.setItem(WIDGETS_KEY, JSON.stringify(cfg)) } catch {}
}

// ── Greeting ───────────────────────────────────────────────────────────────────
function timeGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'בוקר טוב,'
  if (h < 17) return 'צהריים טובים,'
  if (h < 21) return 'אחר הצהריים טוב,'
  return 'ערב טוב,'
}

// ── Customize panel ────────────────────────────────────────────────────────────
function CustomizePanel({ config, onChange, onClose }) {
  const move = (idx, dir) => {
    const next = [...config]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    onChange(next)
  }
  const toggle = (id) => {
    onChange(config.map(w => w.id === id ? { ...w, visible: !w.visible } : w))
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right dark:bg-gray-800" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 flex items-center gap-2 dark:text-gray-100">
            <Settings2 size={16} className="text-primary-600" />
            התאמת לוח הבית
          </h2>
        </div>
        <p className="text-xs text-gray-400 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          הסתר או הצג חלקים, גרור לסידור מחדש
        </p>
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">
          {config.map((w, idx) => {
            const def = WIDGET_DEFS.find(d => d.id === w.id)
            if (!def) return null
            const Icon = def.icon
            return (
              <li key={w.id} className="flex items-center gap-3 px-5 py-3">
                <GripVertical size={16} className="text-gray-300 flex-shrink-0" />
                <div className="flex items-center gap-2 flex-1">
                  <Icon size={16} className={w.visible ? 'text-primary-600' : 'text-gray-300'} />
                  <span className={clsx('text-sm font-medium', w.visible ? 'text-gray-800' : 'text-gray-400')}>{def.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-20 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700">
                    <ChevronUp size={15} />
                  </button>
                  <button onClick={() => move(idx, 1)} disabled={idx === config.length - 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-20 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700">
                    <ChevronDown size={15} />
                  </button>
                  <button onClick={() => toggle(w.id)}
                    className={clsx('p-1.5 rounded-lg transition-colors ml-1',
                      w.visible ? 'text-primary-600 hover:bg-primary-50' : 'text-gray-300 hover:bg-gray-100')}>
                    {w.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}

// ── Activity feed ──────────────────────────────────────────────────────────────
function ActivityFeed({ events, groups, committees, user }) {
  const now = new Date()
  const msDay = 86400000
  const items = []

  // Events in the next 14 days
  events.slice(0, 4).forEach(ev => {
    if (!ev.date) return
    const d = new Date(ev.date)
    const diff = Math.round((d - now) / msDay)
    const when = diff === 0 ? 'היום' : diff === 1 ? 'מחר' : `בעוד ${diff} ימים`
    items.push({
      id: `ev-${ev.id}`,
      icon: Calendar,
      color: 'text-secondary-500 bg-secondary-50 dark:bg-secondary-900/30',
      title: ev.title,
      sub: when,
      link: '/events',
    })
  })

  // User's groups — show active groups
  const myGroups = groups.filter(g => (g.memberUids || []).includes(user?.uid))
  myGroups.slice(0, 2).forEach(g => {
    items.push({
      id: `grp-${g.id}`,
      icon: Heart,
      color: 'text-pink-500 bg-pink-50 dark:bg-pink-900/30',
      title: g.name,
      sub: `${(g.memberUids || []).length} חברים בקבוצה`,
      link: '/community',
    })
  })

  // New groups (created in last 30 days, user not yet member)
  const newGroups = groups.filter(g =>
    !(g.memberUids || []).includes(user?.uid) &&
    g.createdAt?.seconds > (now / 1000 - 30 * 86400)
  )
  newGroups.slice(0, 2).forEach(g => {
    items.push({
      id: `new-grp-${g.id}`,
      icon: Heart,
      color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30',
      title: `קבוצה חדשה: ${g.name}`,
      sub: 'לחצו להצטרף',
      link: '/community',
    })
  })

  // User's committees
  const myCommittees = committees.filter(c => (c.memberUids || []).includes(user?.uid))
  myCommittees.slice(0, 2).forEach(c => {
    items.push({
      id: `com-${c.id}`,
      icon: Network,
      color: 'text-primary-600 bg-primary-50 dark:bg-primary-900/30',
      title: c.name,
      sub: 'ועדה פעילה',
      link: '/committees',
    })
  })

  if (items.length === 0) {
    return (
      <div className="card p-6 text-center text-gray-400">
        <Heart size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">עדיין אין פעילות קהילתית — הצטרפו לקבוצות וועדות!</p>
      </div>
    )
  }

  return (
    <div className="card divide-y divide-gray-50 dark:divide-gray-700">
      {items.slice(0, 5).map(item => {
        const Icon = item.icon
        return (
          <Link key={item.id} to={item.link}
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl dark:hover:bg-gray-700/50">
            <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', item.color)}>
              <Icon size={16} />
            </div>
            <div className="flex-1 text-right min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate dark:text-gray-100">{item.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{item.sub}</div>
            </div>
            <ArrowLeft size={14} className="text-gray-300 flex-shrink-0" />
          </Link>
        )
      })}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, allRoles } = useAuth()
  const [tasks, setTasks]           = useState([])
  const [events, setEvents]         = useState([])
  const [groups, setGroups]         = useState([])
  const [committees, setCommittees] = useState([])
  const [myClasses, setMyClasses]   = useState([])
  const [pendingForms, setPendingForms] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [emergency, setEmergency]   = useState(null)
  const [widgetConfig, setWidgetConfig] = useState(loadWidgetConfig)
  const [showCustomize, setShowCustomize] = useState(false)

  const isFamily = allRoles?.has('new_family') || allRoles?.has('host_family')
  const hasClass = (user?.classIds || []).length > 0

  useEffect(() => {
    getEmergencyMode().then(m => { if (m?.active) setEmergency(m) })
  }, [])

  useEffect(() => {
    if (!user?.uid) return
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([
      isFamily ? getTasks(user.uid) : Promise.resolve([]),
      getEvents(),
      isFamily ? getForms() : Promise.resolve([]),
      isFamily ? getSubmissionsForFamily(user.uid) : Promise.resolve([]),
      isFamily ? getChildrenByParent(user.uid) : Promise.resolve([]),
      getHobbyGroups(),
      getCommittees(),
      hasClass ? getClasses() : Promise.resolve([]),
    ]).then(([taskData, eventData, allForms, allSubs, children, groupData, committeeData, allClasses]) => {
      setTasks(taskData)
      setGroups(groupData)
      setCommittees(committeeData)
      if (hasClass) {
        setMyClasses(allClasses.filter(c => (user.classIds || []).includes(c.id)))
      }
      setEvents(eventData.filter(ev => {
        if (ev.date && ev.date < today) return false
        const tg = ev.targetGroups || []
        return !tg.length || tg.includes('all') || tg.includes(user.role)
      }))
      if (isFamily) {
        const myClassIds = [...new Set(children.map(c => c.classId).filter(Boolean))]
        const myForms = allForms.filter(f =>
          f.status === 'published' && (
            f.targetRole === user.role || f.targetRole === 'all' ||
            (f.targetRole === 'class' && (f.classIds || []).some(id => myClassIds.includes(id)))
          )
        )
        setPendingForms(myForms.filter(f => !allSubs.find(s => s.formId === f.id)).length)
      }
    }).catch(err => console.error('Dashboard load failed:', err))
      .finally(() => setLoading(false))
  }, [user])

  const handleWidgetChange = useCallback((cfg) => {
    setWidgetConfig(cfg)
    saveWidgetConfig(cfg)
  }, [])

  const urgentTasks = tasks.filter(t => t.status !== 'done' && t.priority === 'high').slice(0, 3)

  const handleStatusChange = async (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const updated = { ...task, status: newStatus }
    setTasks(prev => prev.map(t => t.id === taskId ? updated : t))
    try { await saveTask(updated) } catch {
      setTasks(prev => prev.map(t => t.id === taskId ? task : t))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-primary-400" />
      </div>
    )
  }

  const renderWidget = (id) => {
    switch (id) {
      case 'class':
        if (!hasClass || myClasses.length === 0) return null
        return (
          <section key="class" className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <Link to="/class" className="text-xs text-primary-600 flex items-center gap-1 hover:underline">
                לכיתה <ArrowLeft size={12} />
              </Link>
              <div className="section-title flex items-center gap-2">
                <span className="text-xl leading-none">🎓</span>
              הכיתה שלי
              </div>
            </div>
            <div className="card divide-y divide-gray-50 dark:divide-gray-700">
              {myClasses.map(cls => (
                <div key={cls.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 dark:bg-primary-900/30">
                    <GraduationCap size={16} className="text-primary-600" />
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{cls.name}</div>
                    {cls.teacherName && <div className="text-xs text-gray-400 mt-0.5">מורה: {cls.teacherName}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Link to="/class" className="text-xs text-primary-600 hover:underline flex items-center gap-0.5">
                      <Users size={12} /> ספריה
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )

      case 'events':
        return (
          <section key="events" className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <Link to="/events" className="text-xs text-primary-600 flex items-center gap-1 hover:underline">
                הכל <ArrowLeft size={12} />
              </Link>
              <div className="section-title flex items-center gap-2">
                <span className="text-xl leading-none">📅</span>
              אירועים קרובים
              </div>
            </div>
            {events.length === 0 ? (
              <div className="card p-6 text-center text-gray-400">
                <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">אין אירועים קרובים כרגע</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {events.slice(0, 3).map(event => (
                  <EventCard key={event.id} event={event} onCardClick={() => setSelectedEvent(event)} />
                ))}
              </div>
            )}
          </section>
        )

      case 'activity':
        return (
          <section key="activity" className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="section-title flex items-center gap-2">
                <span className="text-xl leading-none">🤝</span>
              פעילות קהילה
              </div>
            </div>
            <ActivityFeed events={events} groups={groups} committees={committees} user={user} />
          </section>
        )

      case 'tasks':
        if (!isFamily || urgentTasks.length === 0) return null
        return (
          <section key="tasks" className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <Link to="/tasks" className="text-xs text-primary-600 flex items-center gap-1 hover:underline">
                הכל <ArrowLeft size={12} />
              </Link>
              <div className="section-title flex items-center gap-2">
                <span className="text-xl leading-none">✅</span>
              משימות לביצוע
              </div>
            </div>
            <div className="space-y-2">
              {urgentTasks.map(task => (
                <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} />
              ))}
            </div>
          </section>
        )

      case 'forms':
        if (!isFamily || pendingForms === 0) return null
        return (
          <Link key="forms" to="/forms"
            className="card p-4 flex items-center gap-3 mb-6 bg-amber-50 border border-amber-200 hover:shadow-card-hover transition-[box-shadow] duration-200">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <ClipboardList size={18} className="text-amber-600" />
            </div>
            <div className="flex-1 text-right">
              <div className="font-semibold text-amber-900 text-sm">
                יש לך {pendingForms} טופס{pendingForms > 1 ? 'ים' : ''} למילוי
              </div>
              <div className="text-xs text-amber-700 mt-0.5">לחצו כדי למלא את הפרטים הנדרשים</div>
            </div>
            <ArrowLeft size={16} className="text-amber-400 flex-shrink-0" />
          </Link>
        )

      case 'ai':
        return (
          <Link key="ai" to="/chat"
            className="card p-4 flex items-center gap-4 mb-6 hover:shadow-card-hover transition-[box-shadow] duration-200 bg-gradient-to-l from-primary-50 to-secondary-50 dark:from-primary-900/40 dark:to-secondary-900/40 border border-primary-100 dark:border-primary-800">
            <div className="p-3 bg-primary-600 rounded-2xl text-white flex-shrink-0">
              <MessageCircle size={22} />
            </div>
            <div className="flex-1 text-right">
              <div className="font-semibold text-gray-800 text-sm dark:text-gray-100">יש לך שאלה?</div>
              <div className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">העוזר החכם שלנו זמין 24/7</div>
            </div>
            <ArrowLeft size={16} className="text-primary-400" />
          </Link>
        )

      default:
        return null
    }
  }

  const visibleWidgets = widgetConfig.filter(w => w.visible)

  return (
    <div className="page-container rtl" dir="rtl">
      {/* Emergency banner */}
      {emergency && (
        <Link to="/emergency"
          className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 mb-5 hover:shadow-card-hover transition-[box-shadow] duration-200 dark:bg-red-900/20">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 dark:bg-red-900/30">
            <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 text-right">
            <div className="font-bold text-red-800 text-sm">{emergency.title || 'שגרת חירום פעילה'}</div>
            {emergency.message && <div className="text-xs text-red-600 mt-0.5 line-clamp-1 dark:text-red-400">{emergency.message}</div>}
            <div className="text-xs text-red-500 mt-0.5">לחצו לצפייה בלוח השיעורים</div>
          </div>
          <ArrowLeft size={16} className="text-red-400 flex-shrink-0" />
        </Link>
      )}

      {/* Greeting */}
      <div className="bg-gradient-to-l from-primary-600 to-secondary-500 rounded-3xl p-5 sm:p-6 mb-6 text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-40 h-40 rounded-full bg-white/5 -translate-x-10 -translate-y-10" />
        <div className="relative flex items-start justify-between">
          <div className="flex-1">
            <p className="text-primary-100 text-sm font-medium">{timeGreeting()}</p>
            <h1 className="text-2xl font-black mt-0.5">{user?.name}</h1>
            <p className="text-primary-100 text-sm mt-1">ברוכים הבאים לקהילת שחף!</p>
            <div className="mt-3 flex items-center gap-4">
              <div className="text-center">
                <div className="text-xl font-black">{events.length}</div>
                <div className="text-xs text-primary-200">אירועים</div>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <div className="text-xl font-black">{groups.filter(g => (g.memberUids || []).includes(user?.uid)).length}</div>
                <div className="text-xs text-primary-200">קבוצות</div>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <div className="text-xl font-black">{committees.filter(c => (c.memberUids || []).includes(user?.uid)).length}</div>
                <div className="text-xs text-primary-200">ועדות</div>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowCustomize(true)}
            className="flex-shrink-0 p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
            title="התאם לוח בית"
          >
            <Settings2 size={18} />
          </button>
        </div>
      </div>

      {/* Widgets in user-defined order */}
      {visibleWidgets.map(w => renderWidget(w.id))}

      {selectedEvent && (
        <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

      {showCustomize && (
        <CustomizePanel
          config={widgetConfig}
          onChange={handleWidgetChange}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </div>
  )
}
