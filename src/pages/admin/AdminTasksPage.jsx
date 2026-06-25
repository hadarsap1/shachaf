import { useState, useEffect } from 'react'
import { getTasks, saveTask, deleteTask, getClasses, MILESTONES } from '../../lib/db'
import { CheckSquare, Plus, Edit2, Trash2, X, Check, Loader2, Users } from 'lucide-react'
import clsx from 'clsx'

const FAMILY_CHIPS = [
  { value: 'all',         label: 'הכל' },
  { value: 'new_family',  label: 'משפחות חדשות' },
  { value: 'host_family', label: 'משפחות מארחות' },
]

const STATUS_OPTIONS = [
  { value: 'pending',     label: 'ממתין' },
  { value: 'in_progress', label: 'בתהליך' },
  { value: 'done',        label: 'הושלם' },
]

const PRIORITY_OPTIONS = [
  { value: 'high',   label: 'גבוה' },
  { value: 'medium', label: 'בינוני' },
  { value: 'low',    label: 'נמוך' },
]

const AUDIENCE_OPTIONS = [
  { value: 'all',         label: 'כולם' },
  { value: 'new_family',  label: 'משפחות חדשות' },
  { value: 'host_family', label: 'משפחות מארחות' },
  { value: 'class',       label: 'כיתה ספציפית' },
]

const AUDIENCE_LABEL = {
  all:         'כולם',
  new_family:  'משפחות חדשות',
  host_family: 'משפחות מארחות',
  class:       'כיתה',
}

const STATUS_COLOR = {
  pending:     'bg-gray-100 text-gray-600',
  in_progress: 'bg-primary-50 text-primary-700',
  done:        'bg-green-50 text-green-700',
}

const blankTask = () => ({
  id: 'task-' + Date.now(),
  title: '',
  description: '',
  milestone: MILESTONES[0]?.title || '',
  status: 'pending',
  priority: 'medium',
  dueDate: '',
  targetGroups: ['all'],
  classIds: [],
  completedAt: null,
  resourceUrl: '',
  whatsappPhone: '',
})

// ---- Task slide panel (add / edit) ----

