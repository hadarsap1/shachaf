import { useState, useEffect, useRef } from 'react'
import {
  getChildren, getClasses, getUsers, saveChild, deleteChild,
  bulkImportChildren, linkChildToParent, unlinkChildFromParent,
} from '../../lib/db'
import { CLASS_COLORS } from '../../lib/classColors'
import {
  Baby, Plus, Trash2, X, Check, Search, Upload, Link2,
  Link, Loader2, ChevronDown, Users, AlertCircle,
} from 'lucide-react'
import clsx from 'clsx'

const blankChild = () => ({
  id: 'child-' + Date.now(),
  name: '',
  classId: '',
  grade: '',
  parentUids: [],
})

// ── Add / Edit panel ──────────────────────────────────────────────────────────

function ChildPanel({ child, isNew, classes, allUsers, onSave, onClose }) {
  const [draft, setDraft]         = useState({ ...child })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [parentSearch, setParentSearch] = useState('')
  const [linking, setLinking]     = useState(false)

  const set = (f, v) => setDraft(d => ({ ...d, [f]: v }))

  const classMap = Object.fromEntries(classes.map(c => [c.id, c]))
  const selectedClass = classMap[draft.classId]

  const parentSuggestions = parentSearch.length > 1
    ? allUsers.filter(u =>
        !(draft.parentUids || []).includes(u.uid) &&
        (u.name?.toLowerCase().includes(parentSearch.toLowerCase()) ||
         u.email?.toLowerCase().includes(parentSearch.toLowerCase()))
      ).slice(0, 5)
    : []

  const linkedParents = allUsers.filter(u => (draft.parentUids || []).includes(u.uid))

  const handleLink = async (uid) => {
    setLinking(true)
    try {
      if (!isNew && draft.id && !draft.id.startsWith('child-')) {
        await linkChildToParent(draft.id, uid)
      }
      setDraft(d => ({ ...d, parentUids: [...new Set([...(d.parentUids || []), uid])] }))
      setParentSearch('')
    } finally {
      setLinking(false)
    }
  }

  const handleUnlink = async (uid) => {
    setLinking(true)
    try {
      if (!isNew && draft.id && !draft.id.startsWith('child-')) {
        await unlinkChildFromParent(draft.id, uid)
      }
      setDraft(d => ({ ...d, parentUids: (d.parentUids || []).filter(u => u !== uid) }))
    } finally {
      setLinking(false)
    }
  }

  const handleSave = async () => {
    if (!draft.name?.trim()) { setError('שם ילד/ה הוא שדה חובה'); return }
    if (!draft.classId) { setError('יש לבחור כיתה'); return }
    setSaving(true)
    try {
      await onSave({ ...draft, name: draft.name.trim() })
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
          <h2 className="font-bold text-gray-800">{isNew ? 'הוספת ילד/ה' : `עריכה: ${draft.name}`}</h2>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 btn-primary text-sm py-1.5 px-3">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            שמור
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}

          <div>
            <label className="label">שם ילד/ה</label>
            <input value={draft.name || ''} onChange={e => set('name', e.target.value)}
              placeholder="שם מלא" className="input w-full" />
          </div>

          <div>
            <label className="label">כיתה</label>
            <select value={draft.classId || ''} onChange={e => set('classId', e.target.value)} className="input w-full">
              <option value="">בחר כיתה</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>כיתה {c.name} (שכבה {c.grade})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label mb-3">קישור הורים</label>
            <div className="relative">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={parentSearch}
                onChange={e => setParentSearch(e.target.value)}
                placeholder="חיפוש הורה לפי שם או מייל"
                className="input w-full text-sm pe-9"
              />
              {parentSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-card z-10 overflow-hidden">
                  {parentSuggestions.map(u => (
                    <button key={u.uid} onClick={() => handleLink(u.uid)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-right">
                      <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                        {u.name?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.name}</div>
                        <div className="text-xs text-gray-400 truncate">{u.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {linkedParents.length > 0 ? (
              <div className="space-y-2 mt-3">
                {linkedParents.map(u => (
                  <div key={u.uid} className="flex items-center gap-3 bg-secondary-50 rounded-xl px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-secondary-200 text-secondary-700 flex items-center justify-center text-xs font-bold">
                      {u.name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{u.name}</div>
                      <div className="text-xs text-gray-400 truncate">{u.email}</div>
                    </div>
                    <button onClick={() => handleUnlink(u.uid)} disabled={linking}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-3">לא מקושר להורים עדיין</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── CSV import panel ──────────────────────────────────────────────────────────

function ImportPanel({ classes, onImport, onClose }) {
  const fileRef = useRef(null)
  const [rows, setRows]       = useState([])
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [preview, setPreview] = useState(false)

  const classByName = Object.fromEntries(
    classes.flatMap(c => [
      [c.name, c.id],
      [`כיתה ${c.name}`, c.id],
      [c.name.toLowerCase(), c.id],
    ])
  )

  const parseCSV = (text) => {
    const lines = text.trim().split('\n').filter(Boolean)
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const nameIdx  = headers.findIndex(h => ['שם', 'name', 'שם ילד'].includes(h.toLowerCase()))
    const classIdx = headers.findIndex(h => ['כיתה', 'class', 'class_name', 'כיתה'].includes(h.toLowerCase()))
    if (nameIdx < 0 || classIdx < 0) throw new Error('העמודות חייבות להיות: שם, כיתה')
    return lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/"/g, ''))
      const name = cols[nameIdx]
      const className = cols[classIdx]
      const classId = classByName[className] || classByName[className?.toLowerCase()]
      return { name, className, classId, valid: !!name && !!classId }
    }).filter(r => r.name)
  }

  const handleFile = async (file) => {
    setError('')
    try {
      if (file.name.endsWith('.csv')) {
        const text = await file.text()
        setRows(parseCSV(text))
        setPreview(true)
        return
      }
      const { default: XLSX } = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_csv(ws)
      setRows(parseCSV(data))
      setPreview(true)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleImport = async () => {
    const valid = rows.filter(r => r.valid)
    if (!valid.length) return
    setSaving(true)
    try {
      await onImport(valid.map(({ name, classId }) => ({ name, classId })))
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const validCount   = rows.filter(r => r.valid).length
  const invalidCount = rows.filter(r => !r.valid).length

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 flex items-center gap-2"><Upload size={16} />ייבוא ילדים</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!preview ? (
            <>
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                <p className="font-semibold">פורמט הקובץ (CSV / Excel):</p>
                <p>עמודות חובה: <strong>שם</strong>, <strong>כיתה</strong></p>
                <p>שם הכיתה חייב להתאים לכיתות הקיימות במערכת</p>
              </div>
              {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <button onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-10 text-center hover:border-primary-300 hover:bg-primary-50/30 transition-colors">
                <Upload size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-500">לחץ לבחירת קובץ CSV / Excel</p>
              </button>
            </>
          ) : (
            <>
              {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
              <div className="flex gap-3">
                <div className="flex-1 bg-secondary-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-secondary-700">{validCount}</div>
                  <div className="text-xs text-secondary-600">תקין</div>
                </div>
                {invalidCount > 0 && (
                  <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-red-600">{invalidCount}</div>
                    <div className="text-xs text-red-500">לא זוהה כיתה</div>
                  </div>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {rows.map((r, i) => (
                  <div key={i} className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                    r.valid ? 'bg-gray-50' : 'bg-red-50'
                  )}>
                    {r.valid
                      ? <Check size={12} className="text-secondary-500 flex-shrink-0" />
                      : <AlertCircle size={12} className="text-red-400 flex-shrink-0" />}
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className={clsx('text-xs', r.valid ? 'text-gray-400' : 'text-red-400')}>
                      {r.className}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setPreview(false); setRows([]) }} className="flex-1 btn-outline text-sm py-2">
                  חזור
                </button>
                <button onClick={handleImport} disabled={saving || validCount === 0}
                  className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  ייבא {validCount} ילדים
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminChildrenPage() {
  const [children, setChildren]   = useState([])
  const [classes, setClasses]     = useState([])
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [search, setSearch]       = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [selected, setSelected]   = useState(null)
  const [isNew, setIsNew]         = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [deleting, setDeleting]   = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([getChildren(), getClasses(), getUsers()])
      .then(([ch, cl, us]) => { setChildren(ch); setClasses(cl); setUsers(us) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const classMap = Object.fromEntries(classes.map(c => [c.id, c]))

  const handleSave = async (child) => {
    const saved = await saveChild(child)
    setChildren(prev => {
      const idx = prev.findIndex(c => c.id === saved.id)
      return idx >= 0 ? prev.map(c => c.id === saved.id ? saved : c) : [saved, ...prev]
    })
    setSelected(null)
  }

  const handleImport = async (rows) => {
    await bulkImportChildren(rows)
    load()
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

  const filtered = children.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || c.name?.toLowerCase().includes(q)
    const matchClass  = !filterClass || c.classId === filterClass
    return matchSearch && matchClass
  })

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול ילדים</h1>
          <p className="text-sm text-gray-500 mt-0.5">{children.length} ילדים</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-outline flex items-center gap-2 text-sm">
            <Upload size={15} />
            ייבוא CSV
          </button>
          <button onClick={() => { setSelected(blankChild()); setIsNew(true) }} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} />
            הוספה
          </button>
        </div>
      </div>

      {error && <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם..." className="input w-full pe-10" />
        </div>
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="input w-36">
          <option value="">כל הכיתות</option>
          {classes.map(c => <option key={c.id} value={c.id}>כיתה {c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Baby size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">{search || filterClass ? 'לא נמצאו ילדים' : 'אין ילדים עדיין'}</p>
          {!search && !filterClass && <p className="text-sm mt-1">הוסף ידנית או ייבא קובץ CSV</p>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          {filtered.map((child, i) => {
            const cls = classMap[child.classId]
            return (
              <div key={child.id} className={clsx(
                'flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors',
                i > 0 && 'border-t border-gray-50'
              )}>
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: cls?.color || '#9CA3AF' }}
                >
                  {cls?.name || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 text-sm">{child.name}</div>
                  <div className="text-xs text-gray-400">
                    {cls ? `כיתה ${cls.name}` : 'כיתה לא ידועה'}
                    {child.parentUids?.length > 0 && (
                      <span className="ms-2 text-secondary-600">· {child.parentUids.length} הורה/ים מקושרים</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setSelected(child); setIsNew(false) }}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl">
                    <Link2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(child.id)} disabled={deleting === child.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl">
                    {deleting === child.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <ChildPanel
          child={selected}
          isNew={isNew}
          classes={classes}
          allUsers={users}
          onSave={handleSave}
          onClose={() => { setSelected(null); setIsNew(false) }}
        />
      )}

      {showImport && (
        <ImportPanel
          classes={classes}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  )
}
