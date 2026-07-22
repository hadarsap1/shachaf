import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { classLabel } from '../../lib/grades'
import {
  getChildren, getClasses, getUsers, saveChild, deleteChild, saveClass,
  bulkImportChildren, bulkDeleteChildren, linkChildToParent, unlinkChildFromParent,
  enrichUserFromImport,
  getAdminNote, saveAdminNote, logAudit,
} from '../../lib/db'
import {
  Baby, Plus, Trash2, X, Check, Search, Upload, Link2,
  Loader2, AlertCircle, StickyNote,
} from 'lucide-react'
import clsx from 'clsx'
import { toast } from '../../components/ui/Toaster'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'

// Parent full name from the imported first name + the child's family name
const parentFullName = (p, child) =>
  p.name ? [p.name, child.familyName || child.name?.split(' ').slice(1).join(' ')].filter(Boolean).join(' ') : ''

// Link + copy phone/address/Hebrew name from the phone book onto the user
async function linkAndEnrich(childId, uid, p, child) {
  await linkChildToParent(childId, uid)
  try {
    await enrichUserFromImport(uid, { name: parentFullName(p, child), phone: p.phone || '', address: child.address || '' })
  } catch (e) { console.error('enrich failed', e) }
}

const blankChild = () => ({
  id: 'child-' + Date.now(),
  name: '',
  classId: '',
  grade: '',
  parentUids: [],
})

// ── Admin notes section (stored in adminNotes collection, not child document) ─