function TaskPanel({ task, isNew, onSave, onClose, classes }) {
  const [draft, setDraft] = useState({ ...task })
  const [errors, setErrors] = useState({})

  const set = (field, value) => {
    setDraft(d => ({ ...d, [field]: value }))
    setErrors(e => ({ ...e, [field]: '' }))
  }

  const currentAudience = draft.targetGroups?.[0] || 'all'
  const setAudience = (val) => {
    set('targetGroups', [val])
    if (val !== 'class') set('classIds', [])
  }
  const toggleClassId = (id) => {
    const next = (draft.classIds || []).includes(id)
      ? (draft.classIds || []).filter(c => c !== id)
      : [...(draft.classIds || []), id]
    set('classIds', next)
  }

  const validate = () => {
    const e = {}
    if (!draft.title.trim()) e.title = 'שדה חובה'
    return e
  }

  const handleSave = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    onSave({ ...draft, title: draft.title.trim() })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right dark:bg-gray-800" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100">{isNew ? 'משימה חדשה' : 'עריכת משימה'}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <label className="label block mb-1 text-right">כותרת <span className="text-red-400">*</span></label>
            <input value={draft.title} onChange={e => set('title', e.target.value)}
              className={clsx('input w-full text-right', errors.title && 'border-red-300')}
              placeholder="שם המשימה" />
            {errors.title && <p className="text-xs text-red-500 mt-1 text-right">{errors.title}</p>}
          </div>

          <div>
            <label className="label block mb-1 text-right">תיאור</label>
            <textarea value={draft.description} onChange={e => set('description', e.target.value)}
              className="input w-full text-right resize-none" rows={3}
              placeholder="פרטים נוספים..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1 text-right text-xs">סטטוס</label>
              <select value={draft.status} onChange={e => set('status', e.target.value)}
                className="input w-full text-right text-sm py-2">
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label block mb-1 text-right text-xs">עדיפות</label>
              <select value={draft.priority} onChange={e => set('priority', e.target.value)}
                className="input w-full text-right text-sm py-2">
                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label block mb-1 text-right">שלב</label>
            <select value={draft.milestone} onChange={e => set('milestone', e.target.value)}
              className="input w-full text-right">
              {MILESTONES.map(m => <option key={m.id} value={m.title}>{m.icon} {m.title}</option>)}
              <option value="">ללא שלב</option>
            </select>
          </div>

          <div>
            <label className="label block mb-1 text-right">קהל יעד</label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setAudience(opt.value)}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                    currentAudience === opt.value
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  )}>
                  {opt.label}
                </button>
              ))}
            </div>
            {currentAudience === 'class' && (
              <div className="mt-2 bg-gray-50 rounded-xl px-4 py-3 space-y-2 max-h-40 overflow-y-auto dark:bg-gray-900">
                {classes.length === 0 && <p className="text-sm text-gray-400 text-center py-1">אין כיתות במערכת</p>}
                {classes.map(cls => (
                  <label key={cls.id} className="flex items-center justify-end gap-2 cursor-pointer">
                    <span className="text-sm text-gray-700 flex items-center gap-1.5 dark:text-gray-200">
                      {cls.name}
                      <span className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                        style={{ backgroundColor: cls.color || '#1B3B70' }} />
                    </span>
                    <input type="checkbox"
                      checked={(draft.classIds || []).includes(cls.id)}
                      onChange={() => toggleClassId(cls.id)}
                      className="w-4 h-4 accent-primary-600 flex-shrink-0" />
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label block mb-1 text-right">תאריך יעד</label>
            <input type="date" value={draft.dueDate || ''} onChange={e => set('dueDate', e.target.value)}
              className="input w-full" dir="ltr" />
          </div>

          <div>
            <label className="label block mb-1 text-right">קישור למשאב</label>
            <input type="url" value={draft.resourceUrl || ''} onChange={e => set('resourceUrl', e.target.value)}
              className="input w-full" dir="ltr" placeholder="https://..." />
          </div>

          <div>
            <label className="label block mb-1 text-right">מספר WhatsApp</label>
            <input type="tel" value={draft.whatsappPhone || ''} onChange={e => set('whatsappPhone', e.target.value)}
              className="input w-full" dir="ltr" placeholder="0501234567" />
          </div>
        </div>

        <div className="px-4 py-4 border-t border-gray-100 flex gap-2 dark:border-gray-700">
          <button onClick={handleSave} className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2">
            <Check size={15} />
            שמור
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm dark:border-gray-700">
            ביטול
          </button>
        </div>
      </div>
    </>
  )
}

// ---- Main page ----

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [familyFilter, setFamilyFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([getTasks(), getClasses()])
      .then(([t, c]) => {
        setTasks(t)
        setClasses(c)
        setLoading(false)
      })
      .catch(err => { console.error(err); setLoading(false) })
  }, [])

  const filtered = tasks.filter(t => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    const tg = t.targetGroups || ['all']
    const matchFamily = familyFilter === 'all' || tg.includes(familyFilter)
    return matchStatus && matchFamily
  })

  const handleSave = async (saved) => {
    const prev = [...tasks]
    // Optimistic update
    setTasks(cur => {
      const idx = cur.findIndex(t => t.id === saved.id)
      return idx >= 0 ? cur.map(t => t.id === saved.id ? saved : t) : [...cur, saved]
    })
    setEditing(null)
    try {
      const persisted = await saveTask(saved)
      // If it was a new task, replace temp id with real Firestore id
      if (persisted.id !== saved.id) {
        setTasks(cur => cur.map(t => t.id === saved.id ? persisted : t))
      }
    } catch (err) {
      console.error('saveTask failed', err)
      setTasks(prev)
    }
  }

  const handleDelete = async (id) => {
    const prev = [...tasks]
    setTasks(cur => cur.filter(t => t.id !== id))
    setConfirmDelete(null)
    try {
      await deleteTask(id)
    } catch (err) {
      console.error('deleteTask failed', err)
      setTasks(prev)
    }
  }

  const toggleStatus = async (taskId) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const nextStatus = { pending: 'in_progress', in_progress: 'done', done: 'pending' }
    const updated = { ...task, status: nextStatus[task.status] || task.status }
    setTasks(prev => prev.map(t => t.id === taskId ? updated : t))
    try {
      await saveTask(updated)
    } catch (err) {
      console.error('toggleStatus save failed', err)
      setTasks(prev => prev.map(t => t.id === taskId ? task : t))
    }
  }

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setEditing(blankTask())}
          className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
        >
          <Plus size={16} />
          משימה חדשה
        </button>
        <div>
          <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 justify-end">
            <span className="text-xl leading-none">✅</span>
            ניהול משימות
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 text-right dark:text-gray-400">{tasks.length} משימות</p>
        </div>
      </div>

      {/* Family filter */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
        {FAMILY_CHIPS.map(c => (
          <button key={c.value} onClick={() => setFamilyFilter(c.value)}
            className={clsx(
              'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              familyFilter === c.value
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'
            )}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
        {['all', 'pending', 'in_progress', 'done'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={clsx(
              'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              statusFilter === s
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'
            )}>
            {s === 'all' ? 'הכל' : STATUS_OPTIONS.find(o => o.value === s)?.label}
            <span className="mr-1 text-xs opacity-60">
              ({s === 'all' ? tasks.length : tasks.filter(t => t.status === s).length})
            </span>
          </button>
        ))}
      </div>

      {/* Loading spinner */}
      {loading && (
        <div className="flex justify-center items-center py-16">
          <Loader2 size={32} className="animate-spin text-primary-400" />
        </div>
      )}

      {/* Tasks list */}
      {!loading && (
        <div className="space-y-2">
          {filtered.map(task => (
            <div key={task.id}
              className="card p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => { setEditing(task); setConfirmDelete(null) }}>
              <div className="flex items-start gap-3">
                {/* Status toggle */}
                <button
                  onClick={e => { e.stopPropagation(); toggleStatus(task.id) }}
                  className={clsx(
                    'mt-1 w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all',
                    task.status === 'done'
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300 hover:border-primary-400'
                  )}
                />

                {/* Content */}
                <div className="flex-1 text-right min-w-0">
                  <div className="flex items-center gap-2 justify-end flex-wrap">
                    <span className={clsx('font-semibold text-sm', task.status === 'done' && 'line-through text-gray-400')}>
                      {task.title}
                    </span>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLOR[task.status])}>
                      {STATUS_OPTIONS.find(o => o.value === task.status)?.label}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 dark:text-gray-400">{task.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 justify-end flex-wrap">
                    <span className="flex items-center gap-1">
                      <Users size={11} />
                      {AUDIENCE_LABEL[(task.targetGroups || ['all'])[0]] || 'כולם'}
                    </span>
                    {task.dueDate && <span>{new Date(task.dueDate).toLocaleDateString('he-IL')}</span>}
                    {task.milestone && <span className="text-primary-400">{task.milestone}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => { setEditing(task); setConfirmDelete(null) }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    title="ערוך"
                  >
                    <Edit2 size={14} />
                  </button>

                  {confirmDelete === task.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg transition-colors"
                      >
                        מחק
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-1.5 py-1 rounded-lg hover:bg-gray-100 dark:text-gray-400"
                      >
                        ביטול
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(task.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="מחק"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <CheckSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">אין משימות להצגה</p>
          <button onClick={() => setEditing(blankTask())} className="mt-3 text-sm text-primary-600 hover:underline">
            הוסף משימה ראשונה
          </button>
        </div>
      )}

      {editing && (
        <TaskPanel
          task={editing}
          isNew={editing.id.startsWith('task-')}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          classes={classes}
        />
      )}
    </div>
  )
}
