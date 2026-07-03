import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getUsers, getChildren, getClasses, getPendingFamilies, markUsersImported } from '../../lib/db'
import { computeHealthAnomalies } from '../../lib/health'
import { RefreshCw, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'

// severity: red = blocks the user / broken flow, amber = worth a look
const SEVERITY = {
  red:   { chip: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',       border: 'border-red-200 dark:border-red-800' },
  amber: { chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
}

function AnomalySection({ emoji, title, hint, severity, items, renderItem, linkTo, linkLabel, action }) {
  const [open, setOpen] = useState(false)
  const [acting, setActing] = useState(false)
  if (items.length === 0) return null
  const sev = SEVERITY[severity]

  const runAction = async () => {
    setActing(true)
    try { await action.run(items) } finally { setActing(false) }
  }

  return (
    <div className={clsx('card border overflow-hidden mb-3', sev.border)}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-right">
        <div className="flex items-center gap-2">
          <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', sev.chip)}>{items.length}</span>
          <ChevronDown size={15} className={clsx('text-gray-400 transition-transform', open && 'rotate-180')} />
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-right min-w-0">
            <div className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{title}</div>
            <div className="text-xs text-gray-400 truncate">{hint}</div>
          </div>
          <span className="text-xl leading-none flex-shrink-0">{emoji}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          <ul className="divide-y divide-gray-50 dark:divide-gray-700 max-h-72 overflow-y-auto">
            {items.map((item, i) => (
              <li key={item.id || item.uid || i} className="px-4 py-2.5 text-sm text-right">
                {renderItem(item)}
              </li>
            ))}
          </ul>
          {action && (
            <button
              onClick={runAction}
              disabled={acting}
              className="w-full px-4 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-60 transition-colors text-center border-t border-gray-100 dark:border-gray-700"
            >
              {acting ? 'מתקן…' : action.label}
            </button>
          )}
          {linkTo && (
            <Link to={linkTo} className="block px-4 py-2.5 text-xs text-primary-600 dark:text-primary-300 hover:underline text-right border-t border-gray-100 dark:border-gray-700">
              ← {linkLabel}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

const fmtDate = (ts) => {
  const d = ts?.toDate?.() || (ts ? new Date(ts) : null)
  return d && !isNaN(d) ? d.toLocaleDateString('he-IL') : ''
}

export default function SuperAdminHealthPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    const sources = [
      ['users', 'חברים', getUsers],
      ['children', 'ילדים', getChildren],
      ['classes', 'כיתות', getClasses],
      ['pending', 'משפחות בייבוא', getPendingFamilies],
    ]
    Promise.allSettled(sources.map(([, , fn]) => fn())).then(results => {
      const loaded = {}
      const failed = []
      results.forEach((r, i) => {
        const [key, label] = sources[i]
        if (r.status === 'fulfilled') loaded[key] = r.value
        else {
          console.error(`Health load failed (${key}):`, r.reason)
          failed.push(`${label} (${r.reason?.code || r.reason?.message || 'שגיאה'})`)
        }
      })
      setData(loaded)
      if (failed.length) setError(`שגיאה בטעינת: ${failed.join(', ')}`)
      setLoading(false)
    })
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-primary-400" />
      </div>
    )
  }

  const { users = [], children = [], classes = [], pending = [] } = data || {}

  const classNameById = Object.fromEntries(classes.map(c => [c.id, c.name]))
  const {
    importedNeverRegistered, awaitingApproval, onboardingIncomplete,
    parentsNoChildren, unlinkedChildren, childrenNoClass,
    classesNoAdmin, staleClassIds, missingImportedFlag, total,
  } = computeHealthAnomalies({ users, children, classes, pending })

  const userLine = (u, extra = '') => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-400 flex-shrink-0">{extra}</span>
      <div className="min-w-0 text-right">
        <span className="font-medium text-gray-800 dark:text-gray-100">{u.name || '—'}</span>
        <span className="text-xs text-gray-400 ms-2" dir="ltr">{u.email}</span>
      </div>
    </div>
  )

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <button onClick={load} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700" title="רענן" aria-label="רענן">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
        <div>
          <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 justify-end dark:text-primary-300">
            <span className="text-xl leading-none">🩺</span>
            בקרת תקינות
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 text-right dark:text-gray-400">
            {error ? 'בדיקת תקינות תהליכי רישום וקליטה' : total === 0 ? 'אין חריגות 🎉' : `${total} חריגות שדורשות בדיקה`}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-right dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {total === 0 && !error && (
        <div className="text-center py-16">
          <CheckCircle2 size={40} className="mx-auto text-green-500 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">הכל תקין — אין חריגות בתהליכי הרישום והקליטה</p>
        </div>
      )}

      <AnomalySection
        emoji="📥" severity="red"
        title="יובאו אך מעולם לא נרשמו"
        hint="משפחות שהועלו בייבוא ועדיין לא יצרו חשבון"
        items={importedNeverRegistered}
        renderItem={(p) => (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-400">{fmtDate(p.importedAt)}</span>
            <div className="text-right">
              <span className="font-medium text-gray-800 dark:text-gray-100">{p.name || '—'}</span>
              <span className="text-xs text-gray-400 ms-2" dir="ltr">{p.email}</span>
            </div>
          </div>
        )}
        linkTo="/admin/import" linkLabel="לניהול ייבוא"
      />

      <AnomalySection
        emoji="⏳" severity="red"
        title="ממתינים לאישור"
        hint="נרשמו אך חשבונם עדיין לא אושר — חסומים מהאפליקציה"
        items={awaitingApproval}
        renderItem={(u) => userLine(u)}
        linkTo="/admin/users" linkLabel="לניהול חברים"
      />

      <AnomalySection
        emoji="🚪" severity="amber"
        title="לא השלימו את תהליך הקליטה"
        hint="נרשמו אך לא סיימו את שלבי ההצטרפות"
        items={onboardingIncomplete}
        renderItem={(u) => userLine(u)}
        linkTo="/admin/users" linkLabel="לניהול חברים"
      />

      <AnomalySection
        emoji="👨‍👩‍👧" severity="amber"
        title="הורים ללא ילדים מקושרים"
        hint="משפחות רשומות שאין להן אף ילד משויך"
        items={parentsNoChildren}
        renderItem={(u) => userLine(u)}
        linkTo="/admin/children" linkLabel="לניהול ילדים"
      />

      <AnomalySection
        emoji="🧒" severity="amber"
        title="ילדים ללא הורה מקושר"
        hint="ילדים שיובאו וטרם נתבעו על ידי משפחה"
        items={unlinkedChildren}
        renderItem={(c) => (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-400">{classNameById[c.classId] || 'ללא כיתה'}</span>
            <span className="font-medium text-gray-800 dark:text-gray-100">{c.name || '—'}</span>
          </div>
        )}
        linkTo="/admin/children" linkLabel="לניהול ילדים"
      />

      <AnomalySection
        emoji="🎓" severity="amber"
        title="ילדים ללא כיתה"
        hint="ילדים שאינם משויכים לאף כיתה"
        items={childrenNoClass}
        renderItem={(c) => <span className="font-medium text-gray-800 dark:text-gray-100">{c.name || '—'}</span>}
        linkTo="/admin/children" linkLabel="לניהול ילדים"
      />

      <AnomalySection
        emoji="🛡️" severity="red"
        title="כיתות ללא מנהל כיתה"
        hint="אין מי שיאשר הורים חדשים בכיתות אלו"
        items={classesNoAdmin}
        renderItem={(c) => <span className="font-medium text-gray-800 dark:text-gray-100">{c.name || '—'}</span>}
        linkTo="/admin/classes" linkLabel="לניהול כיתות"
      />

      <AnomalySection
        emoji="🔗" severity="amber"
        title="שיוך כיתות לא תואם"
        hint="משתמשים עם כיתות בפרופיל שלא נגזרות מהילדים שלהם"
        items={staleClassIds}
        renderItem={(u) => userLine(u, (u.classIds || []).map(id => classNameById[id] || id).join(', '))}
        linkTo="/admin/users" linkLabel="לניהול חברים"
      />

      <AnomalySection
        emoji="🚫" severity="amber"
        title="לא יכולים לקשר ילדים בקליטה"
        hint="משפחות חדשות ללא סימון ייבוא — לא יראו את רשימת הילדים בקליטה"
        items={missingImportedFlag}
        renderItem={(u) => userLine(u)}
        linkTo="/admin/users" linkLabel="לניהול חברים"
        action={{
          label: 'סמן את כולם כמיובאים (יאפשר להם לקשר ילדים)',
          run: async (items) => { await markUsersImported(items.map(u => u.uid)); load() },
        }}
      />
    </div>
  )
}
