import { useState, useEffect, useMemo, useRef } from 'react'
import {
  getEmergencyMode, setEmergencyMode,
  getEmergencyDay, saveEmergencyDay,
  getClasses, getChildren,
} from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import {
  EMPTY_DAY, addDays, today, tomorrow, isDayEmpty, formatDayLabel,
} from '../../lib/emergency'
import {
  AlertTriangle, Plus, Save, Loader2, CheckCircle2, X,
  BookOpen, Users, Home, Copy,
} from 'lucide-react'
import clsx from 'clsx'

const TABS = [
  { id: 'slots',     label: 'שיעורים',       icon: BookOpen, addLabel: 'הוסף שיעור' },
  { id: 'groups',    label: 'קבוצות למידה',  icon: Users,    addLabel: 'הוסף קבוצה' },
  { id: 'playdates', label: 'מפגשי משחק',    icon: Home,     addLabel: 'הוסף מפגש' },
]

const BLANK = {
  slots:     () => ({ time: '', subject: '', zoomLink: '', notes: '' }),
  groups:    () => ({ name: '', time: '', place: '', link: '', guide: '', childIds: [] }),
  playdates: () => ({ time: '', host: '', address: '', notes: '', childIds: [] }),
}

// Chip list for assigning children of the class to a group / playdate.
function ChildPicker({ options, selected, onToggle }) {
  if (!options.length) {
    return <p className="text-xs text-gray-400 py-1">אין ילדים משויכים לכיתה זו</p>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(c => {
        const on = selected.includes(c.id)
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggle(c.id)}
            className={clsx(
              'px-2.5 py-1 rounded-full text-xs border transition-colors',
              on
                ? 'bg-primary-600 border-primary-600 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
            )}
          >
            {c.name}
          </button>
        )
      })}
    </div>
  )
}

function RowShell({ children, onRemove }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 relative dark:bg-gray-900">
      <button
        onClick={onRemove}
        className="absolute top-2 left-2 p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 dark:hover:bg-red-900/20"
      >
        <X size={14} />
      </button>
      {children}
    </div>
  )
}

