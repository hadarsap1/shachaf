import { useState, useEffect, useRef } from 'react'
import {
  getClasses, saveClass, deleteClass, getUsers,
  assignClassAdmin, removeClassAdmin,
  getChildren, saveChild, deleteChild, bulkImportChildren,
} from '../../lib/db'
import { CLASS_COLORS, blankCenterHours } from '../../lib/classColors'
import {
  GraduationCap, Plus, Edit2, Trash2, X, Check, Users,
  Loader2, Search, Upload, Baby, Cake,
} from 'lucide-react'
import clsx from 'clsx'

const GRADES = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב']

const SCHEDULE_DAYS  = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳']
const SCHEDULE_PERIODS = [
  { id: 'morning', label: 'מפגש בוקר' },
  { id: '1',       label: '1' },
  { id: '2',       label: '2' },
  { id: 'break1',  label: 'הפסקה', isBreak: true },
  { id: '3',       label: '3' },
  { id: '4',       label: '4' },
  { id: 'break2',  label: 'הפסקה', isBreak: true },
  { id: '5',       label: '5' },
  { id: '6',       label: '6' },
]

const blankClass = () => ({
  id: 'class-' + Date.now(),
  name: '',
  grade: 'א',
  year: 'תשפ״ה',
  color: CLASS_COLORS[0],
  teacherContact: { name: '', phone: '', email: '' },
  assistants: [],
  committee: [],
  centerHours: blankCenterHours(),
  schedule: {},
  adminUids: [],
})

const blankPerson = () => ({ name: '', phone: '', email: '', title: '' })

// ── Color picker ──────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {CLASS_COLORS.map(c => (
        <button key={c} type="button" onClick={() => onChange(c)}
          className={clsx('w-7 h-7 rounded-full border-2 transition-transform',
            value === c ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105')}
          style={{ backgroundColor: c }} />
      ))}
    </div>
  )
}

// ── People list editor ────────────────────────────────────────────────────────

