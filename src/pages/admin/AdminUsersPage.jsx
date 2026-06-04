import { useState, useEffect } from 'react'
import { MOCK_USERS, MOCK_TASKS, MOCK_NEW_FAMILIES, MOCK_HOST_FAMILIES } from '../../lib/mockData'
import { getForms, getSubmissions } from '../../lib/formsStorage'
import { Users, UserPlus, MessageCircle, Search, ClipboardList, X, CheckCircle2, Circle } from 'lucide-react'
import clsx from 'clsx'

const ROLE_LABELS = {
  new_family:  { label: 'משפחה חדשה',  badge: 'badge-primary' },
  host_family: { label: 'משפחה מארחת', badge: 'badge-secondary' },
  admin:       { label: 'מנהל',         badge: 'bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full text-xs font-medium' },
  super_admin: { label: 'מנהל ראשי',    badge: 'bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-xs font-medium' },
}

const buildAllUsers = () => {
  const base = Object.values(MOCK_USERS)
  const baseIds = new Set(base.map(u => u.id))
  const extras = [
    ...MOCK_NEW_FAMILIES.filter(f => !baseIds.has(f.id)),
    ...MOCK_HOST_FAMILIES.filter(f => !baseIds.has(f.id)),
  ]
  return [...base, ...extras]
}

// ---- Family detail panel ----

function FamilyDetailPanel({ user, onClose }) {
  const [forms, setForms] = useState([])
  const [subs, setSubs] = useState([])
  const userTasks = MOCK_TASKS.filter(t => t.assignedTo === user.id)
  const done = userTasks.filter(t => t.status === 'done').length

  useEffect(() => {
    const allForms = getForms().filter(f =>
      f.status === 'published' && (f.targetRole === user.role || f.targetRole === 'all')
    )
    setForms(allForms)
    setSubs(getSubmissions().filter(s => s.userId === user.id))
  }, [user])

  const getSub = (formId) => subs.find(s => s.formId === formId)

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <h2 className="font-bold text-gray-800">{user.name}</h2>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <div className="avatar w-10 h-10 bg-primary-100 text-primary-700">{user.avatar}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-primary-50 rounded-xl p-3 text-right">
              <div className="text-xl font-black text-primary-700">{done}/{userTasks.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">משימות הושלמו</div>
            </div>
            <div className="bg-secondary-50 rounded-xl p-3 text-right">
              <div className="text-xl font-black text-secondary-700">{subs.length}/{forms.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">טפסים הוגשו</div>
            </div>
          </div>

          {/* Forms section */}
          {forms.length > 0 && (
            <section>
              <h3 className="font-bold text-gray-700 text-sm mb-2 flex items-center gap-1.5 justify-end">
                <ClipboardList size={14} className="text-primary-600" />
                טפסים
              </h3>
              <div className="space-y-3">
                {forms.map(form => {
                  const sub = getSub(form.id)
                  return (
                    <div key={form.id} className="bg-gray-50 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <span className={clsx(
                          'text-xs font-medium',
                          sub ? 'text-green-600' : 'text-amber-600'
                        )}>
                          {sub ? '✓ הוגש' : 'ממתין'}
                        </span>
                        <span className="font-medium text-gray-800 text-sm">{form.title}</span>
                      </div>
                      {sub && (
                        <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-1.5">
                          {form.fields.map(field => (
                            sub.data[field.id] ? (
                              <div key={field.id} className="flex items-start gap-2 justify-end">
                                <span className="text-sm text-gray-700">{sub.data[field.id]}</span>
                                <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{field.label}:</span>
                              </div>
                            ) : null
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Tasks section */}
          {userTasks.length > 0 && (
            <section>
              <h3 className="font-bold text-gray-700 text-sm mb-2 text-right">משימות</h3>
              <div className="space-y-1.5">
                {userTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 justify-end">
                    {task.status === 'done'
                      ? <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                      : <Circle size={14} className="text-gray-300 flex-shrink-0" />
                    }
                    <span className={clsx('text-sm', task.status === 'done' && 'text-gray-400 line-through')}>
                      {task.title}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}

// ---- Main page ----

export default function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [allForms, setAllForms] = useState([])
  const [allSubs, setAllSubs] = useState([])

  const ALL_USERS = buildAllUsers()

  useEffect(() => {
    setAllForms(getForms())
    setAllSubs(getSubmissions())
  }, [])

  const pendingCount = (user) => {
    const forms = allForms.filter(f =>
      f.status === 'published' && (f.targetRole === user.role || f.targetRole === 'all')
    )
    return forms.filter(f => !allSubs.find(s => s.userId === user.id && s.formId === f.id)).length
  }

  const filtered = ALL_USERS.filter(u => {
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    const matchSearch = !search ||
      u.name?.includes(search) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    return matchRole && matchSearch
  })

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <button className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <UserPlus size={16} />
          הוסף משפחה
        </button>
        <div>
          <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 justify-end">
            <Users size={22} />
            ניהול משתמשים
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 text-right">{ALL_USERS.length} משתמשים</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש..."
            className="input w-full pr-9 text-right py-2 text-sm"
          />
        </div>
        {['all', 'new_family', 'host_family', 'admin'].map(r => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-all flex-shrink-0',
              roleFilter === r
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'
            )}
          >
            {r === 'all' ? 'הכל' : ROLE_LABELS[r]?.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(user => {
          const userTasks = MOCK_TASKS.filter(t => t.assignedTo === user.id)
          const done = userTasks.filter(t => t.status === 'done').length
          const progress = userTasks.length ? Math.round((done / userTasks.length) * 100) : null
          const phone = user.phone?.replace(/\D/g, '') || ''
          const meta = ROLE_LABELS[user.role] || ROLE_LABELS.new_family
          const pending = pendingCount(user)

          return (
            <div
              key={user.id}
              className="card p-4 flex items-center gap-3 cursor-pointer hover:shadow-card-hover transition-all"
              onClick={() => setSelected(user)}
            >
              <div className="avatar w-10 h-10 text-sm bg-primary-100 text-primary-700 flex-shrink-0">
                {user.avatar || user.name?.[0]}
              </div>
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center gap-2 justify-end flex-wrap">
                  <span className="font-semibold text-gray-800 text-sm">{user.name}</span>
                  <span className={meta.badge}>{meta.label}</span>
                  {pending > 0 && (
                    <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                      <ClipboardList size={10} />
                      {pending}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{user.email}</div>
                {progress !== null && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-gray-400">{done}/{userTasks.length}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-20">
                      <div className="h-full bg-primary-400 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
              </div>
              {phone && (
                <a
                  href={`https://wa.me/${phone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="p-2 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors flex-shrink-0"
                >
                  <MessageCircle size={15} />
                </a>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">לא נמצאו משתמשים</p>
        </div>
      )}

      {selected && (
        <FamilyDetailPanel
          user={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