function AdminNotesSection({ childId, isNew }) {
  const [note, setNote]     = useState('')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    if (isNew) return
    getAdminNote(childId).then(n => { setNote(n); setLoading(false) })
  }, [childId, isNew])

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveAdminNote(childId, note)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <label className="label">הערות מנהל</label>
      {isNew ? (
        <p className="text-xs text-gray-400 mt-1">שמור את הילד/ה תחילה כדי להוסיף הערות</p>
      ) : loading ? (
        <div className="text-xs text-gray-400 mt-1">טוען...</div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="לדוגמה: שם משתמש וסיסמה לאתר הלמידה"
            rows={3}
            className="input w-full resize-none"
          />
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 text-xs btn-outline py-1 px-3">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {saved ? 'נשמר!' : 'שמור הערות'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Add / Edit panel ──────────────────────────────────────────────────────────

function ChildPanel({ child, isNew, classes, allUsers, onSave, onClose }) {
  const [draft, setDraft]         = useState({ ...child })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [parentSearch, setParentSearch] = useState('')
  const [linking, setLinking]     = useState(false)

  useEscapeToClose(onClose, !saving)

  const set = (f, v) => setDraft(d => ({ ...d, [f]: v }))

  const parentSuggestions = parentSearch.length > 1
    ? allUsers.filter(u =>
        !(draft.parentUids || []).includes(u.uid) &&
        (u.name?.toLowerCase().includes(parentSearch.toLowerCase()) ||
         u.email?.toLowerCase().includes(parentSearch.toLowerCase()))
      ).slice(0, 5)
    : []

  const linkedParents = allUsers.filter(u => (draft.parentUids || []).includes(u.uid))

  const handleLink = async (uid, importedParent = null) => {
    setLinking(true)
    try {
      if (!isNew && draft.id && !draft.id.startsWith('child-')) {
        if (importedParent) {
          await linkAndEnrich(draft.id, uid, importedParent, draft)
        } else {
          await linkChildToParent(draft.id, uid)
        }
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
      const { notes: _notes, ...childData } = draft
      await onSave({ ...childData, name: childData.name.trim() })
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="פרטי ילד" className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right dark:bg-gray-800" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100">{isNew ? 'הוספת ילד/ה' : `עריכה: ${draft.name}`}</h2>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 btn-primary text-sm py-1.5 px-3">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            שמור
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 dark:bg-red-900/20 dark:text-red-400">{error}</div>}

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
                <option key={c.id} value={c.id}>{classLabel(c.name, c.grade)} (שכבה {c.grade})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">תאריך לידה (אופציונלי)</label>
            <input type="date" value={draft.birthDate || ''} onChange={e => set('birthDate', e.target.value)}
              className="input w-full" />
          </div>

          <AdminNotesSection childId={draft.id} isNew={isNew} />

          {(draft.address || (draft.parents || []).length > 0) && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">פרטים מהייבוא</div>
                {(() => {
                  const matchable = (draft.parents || [])
                    .map(p => ({ p, u: p.email && allUsers.find(u => u.email?.toLowerCase() === p.email) }))
                    .filter(({ u }) => u && !(draft.parentUids || []).includes(u.uid))
                  return matchable.length > 1 ? (
                    <button
                      onClick={async () => { for (const { p, u } of matchable) await handleLink(u.uid, p) }}
                      disabled={linking}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                      <Link2 size={11} /> קשר את כולם ({matchable.length})
                    </button>
                  ) : null
                })()}
              </div>
              {draft.address && (
                <div className="text-sm text-gray-700 dark:text-gray-200">📍 {draft.address}</div>
              )}
              {(draft.parents || []).map((p, i) => {
                const match = p.email && allUsers.find(u => u.email?.toLowerCase() === p.email)
                const alreadyLinked = match && (draft.parentUids || []).includes(match.uid)
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 dark:text-gray-100">{p.name || '—'}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400" dir="ltr">
                        {[p.phone, p.email].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {match && !alreadyLinked && (
                      <button onClick={() => handleLink(match.uid, p)} disabled={linking}
                        className="text-xs text-primary-600 dark:text-primary-400 bg-primary-50 border border-primary-200 rounded-full px-2.5 py-1 hover:bg-primary-100 dark:hover:bg-primary-900/40 flex items-center gap-1 dark:bg-primary-900/30">
                        <Link2 size={11} /> קשר למשתמש
                      </button>
                    )}
                    {alreadyLinked && (
                      <span className="text-xs text-secondary-600 dark:text-secondary-400 flex items-center gap-1"><Check size={11} /> מקושר</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div>
            <label className="label mb-3">קישור הורים</label>
            <div className="relative">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={parentSearch}
                onChange={e => setParentSearch(e.target.value)}
                placeholder="חיפוש הורה לפי שם או מייל"
                className="input w-full text-sm ps-9"
              />
              {parentSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-card z-10 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
                  {parentSuggestions.map(u => (
                    <button key={u.uid} onClick={() => handleLink(u.uid)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-right dark:hover:bg-gray-700/50">
                      <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold dark:text-primary-300 dark:bg-primary-900/40">
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
                  <div key={u.uid} className="flex items-center gap-3 bg-secondary-50 rounded-xl px-3 py-2 dark:bg-secondary-900/30">
                    <div className="w-7 h-7 rounded-full bg-secondary-200 text-secondary-700 flex items-center justify-center text-xs font-bold">
                      {u.name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{u.name}</div>
                      <div className="text-xs text-gray-400 truncate">{u.email}</div>
                    </div>
                    <button onClick={() => handleUnlink(u.uid)} disabled={linking}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg dark:hover:bg-red-900/20">
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

  useEscapeToClose(onClose, !saving)

  // Normalize class labels so "א", "א'", "כיתה א" all match the same class
  const normClass = (s) => String(s || '')
    .replace(/['׳"״]/g, '')
    .replace(/^כיתה\s*/, '')
    .trim()
    .toLowerCase()
  const classByName = Object.fromEntries(
    classes.map(c => [normClass(c.name), c.id])
  )

  const finishRow = (name, className, address, parents, familyName = '') => {
    const classId = classByName[normClass(className)]
    // valid = matches an existing class; willCreate = class will be created on import
    return { name, familyName, className, classId, address, parents, valid: !!name && !!classId, willCreate: !!name && !classId && !!className }
  }

  // School phone-book: each class section was pasted with a different column
  // layout (extra ת"ז column, merged vs split address), so the header row lies.
  // Parse positionally per row and classify trailing cells as name/phone/email.
  const parsePhoneBook = (rawRows) => {
    const isEmail = (v) => /@/.test(v)
    const isPhone = (v) => (v.match(/\d/g) || []).length >= 7 && /^[\d\s\-+/.]+$/.test(v)
    const isId    = (v) => /^\d{6,}$/.test(v)
    return rawRows.slice(1).map(cols => {
      const vals = cols.map(c => String(c ?? '').trim())
      const className = vals[0]
      if (!className) return null
      let i = 1
      if (isId(vals[i])) i++                      // skip ת"ז column (class ה)
      const family = vals[i++] || ''
      const first  = vals[i++] || ''
      let address
      if (vals[i] && !/\d/.test(vals[i]) && /^\d/.test(vals[i + 1] || '')) {
        address = [vals[i], vals[i + 1], vals[i + 2]].filter(Boolean).join(' ')   // street | # | city
        i += 3
      } else {
        address = vals[i] || ''                   // merged single-column address
        i++
      }
      // Remaining cells → parents; classify each token
      const parents = []
      let cur = {}
      const push = () => { if (cur.name || cur.phone || cur.email) parents.push(cur); cur = {} }
      for (; i < vals.length; i++) {
        const v = vals[i]
        if (!v) continue
        if (isEmail(v)) { if (cur.email) push(); cur.email = v.toLowerCase() }
        else if (isPhone(v)) { if (cur.phone) push(); cur.phone = v }
        else {
          if (v === cur.name) continue            // duplicated name cell (class ה)
          if (cur.name && (cur.email || cur.phone)) push()
          if (!cur.name) cur.name = v
        }
      }
      push()
      return finishRow([first, family].filter(Boolean).join(' '), className, address, parents, family)
    }).filter(Boolean).filter(r => r.name)
  }

  // Simple format: שם (or שם פרטי + שם משפחה) + כיתה columns
  const parseSimple = (rawRows) => {
    const stripKey = (s) => String(s ?? '').trim().replace(/["״]/g, '')
    const headers = (rawRows[0] || []).map(stripKey)
    const idx = (...keys) => headers.findIndex(h => keys.includes(h))
    const nameIdx = idx('שם', 'name', 'שם ילד'), firstIdx = idx('שם פרטי'), lastIdx = idx('שם משפחה')
    const classIdx = idx('כיתה', 'class', 'class_name')
    const out = rawRows.slice(1).map(cols => {
      const vals = cols.map(c => String(c ?? '').trim())
      const name = nameIdx >= 0 && vals[nameIdx]
        ? vals[nameIdx]
        : [vals[firstIdx] || '', vals[lastIdx] || ''].filter(Boolean).join(' ')
      return finishRow(name, vals[classIdx] || '', '', [])
    }).filter(r => r.name)
    if (!out.length) throw new Error('העמודות חייבות להיות: שם (או שם פרטי + שם משפחה), כיתה')
    return out
  }

  const handleFile = async (file) => {
    setError('')
    try {
      let rawRows
      if (file.name.endsWith('.csv')) {
        const { default: Papa } = await import('papaparse')
        const text = await file.text()
        rawRows = Papa.parse(text, { header: false, skipEmptyLines: true }).data
      } else {
        const { default: readXlsxFile } = await import('read-excel-file/browser')
        rawRows = await readXlsxFile(file)
      }
      if (!rawRows?.length) throw new Error('הקובץ ריק')
      const headers = rawRows[0].map(h => String(h ?? '').trim())
      const isPhoneBook = headers[0] === 'כיתה' && headers.some(h => h.includes('הורה'))
      setRows(isPhoneBook ? parsePhoneBook(rawRows) : parseSimple(rawRows))
      setPreview(true)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleImport = async () => {
    const importable = rows.filter(r => r.valid || r.willCreate)
    if (!importable.length) return
    setSaving(true)
    try {
      // Create classes that don't exist yet, one per unique name
      const missing = [...new Set(importable.filter(r => r.willCreate).map(r => normClass(r.className)))]
      const created = {}
      const CLASS_COLORS = ['#1B3B70', '#0E7490', '#B45309', '#6D28D9', '#BE185D', '#065F46']
      for (let i = 0; i < missing.length; i++) {
        const key = missing[i]
        const display = key.replace(/\s+/g, ' ')
        const cls = await saveClass({
          id: 'class-' + Date.now() + i,
          name: display,
          grade: display[0] || 'א',
          color: CLASS_COLORS[i % CLASS_COLORS.length],
          adminUids: [],
          needsUpdate: true,
        })
        created[key] = cls.id
      }
      await onImport(importable.map(r => ({
        name: r.name,
        familyName: r.familyName || '',
        classId: r.classId || created[normClass(r.className)],
        address: r.address || '',
        parents: r.parents || [],
      })))
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const validCount   = rows.filter(r => r.valid).length
  const createCount  = rows.filter(r => r.willCreate).length
  const newClassNames = [...new Set(rows.filter(r => r.willCreate).map(r => normClass(r.className)))]
  const invalidCount = rows.filter(r => !r.valid && !r.willCreate).length

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="ייבוא ילדים" className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right dark:bg-gray-800" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 flex items-center gap-2 dark:text-gray-100"><Upload size={16} />ייבוא ילדים</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!preview ? (
            <>
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1 dark:bg-blue-900/20 dark:text-blue-300">
                <p className="font-semibold">פורמט הקובץ (CSV / Excel):</p>
                <p>עמודות חובה: <strong>שם</strong> (או <strong>שם פרטי</strong> + <strong>שם משפחה</strong>), <strong>כיתה</strong></p>
                <p>שם הכיתה חייב להתאים לכיתות הקיימות במערכת</p>
                <p>ספר הטלפונים של בית הספר נתמך כמו שהוא</p>
              </div>
              {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 dark:bg-red-900/20 dark:text-red-400">{error}</div>}
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <button onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-10 text-center hover:border-primary-300 hover:bg-primary-50/30 transition-colors dark:border-gray-700">
                <Upload size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">לחץ לבחירת קובץ CSV / Excel</p>
              </button>
            </>
          ) : (
            <>
              {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 dark:bg-red-900/20 dark:text-red-400">{error}</div>}
              <div className="flex gap-3">
                <div className="flex-1 bg-secondary-50 rounded-xl p-3 text-center dark:bg-secondary-900/30">
                  <div className="text-xl font-bold text-secondary-700 dark:text-secondary-300">{validCount + createCount}</div>
                  <div className="text-xs text-secondary-600 dark:text-secondary-400">תקין</div>
                </div>
                {invalidCount > 0 && (
                  <div className="flex-1 bg-red-50 rounded-xl p-3 text-center dark:bg-red-900/20">
                    <div className="text-xl font-bold text-red-600 dark:text-red-400">{invalidCount}</div>
                    <div className="text-xs text-red-500">ללא כיתה</div>
                  </div>
                )}
              </div>
              {newClassNames.length > 0 && (
                <div className="bg-amber-50 rounded-xl px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                  כיתות חדשות שייווצרו: {newClassNames.join(', ')}
                </div>
              )}
              <div className="max-h-64 overflow-y-auto space-y-1">
                {rows.map((r, i) => (
                  <div key={i} className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                    r.valid ? 'bg-gray-50 dark:bg-gray-800' : r.willCreate ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-red-50 dark:bg-red-900/30'
                  )}>
                    {r.valid || r.willCreate
                      ? <Check size={12} className={clsx('flex-shrink-0', r.valid ? 'text-secondary-500' : 'text-amber-500')} />
                      : <AlertCircle size={12} className="text-red-400 flex-shrink-0" />}
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className={clsx('text-xs', r.valid ? 'text-gray-400' : r.willCreate ? 'text-amber-500' : 'text-red-400')}>
                      {r.className}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setPreview(false); setRows([]) }} className="flex-1 btn-outline text-sm py-2">
                  חזור
                </button>
                <button onClick={handleImport} disabled={saving || validCount + createCount === 0}
                  className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  ייבא {validCount + createCount} ילדים
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
  const { user: currentUser } = useAuth()
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
  const [confirmId, setConfirmId] = useState(null)   // child pending delete confirmation
  const [onlyUnlinked, setOnlyUnlinked] = useState(false)
  const [checkedIds, setCheckedIds] = useState(new Set())
  const [bulkWorking, setBulkWorking] = useState(false)

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
    const created = await bulkImportChildren(rows)
    // Auto-link children to existing users by parent email
    const userByEmail = Object.fromEntries(users.filter(u => u.email).map(u => [u.email.toLowerCase(), u.uid]))
    let linked = 0
    for (const child of created) {
      for (const p of child.parents || []) {
        const uid = p.email && userByEmail[p.email]
        if (uid) {
          try { await linkAndEnrich(child.id, uid, p, child); linked++ } catch (e) { console.error('auto-link failed', child.name, e) }
        }
      }
    }
    logAudit(currentUser, 'children_import', { details: `יובאו ${created.length} ילדים, קושרו ${linked} הורים` })
    toast(`יובאו ${created.length} ילדים${linked ? ` · קושרו ${linked} הורים` : ''}`)
    load()
  }

  const handleDelete = async (id) => {
    setConfirmId(null)
    setDeleting(id)
    try {
      const child = children.find(c => c.id === id)
      await deleteChild(id)
      logAudit(currentUser, 'child_delete', { targetName: child?.name || id })
      setChildren(prev => prev.filter(c => c.id !== id))
      toast('הילד נמחק')
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
    const matchLinked = !onlyUnlinked || (c.parentUids || []).length === 0
    return matchSearch && matchClass && matchLinked
  })
  const unlinkedCount = children.filter(c => (c.parentUids || []).length === 0).length

  const allChecked = filtered.length > 0 && filtered.every(c => checkedIds.has(c.id))
  const toggleAll = () => {
    setCheckedIds(allChecked ? new Set() : new Set(filtered.map(c => c.id)))
  }
  const toggleOne = (id) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (!window.confirm(`למחוק ${checkedIds.size} ילדים?`)) return
    setBulkWorking(true)
    try {
      const n = checkedIds.size
      await bulkDeleteChildren([...checkedIds])
      logAudit(currentUser, 'children_bulk_delete', { details: `${n} רשומות ילדים נמחקו` })
      setChildren(prev => prev.filter(c => !checkedIds.has(c.id)))
      setCheckedIds(new Set())
      toast(`${n} ילדים נמחקו`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBulkWorking(false)
    }
  }

  // Link every checked child to registered users whose email matches an imported parent
  const handleBulkLink = async () => {
    setBulkWorking(true)
    try {
      const userByEmail = Object.fromEntries(users.filter(u => u.email).map(u => [u.email.toLowerCase(), u.uid]))
      let linked = 0
      for (const child of children.filter(c => checkedIds.has(c.id))) {
        for (const p of child.parents || []) {
          const uid = p.email && userByEmail[p.email]
          if (uid && !(child.parentUids || []).includes(uid)) {
            try { await linkAndEnrich(child.id, uid, p, child); linked++ } catch (e) { console.error('bulk link failed', child.name, e) }
          }
        }
      }
      setCheckedIds(new Set())
      load()
      if (linked === 0) toast('לא נמצאו הורים רשומים להצמדה (לפי מייל)', 'error')
      else toast(`קושרו ${linked} הורים`)
    } finally {
      setBulkWorking(false)
    }
  }

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 dark:text-white"><span className="text-xl leading-none">🧒</span>ניהול ילדים</h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">{children.length} ילדים</p>
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

      {error && <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm dark:bg-red-900/20 dark:text-red-300">{error}</div>}

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם..." className="input w-full ps-10" />
        </div>
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="input w-36">
          <option value="">כל הכיתות</option>
          {classes.map(c => <option key={c.id} value={c.id}>{classLabel(c.name, c.grade)}</option>)}
        </select>
        <button onClick={() => setOnlyUnlinked(v => !v)}
          className={clsx('px-3 py-2 rounded-xl text-sm font-medium border whitespace-nowrap transition-colors',
            onlyUnlinked
              ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 text-amber-800 dark:text-amber-200'
              : 'bg-white border-gray-200 text-gray-600 hover:border-amber-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300')}>
          ללא הורה ({unlinkedCount})
        </button>
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
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
          {/* Select-all header + bulk actions */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100 dark:bg-gray-900 dark:border-gray-700">
            <input type="checkbox" checked={allChecked} onChange={toggleAll}
              className="w-4 h-4 accent-primary-600 flex-shrink-0" title="בחר הכל" />
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-1">
              {checkedIds.size > 0 ? `${checkedIds.size} נבחרו` : 'בחר הכל'}
            </span>
            {checkedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={handleBulkLink} disabled={bulkWorking}
                  className="text-xs text-primary-600 dark:text-primary-400 bg-primary-50 border border-primary-200 rounded-full px-3 py-1.5 hover:bg-primary-100 dark:hover:bg-primary-900/40 flex items-center gap-1 dark:bg-primary-900/30">
                  {bulkWorking ? <Loader2 size={11} className="animate-spin" /> : <Link2 size={11} />}
                  קשר הורים לפי מייל
                </button>
                <button onClick={handleBulkDelete} disabled={bulkWorking}
                  className="text-xs text-red-600 dark:text-red-400 bg-red-50 border border-red-200 dark:border-red-700 rounded-full px-3 py-1.5 hover:bg-red-100 flex items-center gap-1 dark:bg-red-900/20">
                  {bulkWorking ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  מחק נבחרים
                </button>
              </div>
            )}
          </div>
          {filtered.map((child, i) => {
            const cls = classMap[child.classId]
            return (
              <div key={child.id} className={clsx(
                'flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
                i > 0 && 'border-t border-gray-50 dark:border-gray-700'
              )}>
                <input type="checkbox" checked={checkedIds.has(child.id)} onChange={() => toggleOne(child.id)}
                  className="w-4 h-4 accent-primary-600 flex-shrink-0" />
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: cls?.color || '#9CA3AF' }}
                >
                  {cls?.name || '?'}
                </div>
                {child.photoUrl && (
                  <img src={child.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 text-sm dark:text-gray-100">{child.name}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-1.5 flex-wrap">
                    {cls ? `כיתה ${cls.name}` : 'כיתה לא ידועה'}
                    {child.parentUids?.length > 0 && (
                      <span className="text-secondary-600 dark:text-secondary-400">· {child.parentUids.length} הורה/ים</span>
                    )}
                    {child.notes && (
                      <span className="text-amber-500 flex items-center gap-0.5"><StickyNote size={11} /> הערות</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {confirmId === child.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(child.id)} disabled={deleting === child.id}
                        className="text-xs text-white bg-red-500 hover:bg-red-600 px-2.5 py-1.5 rounded-lg">
                        {deleting === child.id ? <Loader2 size={13} className="animate-spin" /> : 'מחק'}
                      </button>
                      <button onClick={() => setConfirmId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                        ביטול
                      </button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => { setSelected(child); setIsNew(false) }} aria-label="פרטי ילד"
                        className="p-2.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl dark:hover:bg-primary-900/30">
                        <Link2 size={15} />
                      </button>
                      <button onClick={() => setConfirmId(child.id)} aria-label="מחק ילד"
                        className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl dark:hover:bg-red-900/20">
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
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