function PeopleEditor({ people, onChange, showTitle = false, placeholder = 'שם' }) {
  const update = (i, field, val) =>
    onChange(people.map((p, idx) => idx === i ? { ...p, [field]: val } : p))
  const remove = (i) => onChange(people.filter((_, idx) => idx !== i))
  const add    = () => onChange([...people, blankPerson()])

  return (
    <div className="space-y-3">
      {people.map((p, i) => (
        <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2 dark:bg-gray-900">
          <div className="flex gap-2">
            <input value={p.name} onChange={e => update(i, 'name', e.target.value)}
              placeholder={placeholder} className="input flex-1 text-sm py-1.5" />
            {showTitle && (
              <input value={p.title || ''} onChange={e => update(i, 'title', e.target.value)}
                placeholder="תפקיד" className="input w-28 text-sm py-1.5" />
            )}
            <button onClick={() => remove(i)}
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
              <X size={14} />
            </button>
          </div>
          <div className="flex gap-2">
            <input value={p.phone || ''} onChange={e => update(i, 'phone', e.target.value)}
              placeholder="טלפון" className="input flex-1 text-sm py-1.5" dir="ltr" />
            <input value={p.email || ''} onChange={e => update(i, 'email', e.target.value)}
              placeholder="מייל" className="input flex-1 text-sm py-1.5" dir="ltr" />
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium">
        <Plus size={14} /> הוסף
      </button>
    </div>
  )
}

// ── Weekly schedule grid ──────────────────────────────────────────────────────

function ScheduleEditor({ schedule = {}, onChange }) {
  const set = (key, val) => onChange({ ...schedule, [key]: val })

  return (
    <div className="overflow-x-auto -mx-5 px-0">
      <table className="min-w-full text-xs border-collapse" style={{ direction: 'rtl' }}>
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="sticky right-0 z-10 bg-white w-16 px-2 py-2 text-gray-400 font-medium text-right border-l border-gray-100 dark:bg-gray-800 dark:border-gray-700">
              שיעור
            </th>
            {SCHEDULE_DAYS.map(d => (
              <th key={d} className="px-1 py-2 text-center text-gray-600 font-semibold min-w-[68px] dark:text-gray-300">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SCHEDULE_PERIODS.map(period => {
            if (period.isBreak) return (
              <tr key={period.id}>
                <td colSpan={SCHEDULE_DAYS.length + 1}
                  className="py-1 px-3 text-[10px] text-gray-400 text-center bg-gray-50 border-y border-gray-100 italic dark:bg-gray-900 dark:border-gray-700">
                  — {period.label} —
                </td>
              </tr>
            )
            return (
              <tr key={period.id} className="border-t border-gray-100 hover:bg-gray-50/50 dark:border-gray-700">
                <td className="sticky right-0 z-10 bg-white px-2 py-1.5 text-gray-500 font-semibold text-center border-l border-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                  {period.label}
                </td>
                {SCHEDULE_DAYS.map((_, di) => {
                  const key = `${di}-${period.id}`
                  return (
                    <td key={key} className="px-1 py-1">
                      <input
                        value={schedule[key] || ''}
                        onChange={e => set(key, e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-1.5 py-1.5 text-xs text-center focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 bg-white placeholder-gray-300 dark:bg-gray-800 dark:border-gray-700"
                        placeholder="—"
                        dir="rtl"
                      />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Children tab (inside ClassPanel) ─────────────────────────────────────────

function ClassChildrenTab({ classId, classColor }) {
  const fileRef  = useRef(null)
  const [children,  setChildren]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState(null)
  const [newName,   setNewName]   = useState('')
  const [error,     setError]     = useState('')
  const [importRows,  setImportRows]  = useState(null)
  const [importing, setImporting] = useState(false)
  const [editingBirth, setEditingBirth] = useState(null)

  useEffect(() => {
    if (!classId || classId.startsWith('class-')) { setLoading(false); return }
    getChildren(classId)
      .then(setChildren)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [classId])

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    setError('')
    try {
      const saved = await saveChild({ id: 'child-' + Date.now(), name, classId, parentUids: [] })
      setChildren(prev => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name, 'he')))
      setNewName('')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await deleteChild(id)
      setChildren(prev => prev.filter(c => c.id !== id))
    } catch (e) {
      setError(e.message)
    } finally {
      setDeleting(null)
    }
  }

  const handleBirthDate = async (child, birthDate) => {
    const updated = { ...child, birthDate }
    setChildren(prev => prev.map(c => c.id === child.id ? updated : c))
    try { await saveChild(updated) } catch (e) { setError(e.message) }
  }

  const parseImportFile = async (file) => {
    setError('')
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      let data
      if (ext === 'csv') {
        const { default: Papa } = await import('papaparse')
        const text = await file.text()
        data = Papa.parse(text, { header: true, skipEmptyLines: true }).data
      } else {
        const { default: readXlsxFile } = await import('read-excel-file/browser')
        const xlsxRows = await readXlsxFile(file)
        if (!xlsxRows.length) { setError('הקובץ ריק'); return }
        const headers = xlsxRows[0]
        data = xlsxRows.slice(1).map(row => {
          const obj = {}
          headers.forEach((h, i) => { obj[String(h ?? '')] = row[i] })
          return obj
        })
      }
      const nameFields = ['שם', 'שם מלא', 'name', 'full name']
      const rows = data.map(row => {
        const val = Object.entries(row).find(([k]) =>
          nameFields.includes(k.toString().trim().toLowerCase())
        )?.[1]
        return (val || '').toString().trim()
      }).filter(Boolean)
      if (!rows.length) { setError('לא נמצאה עמודת "שם" בקובץ'); return }
      setImportRows(rows)
    } catch (e) {
      setError('שגיאה בקריאת הקובץ')
    }
  }

  const handleImport = async () => {
    if (!importRows?.length) return
    setImporting(true)
    setError('')
    try {
      await bulkImportChildren(importRows.map(name => ({ name, classId })))
      const updated = await getChildren(classId)
      setChildren(updated)
      setImportRows(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setImporting(false)
    }
  }

  if (classId?.startsWith('class-')) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        <Baby size={32} className="mx-auto mb-2 opacity-30" />
        <p>שמור את הכיתה קודם כדי להוסיף ילדים</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}

      {/* Quick-add row */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="שם ילד/ה"
          className="input flex-1 text-sm"
        />
        <button onClick={handleAdd} disabled={saving || !newName.trim()}
          className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          הוסף
        </button>
      </div>

      {/* Import from file */}
      {!importRows ? (
        <>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={e => e.target.files?.[0] && parseImportFile(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-5 text-center hover:border-primary-300 hover:bg-primary-50/30 transition-colors dark:border-gray-700">
            <Upload size={20} className="mx-auto text-gray-300 mb-1.5" />
            <p className="text-sm font-medium text-gray-400">ייבוא מ-Excel / CSV</p>
            <p className="text-xs text-gray-300 mt-0.5">עמודת "שם" בלבד — הכיתה נקבעת אוטומטית</p>
          </button>
        </>
      ) : (
        <div className="bg-gray-50 rounded-2xl p-4 space-y-3 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <button onClick={() => setImportRows(null)} className="text-xs text-gray-400 hover:text-gray-600">
              ביטול
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{importRows.length} ילדים לייבוא</span>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {importRows.map((name, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-700 px-2 py-1 bg-white rounded-lg dark:bg-gray-800 dark:text-gray-200">
                <Check size={12} className="text-secondary-500 flex-shrink-0" />
                {name}
              </div>
            ))}
          </div>
          <button onClick={handleImport} disabled={importing}
            className="w-full btn-primary text-sm py-2.5 flex items-center justify-center gap-2">
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            ייבא {importRows.length} ילדים
          </button>
        </div>
      )}

      {/* Children list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-primary-400" />
        </div>
      ) : children.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          <Baby size={28} className="mx-auto mb-2 opacity-30" />
          <p>אין ילדים בכיתה עדיין</p>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-gray-400 text-right">{children.length} ילדים</p>
          {children.map(child => (
            <div key={child.id}
              className="bg-gray-50 rounded-xl px-3 py-2 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ backgroundColor: classColor || '#1B3B70' }}>
                  {child.name?.[0] || '?'}
                </div>
                <span className="flex-1 text-sm text-gray-800 dark:text-gray-100">{child.name}</span>
                {child.birthDate && (
                  <span className="text-[10px] text-gray-400">
                    {new Date(child.birthDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                <button
                  onClick={() => setEditingBirth(editingBirth === child.id ? null : child.id)}
                  className={clsx('p-1 rounded-lg transition-colors',
                    child.birthDate ? 'text-amber-400 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400'
                  )}
                  title="יום הולדת"
                >
                  <Cake size={13} />
                </button>
                {child.parentUids?.length > 0 && (
                  <span className="text-[10px] text-secondary-600">{child.parentUids.length} הורים</span>
                )}
                <button onClick={() => handleDelete(child.id)} disabled={deleting === child.id}
                  className="p-1 text-gray-300 hover:text-red-500 rounded-lg transition-colors">
                  {deleting === child.id
                    ? <Loader2 size={13} className="animate-spin" />
                    : <X size={13} />}
                </button>
              </div>
              {editingBirth === child.id && (
                <div className="mt-2 flex items-center gap-2 pe-1">
                  <label className="text-xs text-gray-500 flex-shrink-0 dark:text-gray-400">תאריך לידה:</label>
                  <input type="date"
                    value={child.birthDate || ''}
                    onChange={e => { handleBirthDate(child, e.target.value); setEditingBirth(null) }}
                    className="input flex-1 text-xs py-1"
                    dir="ltr" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Class admins tab ──────────────────────────────────────────────────────────

function ClassAdminsTab({ adminUids, allUsers, onAdd, onRemove, saving }) {
  const [search, setSearch] = useState('')
  const admins = allUsers.filter(u => adminUids.includes(u.uid))
  const q = search.toLowerCase()
  const suggestions = q.length > 1
    ? allUsers.filter(u =>
        !adminUids.includes(u.uid) &&
        (u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
      ).slice(0, 5)
    : []

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">מנהלי כיתה יכולים לנהל את רשימת הילדים, האירועים וההודעות של הכיתה שלהם.</p>

      <div className="relative">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש הורה לפי שם או מייל" className="input w-full text-sm pe-9" />
        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-card z-10 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
            {suggestions.map(u => (
              <button key={u.uid} onClick={() => { onAdd(u.uid); setSearch('') }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-right">
                <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {u.name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate dark:text-gray-100">{u.name}</div>
                  <div className="text-xs text-gray-400 truncate">{u.email}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {admins.length > 0 ? (
        <div className="space-y-2">
          {admins.map(u => (
            <div key={u.uid} className="flex items-center gap-3 bg-primary-50 rounded-xl px-3 py-2">
              <div className="w-7 h-7 rounded-full bg-primary-200 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {u.name?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate dark:text-gray-100">{u.name}</div>
                <div className="text-xs text-gray-400 truncate">{u.email}</div>
              </div>
              <button onClick={() => onRemove(u.uid)} disabled={saving}
                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-4">אין מנהלי כיתה עדיין</p>
      )}
    </div>
  )
}

// ── Edit panel ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'basic',     label: 'בסיסי' },
  { id: 'schedule',  label: 'מערכת שעות' },
  { id: 'children',  label: 'ילדים' },
  { id: 'staff',     label: 'צוות' },
  { id: 'committee', label: 'ועד כיתה' },
  { id: 'admins',    label: 'מנהלי כיתה' },
]

function ClassPanel({ cls, isNew, onSave, onClose, allUsers }) {
  const [draft, setDraft]   = useState({ ...cls })
  const [tab, setTab]       = useState('basic')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (field, value) => setDraft(d => ({ ...d, [field]: value }))
  const setTeacher = (field, value) =>
    setDraft(d => ({ ...d, teacherContact: { ...(d.teacherContact || {}), [field]: value } }))

  const validate = () => {
    if (!draft.name?.trim()) return 'שם כיתה הוא שדה חובה'
    return ''
  }

  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); setTab('basic'); return }
    setSaving(true)
    try {
      await onSave({ ...draft, name: draft.name.trim() })
    } catch (e) {
      setError(e.message || 'שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  const handleAddAdmin = async (uid) => {
    setSaving(true)
    try {
      await assignClassAdmin(draft.id, uid)
      setDraft(d => ({ ...d, adminUids: [...new Set([...(d.adminUids || []), uid])] }))
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveAdmin = async (uid) => {
    setSaving(true)
    try {
      await removeClassAdmin(draft.id, uid)
      setDraft(d => ({ ...d, adminUids: (d.adminUids || []).filter(u => u !== uid) }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right dark:bg-gray-800" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0 dark:border-gray-700">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 flex items-center gap-2 dark:text-gray-100">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: draft.color || CLASS_COLORS[0] }} />
            {isNew ? 'כיתה חדשה' : `כיתה ${draft.name}`}
          </h2>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 btn-primary text-sm py-1.5 px-3">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            שמור
          </button>
        </div>

        <div className="flex overflow-x-auto border-b border-gray-100 flex-shrink-0 scrollbar-hide dark:border-gray-700">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={clsx(
                'px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-all border-b-2 flex-shrink-0',
                tab === t.id
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}>
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-4 mt-3 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 flex-shrink-0">{error}</div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {tab === 'basic' && (
            <>
              <div>
                <label className="label">שם כיתה</label>
                <input value={draft.name || ''} onChange={e => set('name', e.target.value)}
                  placeholder="לדוגמה: א1" className="input w-full" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="label">שכבה</label>
                  <select value={draft.grade || 'א'} onChange={e => set('grade', e.target.value)} className="input w-full">
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="label">שנת לימודים</label>
                  <input value={draft.year || ''} onChange={e => set('year', e.target.value)}
                    placeholder="תשפ״ה" className="input w-full" />
                </div>
              </div>
              <div>
                <label className="label">צבע כיתה</label>
                <ColorPicker value={draft.color} onChange={c => set('color', c)} />
              </div>
            </>
          )}

          {tab === 'schedule' && (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">מלא את המקצועות לפי שיעור ויום. ניתן להשאיר תאים ריקים.</p>
              <ScheduleEditor
                schedule={draft.schedule || {}}
                onChange={s => set('schedule', s)}
              />
            </>
          )}

          {tab === 'children' && (
            <ClassChildrenTab classId={draft.id} classColor={draft.color} />
          )}

          {tab === 'staff' && (
            <>
              <div>
                <label className="label">מחנך/ת כיתה</label>
                <div className="space-y-2">
                  <input value={draft.teacherContact?.name || ''} onChange={e => setTeacher('name', e.target.value)}
                    placeholder="שם" className="input w-full text-sm" />
                  <input value={draft.teacherContact?.phone || ''} onChange={e => setTeacher('phone', e.target.value)}
                    placeholder="טלפון" className="input w-full text-sm" dir="ltr" />
                  <input value={draft.teacherContact?.email || ''} onChange={e => setTeacher('email', e.target.value)}
                    placeholder="מייל" className="input w-full text-sm" dir="ltr" />
                </div>
              </div>
              <div>
                <label className="label">סייע/ת ואנשי צוות נוספים</label>
                <PeopleEditor people={draft.assistants || []} onChange={v => set('assistants', v)}
                  showTitle placeholder="שם" />
              </div>
            </>
          )}

          {tab === 'committee' && (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">חברי ועד כיתה — יופיעו בדף הכיתה לכלל ההורים.</p>
              <PeopleEditor people={draft.committee || []} onChange={v => set('committee', v)}
                showTitle placeholder="שם הורה" />
            </>
          )}

          {tab === 'admins' && (
            <ClassAdminsTab
              classId={draft.id}
              adminUids={draft.adminUids || []}
              allUsers={allUsers}
              onAdd={handleAddAdmin}
              onRemove={handleRemoveAdmin}
              saving={saving}
            />
          )}
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminClassesPage() {
  const [classes, setClasses]   = useState([])
  const [users, setUsers]       = useState([])
  const [selected, setSelected] = useState(null)
  const [isNew, setIsNew]       = useState(false)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    Promise.all([getClasses(), getUsers()])
      .then(([cls, usr]) => { setClasses(cls); setUsers(usr) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (cls) => {
    const saved = await saveClass(cls)
    setClasses(prev => {
      const idx = prev.findIndex(c => c.id === saved.id)
      return idx >= 0 ? prev.map(c => c.id === saved.id ? saved : c) : [saved, ...prev]
    })
    setSelected(null)
    setIsNew(false)
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await deleteClass(id)
      setClasses(prev => prev.filter(c => c.id !== id))
    } catch (e) {
      setError(e.message)
    } finally {
      setDeleting(null)
    }
  }

  const filtered = classes.filter(c => {
    const q = search.toLowerCase()
    return !q || c.name?.toLowerCase().includes(q) || c.grade?.toLowerCase().includes(q)
  })

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 dark:text-white"><span className="text-xl leading-none">🎓</span>ניהול כיתות</h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">{classes.length} כיתות</p>
        </div>
        <button onClick={() => { setSelected(blankClass()); setIsNew(true) }}
          className="btn-primary flex items-center gap-2">
          <Plus size={16} /> כיתה חדשה
        </button>
      </div>

      {error && <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

      <div className="relative mb-4">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם כיתה או שכבה..." className="input w-full pe-10" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <GraduationCap size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">{search ? 'לא נמצאו כיתות' : 'אין כיתות עדיין'}</p>
          {!search && <p className="text-sm mt-1">לחץ על "כיתה חדשה" כדי להתחיל</p>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(cls => (
            <div key={cls.id}
              className="bg-white rounded-2xl shadow-card border border-gray-100 p-4 flex items-center gap-4 dark:bg-gray-800 dark:border-gray-700">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                style={{ backgroundColor: cls.color || CLASS_COLORS[0] }}>
                {cls.name || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-800 dark:text-gray-100">
                  כיתה {cls.name}
                  <span className="text-xs font-normal text-gray-400 ms-2">שכבה {cls.grade}</span>
                </div>
                {cls.teacherContact?.name && (
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 dark:text-gray-400">
                    <Users size={11} /> {cls.teacherContact.name}
                  </div>
                )}
                {cls.adminUids?.length > 0 && (
                  <div className="text-xs text-secondary-600 mt-0.5">
                    {cls.adminUids.length} מנהל{cls.adminUids.length > 1 ? 'ים' : ''} כיתה
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => { setSelected(cls); setIsNew(false) }}
                  className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(cls.id)} disabled={deleting === cls.id}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                  {deleting === cls.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <ClassPanel
          cls={selected}
          isNew={isNew}
          onSave={handleSave}
          onClose={() => { setSelected(null); setIsNew(false) }}
          allUsers={users}
        />
      )}
    </div>
  )
}