export default function AdminEmergencyPage() {
  const { user } = useAuth()
  const [mode, setMode]         = useState({ active: false, title: '', message: '' })
  const [classes, setClasses]   = useState([])
  const [children, setChildren] = useState([])
  const [selClass, setSelClass] = useState('')
  const [selDate, setSelDate]   = useState(tomorrow())
  const [tab, setTab]           = useState('slots')
  const [day, setDay]           = useState(EMPTY_DAY)
  const [dirty, setDirty]       = useState(false)
  const [loadingMode, setLoadingMode]   = useState(true)
  const [loadingDay, setLoadingDay]     = useState(false)
  const [savingMode, setSavingMode]     = useState(false)
  const [savingDay, setSavingDay]       = useState(false)
  const [savedMode, setSavedMode]       = useState(false)
  const [savedDay, setSavedDay]         = useState(false)
  const [copyMsg, setCopyMsg]           = useState('')
  const [error, setError]               = useState('')

  // Guards the load effect against overwriting edits made while it was in flight.
  const loadToken = useRef(0)

  useEffect(() => {
    Promise.all([getEmergencyMode(), getClasses()]).then(([m, cls]) => {
      setMode({ active: m.active || false, title: m.title || '', message: m.message || '' })
      setClasses(cls)
      if (cls.length) setSelClass(cls[0].id)
      setLoadingMode(false)
    }).catch(() => {
      setError('טעינת ההגדרות נכשלה. רענן/י את הדף.')
      setLoadingMode(false)
    })
  }, [])

  useEffect(() => {
    if (!selClass) return
    getChildren(selClass).then(setChildren).catch(() => setChildren([]))
  }, [selClass])

  useEffect(() => {
    if (!selClass || !selDate) return
    const token = ++loadToken.current
    setLoadingDay(true)
    setError('')
    getEmergencyDay(selClass, selDate)
      .then(d => {
        if (token !== loadToken.current) return
        setDay(d)
        setDirty(false)
        setLoadingDay(false)
      })
      .catch(() => {
        if (token !== loadToken.current) return
        setError('טעינת היום נכשלה. נסה/י שוב.')
        setLoadingDay(false)
      })
  }, [selClass, selDate])

  // Switching class/date discards unsaved edits — make that explicit.
  const confirmDiscard = () =>
    !dirty || window.confirm('יש שינויים שלא נשמרו. לעבור בכל זאת ולאבד אותם?')

  const changeClass = v => { if (confirmDiscard()) setSelClass(v) }
  const changeDate  = v => { if (confirmDiscard()) setSelDate(v) }

  const handleSaveMode = async () => {
    setSavingMode(true)
    try {
      await setEmergencyMode(mode, user.uid)
      setSavedMode(true)
      setTimeout(() => setSavedMode(false), 2500)
    } catch {
      setError('שמירת ההגדרות נכשלה.')
    }
    setSavingMode(false)
  }

  const handleSaveDay = async () => {
    setSavingDay(true)
    try {
      await saveEmergencyDay(selClass, selDate, day)
      setDirty(false)
      setSavedDay(true)
      setTimeout(() => setSavedDay(false), 2500)
    } catch {
      setError('השמירה נכשלה. הנתונים נשארו על המסך — נסה/י שוב.')
    }
    setSavingDay(false)
  }

  // Build tomorrow from today (or any day from the one before it) — the common
  // case is "same routine, small tweaks". Loaded unsaved so it can be edited.
  const copyPrevDay = async () => {
    const from = addDays(selDate, -1)
    setCopyMsg('')
    const prev = await getEmergencyDay(selClass, from)
    if (isDayEmpty(prev)) {
      setCopyMsg(`אין נתונים ל-${from}`)
      return
    }
    setDay(prev)
    setDirty(true)
    setCopyMsg(`הועתק מ-${from} — עדיין לא נשמר`)
  }

  const rows = day[tab] || []
  const setRows = updater =>
    setDay(d => { setDirty(true); return { ...d, [tab]: updater(d[tab] || []) } })

  const addRow    = () => setRows(r => [...r, BLANK[tab]()])
  const removeRow = i => setRows(r => r.filter((_, idx) => idx !== i))
  const updateRow = (i, field, val) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row))
  const toggleChild = (i, childId) => setRows(r => r.map((row, idx) => {
    if (idx !== i) return row
    const ids = row.childIds || []
    return { ...row, childIds: ids.includes(childId) ? ids.filter(x => x !== childId) : [...ids, childId] }
  }))

  const counts = useMemo(() => ({
    slots: day.slots?.length || 0,
    groups: day.groups?.length || 0,
    playdates: day.playdates?.length || 0,
  }), [day])

  if (loadingMode) return (
    <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary-400" /></div>
  )

  const selClassName = classes.find(c => c.id === selClass)?.name || ''
  const activeTab = TABS.find(t => t.id === tab)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" dir="rtl">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 dark:bg-red-900/30">
          <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2 dark:text-white"><span className="text-xl leading-none">🚨</span>מצב חירום</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">שיעורים, קבוצות למידה ומפגשי משחק — מוכן לרגע שצריך</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 text-right dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Mode toggle card */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5 mb-6 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setMode(m => ({ ...m, active: !m.active }))}
            className={clsx(
              'relative inline-flex h-7 w-14 rounded-full transition-colors duration-200 focus:outline-none',
              mode.active ? 'bg-red-500' : 'bg-gray-200'
            )}
          >
            <span className={clsx(
              'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200',
              mode.active ? 'translate-x-7' : 'translate-x-0'
            )} />
          </button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100">
            {mode.active ? '🔴 שגרת חירום פעילה' : '⚪ שגרת חירום כבויה'}
          </h2>
        </div>

        <p className="text-xs text-gray-400 mb-3 text-right">
          אפשר לבנות את השיעורים, הקבוצות והמפגשים גם כשהמצב כבוי — ההורים יראו אותם רק כשמדליקים.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 text-right dark:text-gray-400">כותרת (מוצגת להורים)</label>
            <input
              type="text"
              value={mode.title}
              onChange={e => setMode(m => ({ ...m, title: e.target.value }))}
              maxLength={100}
              placeholder="לדוגמה: שגרת חירום — ינואר 2026"
              className="input w-full text-right"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 text-right dark:text-gray-400">הודעה להורים</label>
            <textarea
              value={mode.message}
              onChange={e => setMode(m => ({ ...m, message: e.target.value }))}
              rows={3}
              maxLength={500}
              placeholder="הסבר קצר על שגרת החירום..."
              className="input w-full resize-none text-right text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleSaveMode}
          disabled={savingMode}
          className="mt-4 w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {savingMode ? <Loader2 size={16} className="animate-spin" /> : savedMode ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {savedMode ? 'נשמר!' : 'שמור הגדרות'}
        </button>
      </div>

      {/* Day planner: lessons / learning groups / playdates */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5 dark:bg-gray-800 dark:border-gray-700">
        <h2 className="font-bold text-gray-800 mb-4 text-right dark:text-gray-100">תכנון יום לפי כיתה</h2>

        <div className="flex gap-3 mb-3 flex-wrap">
          <select
            value={selClass}
            onChange={e => changeClass(e.target.value)}
            className="input flex-1 min-w-[140px] text-right"
          >
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            type="date"
            value={selDate}
            onChange={e => changeDate(e.target.value)}
            className="input flex-1 min-w-[140px]"
          />
        </div>

        {/* Quick jumps — "מחר" is the everyday action */}
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <button
            onClick={() => changeDate(tomorrow())}
            className={clsx('px-3 py-1 rounded-full text-xs border',
              selDate === tomorrow()
                ? 'bg-primary-600 border-primary-600 text-white'
                : 'border-gray-200 text-gray-600 hover:border-primary-400 dark:border-gray-600 dark:text-gray-300')}
          >
            מחר
          </button>
          <button
            onClick={() => changeDate(today())}
            className={clsx('px-3 py-1 rounded-full text-xs border',
              selDate === today()
                ? 'bg-primary-600 border-primary-600 text-white'
                : 'border-gray-200 text-gray-600 hover:border-primary-400 dark:border-gray-600 dark:text-gray-300')}
          >
            היום
          </button>
          <button
            onClick={copyPrevDay}
            className="px-3 py-1 rounded-full text-xs border border-dashed border-gray-300 text-gray-500 hover:border-primary-400 hover:text-primary-600 flex items-center gap-1 dark:border-gray-600 dark:text-gray-400"
          >
            <Copy size={12} />
            העתק מהיום הקודם
          </button>
          {copyMsg && <span className="text-xs text-gray-400">{copyMsg}</span>}
        </div>

        {selClassName && selDate && (
          <p className="text-xs text-gray-400 mb-3 text-right">
            {selClassName} · {formatDayLabel(selDate)}
            {dirty && <span className="text-amber-600 dark:text-amber-400"> · יש שינויים שלא נשמרו</span>}
          </p>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-gray-100 mb-4 dark:bg-gray-900">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors',
                  tab === t.id
                    ? 'bg-white text-primary-700 shadow-sm dark:bg-gray-800 dark:text-primary-300'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                )}
              >
                <Icon size={14} />
                {t.label}
                {counts[t.id] > 0 && <span className="text-[10px] text-gray-400">({counts[t.id]})</span>}
              </button>
            )
          })}
        </div>

        {loadingDay ? (
          <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-primary-400" /></div>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {rows.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-6">
                  אין {activeTab.label} ליום זה עדיין
                </p>
              )}

              {tab === 'slots' && rows.map((sl, i) => (
                <RowShell key={i} onRemove={() => removeRow(i)}>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      value={sl.time}
                      onChange={e => updateRow(i, 'time', e.target.value)}
                      placeholder="שעה (למשל 08:00-09:00)"
                      className="input text-sm text-right col-span-2"
                    />
                    <input
                      type="text"
                      value={sl.subject}
                      onChange={e => updateRow(i, 'subject', e.target.value)}
                      placeholder="מקצוע"
                      className="input text-sm text-right"
                    />
                    <input
                      type="text"
                      value={sl.zoomLink}
                      onChange={e => updateRow(i, 'zoomLink', e.target.value)}
                      placeholder="קישור זום (אופציונלי)"
                      className="input text-sm"
                      dir="ltr"
                    />
                  </div>
                  <input
                    type="text"
                    value={sl.notes}
                    onChange={e => updateRow(i, 'notes', e.target.value)}
                    placeholder="הערות (אופציונלי)"
                    className="input text-sm text-right w-full"
                  />
                </RowShell>
              ))}

              {tab === 'groups' && rows.map((g, i) => (
                <RowShell key={i} onRemove={() => removeRow(i)}>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      value={g.name}
                      onChange={e => updateRow(i, 'name', e.target.value)}
                      placeholder="שם הקבוצה (למשל: קבוצה 1 — קריאה)"
                      className="input text-sm text-right col-span-2"
                    />
                    <input
                      type="text"
                      value={g.time}
                      onChange={e => updateRow(i, 'time', e.target.value)}
                      placeholder="שעה"
                      className="input text-sm text-right"
                    />
                    <input
                      type="text"
                      value={g.guide}
                      onChange={e => updateRow(i, 'guide', e.target.value)}
                      placeholder="מנחה / הורה אחראי"
                      className="input text-sm text-right"
                    />
                    <input
                      type="text"
                      value={g.place}
                      onChange={e => updateRow(i, 'place', e.target.value)}
                      placeholder="מיקום (בית / ממ״ד / זום)"
                      className="input text-sm text-right"
                    />
                    <input
                      type="text"
                      value={g.link}
                      onChange={e => updateRow(i, 'link', e.target.value)}
                      placeholder="קישור (אופציונלי)"
                      className="input text-sm"
                      dir="ltr"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mb-1.5 text-right">
                    ילדים בקבוצה {g.childIds?.length ? `(${g.childIds.length})` : '— ריק = כל הכיתה'}
                  </p>
                  <ChildPicker
                    options={children}
                    selected={g.childIds || []}
                    onToggle={id => toggleChild(i, id)}
                  />
                </RowShell>
              ))}

              {tab === 'playdates' && rows.map((p, i) => (
                <RowShell key={i} onRemove={() => removeRow(i)}>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      value={p.host}
                      onChange={e => updateRow(i, 'host', e.target.value)}
                      placeholder="משפחה מארחת"
                      className="input text-sm text-right"
                    />
                    <input
                      type="text"
                      value={p.time}
                      onChange={e => updateRow(i, 'time', e.target.value)}
                      placeholder="שעה (למשל 16:00-18:00)"
                      className="input text-sm text-right"
                    />
                    <input
                      type="text"
                      value={p.address}
                      onChange={e => updateRow(i, 'address', e.target.value)}
                      placeholder="כתובת / מקום מפגש"
                      className="input text-sm text-right col-span-2"
                    />
                  </div>
                  <input
                    type="text"
                    value={p.notes}
                    onChange={e => updateRow(i, 'notes', e.target.value)}
                    placeholder="הערות (מה להביא, מרחב מוגן קרוב...)"
                    className="input text-sm text-right w-full mb-2"
                  />
                  <p className="text-[11px] text-gray-400 mb-1.5 text-right">
                    ילדים במפגש {p.childIds?.length ? `(${p.childIds.length})` : '— ריק = כל הכיתה'}
                  </p>
                  <ChildPicker
                    options={children}
                    selected={p.childIds || []}
                    onToggle={id => toggleChild(i, id)}
                  />
                </RowShell>
              ))}
            </div>

            <button
              onClick={addRow}
              className="w-full py-2 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 flex items-center justify-center gap-2 mb-3 dark:text-gray-400 dark:border-gray-600"
            >
              <Plus size={14} />
              {activeTab.addLabel}
            </button>

            <button
              onClick={handleSaveDay}
              disabled={savingDay || !selClass}
              className="w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {savingDay ? <Loader2 size={16} className="animate-spin" /> : savedDay ? <CheckCircle2 size={16} /> : <Save size={16} />}
              {savedDay ? 'נשמר!' : 'שמור את היום'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
