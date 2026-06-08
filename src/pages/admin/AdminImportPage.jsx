import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Upload, RefreshCw, Trash2, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react'
import {
  collection, query, where, getDocs, writeBatch, doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { getPendingFamilies, deletePendingFamily } from '../../lib/db'
import clsx from 'clsx'

// ── Column aliases ─────────────────────────────────────────────────────────────
const COLUMN_ALIASES = {
  'שם': 'name', 'שם מלא': 'name', 'name': 'name', 'full name': 'name',
  'אימייל': 'email', 'מייל': 'email', 'email': 'email', 'e-mail': 'email',
  'טלפון': 'phone', 'נייד': 'phone', 'phone': 'phone', 'mobile': 'phone', 'cell': 'phone',
  'כתובת': 'address', 'address': 'address',
}

const TABS = [
  { key: 'new_family', label: 'משפחות חדשות' },
  { key: 'host_family', label: 'משפחות מארחות' },
  { key: 'community', label: 'קהילה' },
]

// ── Parse spreadsheet/CSV buffer → normalized rows ────────────────────────────
async function parseFile(file) {
  const { read, utils } = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const wb = read(buffer, { type: 'array', defval: '' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = utils.sheet_to_json(ws, { defval: '' })

  return raw.map(row => {
    const normalized = {}
    for (const [key, val] of Object.entries(row)) {
      const mapped = COLUMN_ALIASES[key.toString().toLowerCase().trim()]
        ?? COLUMN_ALIASES[key.toString().trim()]
      if (mapped) normalized[mapped] = String(val).trim()
    }
    return {
      name: normalized.name || '',
      email: (normalized.email || '').toLowerCase().trim(),
      phone: normalized.phone || '',
      address: normalized.address || '',
    }
  }).filter(r => r.name || r.email)
}

// ── Missing-field badges ───────────────────────────────────────────────────────
function MissingBadges({ row }) {
  const missing = []
  if (!row.phone) missing.push('טלפון')
  if (!row.address) missing.push('כתובת')
  if (!missing.length) return null
  return (
    <span className="inline-flex gap-1 flex-wrap">
      {missing.map(f => (
        <span key={f} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
          חסר {f}
        </span>
      ))}
    </span>
  )
}

// ── Preview table ──────────────────────────────────────────────────────────────
function PreviewTable({ rows, onClear, onImport, importing }) {
  const invalidCount = rows.filter(r => !r.email).length
  const missingOptional = rows.filter(r => r.email && (!r.phone || !r.address)).length
  const validCount = rows.filter(r => r.name && r.email).length

  const summaryParts = []
  if (invalidCount > 0) summaryParts.push(`${invalidCount} שורות ללא אימייל`)
  if (missingOptional > 0) summaryParts.push(`${missingOptional} שורות עם שדות חסרים`)

  return (
    <div className="mt-6">
      {summaryParts.length > 0 && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertCircle size={15} className="flex-shrink-0" />
          {summaryParts.join(' · ')}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2.5 font-semibold text-gray-600">שם</th>
              <th className="px-4 py-2.5 font-semibold text-gray-600">אימייל</th>
              <th className="px-4 py-2.5 font-semibold text-gray-600">טלפון</th>
              <th className="px-4 py-2.5 font-semibold text-gray-600">כתובת</th>
              <th className="px-4 py-2.5 font-semibold text-gray-600">סטטוס</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => {
              const invalid = !row.email
              const missingName = !row.name
              return (
                <tr
                  key={i}
                  className={clsx(
                    'transition-colors',
                    invalid ? 'opacity-50 bg-gray-50' : missingName ? 'bg-red-50' : 'hover:bg-gray-50'
                  )}
                >
                  <td className={clsx('px-4 py-2.5', missingName && !invalid ? 'text-red-600 font-medium' : 'text-gray-800')}>
                    {row.name || <span className="italic text-gray-400">—</span>}
                  </td>
                  <td className={clsx('px-4 py-2.5 font-mono text-xs', invalid ? 'text-gray-400 italic' : 'text-gray-700')} dir="ltr">
                    {row.email || <span className="not-italic">—</span>}
                  </td>
                  <td className={clsx('px-4 py-2.5', !row.phone && !invalid ? 'bg-amber-50 text-amber-800' : 'text-gray-700')}>
                    {row.phone || <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className={clsx('px-4 py-2.5', !row.address && !invalid ? 'bg-amber-50 text-amber-800' : 'text-gray-700')}>
                    {row.address || <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {invalid
                      ? <span className="text-xs text-gray-400 italic">ידלג</span>
                      : <MissingBadges row={row} />
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={onClear}
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          ביטול
        </button>
        <button
          onClick={onImport}
          disabled={importing || validCount === 0}
          className="btn-primary flex items-center gap-2 text-sm py-2 px-5 disabled:opacity-50"
        >
          {importing
            ? <Loader2 size={15} className="animate-spin" />
            : <Upload size={15} />
          }
          ייבא {validCount} רשומות
        </button>
      </div>
    </div>
  )
}

// ── Pending table ──────────────────────────────────────────────────────────────
function PendingTable({ pending, onDelete, onRefresh, loading }) {
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          title="רענן"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
        <h2 className="text-base font-bold text-gray-700">ממתינים לרישום</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-primary-400" />
        </div>
      ) : pending.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          אין רשומות ממתינות
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 font-semibold text-gray-600">שם</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600">אימייל</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600">טלפון</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600">כתובת</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600">שדות חסרים</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pending.map(fam => (
                <tr key={fam.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{fam.name || '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600" dir="ltr">{fam.email}</td>
                  <td className="px-4 py-2.5 text-gray-700">{fam.phone || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-2.5 text-gray-700">{fam.address || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-2.5"><MissingBadges row={fam} /></td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => onDelete(fam.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="מחק"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdminImportPage() {
  const [tab, setTab]               = useState('new_family')
  const [dragging, setDragging]     = useState(false)
  const [rows, setRows]             = useState(null)
  const [parseError, setParseError] = useState('')
  const [importing, setImporting]   = useState(false)
  const [importedCount, setImportedCount] = useState(null)
  const [pending, setPending]       = useState([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const fileInputRef = useRef(null)

  const loadPending = useCallback(async () => {
    setPendingLoading(true)
    try {
      const data = await getPendingFamilies(tab)
      setPending(data)
    } catch (err) {
      console.error('loadPending error:', err)
    } finally {
      setPendingLoading(false)
    }
  }, [tab])

  useEffect(() => { loadPending() }, [loadPending])

  // Reset preview when tab changes
  useEffect(() => {
    setRows(null)
    setParseError('')
    setImportedCount(null)
  }, [tab])

  const handleFile = async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setParseError('סוג קובץ לא נתמך. יש לבחור קובץ xlsx, xls, או csv.')
      return
    }
    setParseError('')
    setRows(null)
    setImportedCount(null)
    try {
      const parsed = await parseFile(file)
      if (parsed.length === 0) {
        setParseError('לא נמצאו שורות בקובץ. ודא שהקובץ מכיל כותרות תואמות.')
        return
      }
      setRows(parsed)
    } catch (err) {
      console.error('parseFile error:', err)
      setParseError('שגיאה בקריאת הקובץ. ודא שהקובץ תקין.')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  const handleImport = async () => {
    if (!rows) return
    const valid = rows.filter(r => r.name && r.email)
    if (valid.length === 0) return

    setImporting(true)
    try {
      const BATCH_MAX = 499
      let batch = writeBatch(db)
      let opCount = 0
      let imported = 0

      const flushBatch = async () => {
        await batch.commit()
        batch = writeBatch(db)
        opCount = 0
      }

      for (const row of valid) {
        const emailLower = row.email.toLowerCase()

        // Check if user already exists in 'users'
        const usersQ = query(collection(db, 'users'), where('email', '==', emailLower))
        const usersSnap = await getDocs(usersQ)

        if (!usersSnap.empty) {
          // Update existing user — only fill empty phone/address
          const existingDoc = usersSnap.docs[0]
          const existing = existingDoc.data()
          const updates = {}
          if (!existing.phone && row.phone) updates.phone = row.phone
          if (!existing.address && row.address) updates.address = row.address
          if (Object.keys(updates).length > 0) {
            batch.update(existingDoc.ref, updates)
            opCount++
          }
        } else {
          // Write to pendingFamilies using email as doc ID
          const pendingRef = doc(db, 'pendingFamilies', emailLower)
          batch.set(pendingRef, {
            email: emailLower,
            name: row.name,
            phone: row.phone,
            address: row.address,
            role: tab,
            importedAt: serverTimestamp(),
            status: 'pending',
          }, { merge: true })
          opCount++
        }

        imported++

        if (opCount >= BATCH_MAX) {
          await flushBatch()
        }
      }

      if (opCount > 0) {
        await batch.commit()
      }

      setImportedCount(imported)
      setRows(null)
      await loadPending()
    } catch (err) {
      console.error('import error:', err)
      setParseError(`שגיאה בייבוא: ${err.message}`)
    } finally {
      setImporting(false)
    }
  }

  const handleDeletePending = async (emailId) => {
    try {
      await deletePendingFamily(emailId)
      setPending(prev => prev.filter(p => p.id !== emailId))
    } catch (err) {
      console.error('deletePendingFamily error:', err)
    }
  }

  return (
    <div className="page-container rtl" dir="rtl">
      {/* Page header */}
      <div className="flex items-center justify-end mb-6">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2">
          <Upload size={22} />
          ייבוא משפחות
        </h1>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'px-5 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px',
              tab === t.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Success banner */}
      {importedCount !== null && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          <CheckCircle2 size={16} className="flex-shrink-0" />
          יובאו {importedCount} רשומות בהצלחה
        </div>
      )}

      {/* Error banner */}
      {parseError && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0" />
          {parseError}
        </div>
      )}

      {/* Upload zone — only show if no rows parsed yet */}
      {!rows && (
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              'relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all py-14 px-6 text-center',
              dragging
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50/40'
            )}
          >
            <Upload size={36} className={clsx('transition-colors', dragging ? 'text-primary-600' : 'text-gray-400')} />
            <div>
              <p className="font-semibold text-gray-700">גרור לכאן קובץ Excel או CSV</p>
              <p className="text-sm text-gray-400 mt-0.5">או</p>
            </div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
              className="btn-primary text-sm py-2 px-5"
            >
              בחר קובץ
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
          <p className="mt-2.5 text-xs text-gray-400 text-center">
            טיפ: כדי לייבא מ-Google Sheets, לחץ על 'קובץ &gt; הורד &gt; Microsoft Excel'
          </p>
        </div>
      )}

      {/* Preview table */}
      {rows && (
        <PreviewTable
          rows={rows}
          onClear={() => { setRows(null); setParseError('') }}
          onImport={handleImport}
          importing={importing}
        />
      )}

      {/* Pending families */}
      <PendingTable
        pending={pending}
        onDelete={handleDeletePending}
        onRefresh={loadPending}
        loading={pendingLoading}
      />
    </div>
  )
}
