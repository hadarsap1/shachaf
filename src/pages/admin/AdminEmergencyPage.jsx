import { useState, useEffect } from 'react'
import { getEmergencyMode, setEmergencyMode, getEmergencySchedule, saveEmergencySchedule, getClasses } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import { AlertTriangle, Plus, Trash2, Save, Loader2, CheckCircle2, X } from 'lucide-react'
import clsx from 'clsx'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function AdminEmergencyPage() {
  const { user } = useAuth()
  const [mode, setMode]         = useState({ active: false, title: '', message: '' })
  const [classes, setClasses]   = useState([])
  const [selClass, setSelClass] = useState('')
  const [selDate, setSelDate]   = useState(today())
  const [slots, setSlots]       = useState([])
  const [loadingMode, setLoadingMode]     = useState(true)
  const [loadingSlots, setLoadingSlots]   = useState(false)
  const [savingMode, setSavingMode]       = useState(false)
  const [savingSlots, setSavingSlots]     = useState(false)
  const [savedMode, setSavedMode]         = useState(false)
  const [savedSlots, setSavedSlots]       = useState(false)

  useEffect(() => {
    Promise.all([getEmergencyMode(), getClasses()]).then(([m, cls]) => {
      setMode({ active: m.active || false, title: m.title || '', message: m.message || '' })
      setClasses(cls)
      if (cls.length) setSelClass(cls[0].id)
      setLoadingMode(false)
    })
  }, [])

  useEffect(() => {
    if (!selClass || !selDate) return
    setLoadingSlots(true)
    getEmergencySchedule(selClass, selDate).then(s => {
      setSlots(s.length ? s : [])
      setLoadingSlots(false)
    })
  }, [selClass, selDate])

  const handleSaveMode = async () => {
    setSavingMode(true)
    await setEmergencyMode(mode, user.uid)
    setSavingMode(false)
    setSavedMode(true)
    setTimeout(() => setSavedMode(false), 2500)
  }

  const handleSaveSlots = async () => {
    setSavingSlots(true)
    await saveEmergencySchedule(selClass, selDate, slots)
    setSavingSlots(false)
    setSavedSlots(true)
    setTimeout(() => setSavedSlots(false), 2500)
  }

  const addSlot = () => setSlots(s => [...s, { time: '', subject: '', zoomLink: '', notes: '' }])
  const removeSlot = i => setSlots(s => s.filter((_, idx) => idx !== i))
  const updateSlot = (i, field, val) => setSlots(s => s.map((sl, idx) => idx === i ? { ...sl, [field]: val } : sl))

  if (loadingMode) return (
    <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary-400" /></div>
  )

  const selClassName = classes.find(c => c.id === selClass)?.name || ''

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" dir="rtl">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 dark:bg-red-900/30">
          <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2 dark:text-white"><span className="text-xl leading-none">🚨</span>מצב חירום</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">ניהול שגרת חירום ולוח שיעורים יומי</p>
        </div>
      </div>

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

      {/* Daily schedule editor */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5 dark:bg-gray-800 dark:border-gray-700">
        <h2 className="font-bold text-gray-800 mb-4 text-right dark:text-gray-100">לוח שיעורים יומי לפי כיתה</h2>

        <div className="flex gap-3 mb-4 flex-wrap">
          <select
            value={selClass}
            onChange={e => setSelClass(e.target.value)}
            className="input flex-1 min-w-[140px] text-right"
          >
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            type="date"
            value={selDate}
            onChange={e => setSelDate(e.target.value)}
            className="input flex-1 min-w-[140px]"
          />
        </div>

        {selClassName && selDate && (
          <p className="text-xs text-gray-400 mb-3 text-right">
            עורך לוח שיעורים: {selClassName} · {selDate}
          </p>
        )}

        {loadingSlots ? (
          <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-primary-400" /></div>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {slots.map((sl, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 relative dark:bg-gray-900">
                  <button
                    onClick={() => removeSlot(i)}
                    className="absolute top-2 left-2 p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 dark:hover:bg-red-900/20"
                  >
                    <X size={14} />
                  </button>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      value={sl.time}
                      onChange={e => updateSlot(i, 'time', e.target.value)}
                      placeholder="שעה (למשל 08:00-09:00)"
                      className="input text-sm text-right col-span-2"
                    />
                    <input
                      type="text"
                      value={sl.subject}
                      onChange={e => updateSlot(i, 'subject', e.target.value)}
                      placeholder="מקצוע"
                      className="input text-sm text-right"
                    />
                    <input
                      type="text"
                      value={sl.zoomLink}
                      onChange={e => updateSlot(i, 'zoomLink', e.target.value)}
                      placeholder="קישור זום (אופציונלי)"
                      className="input text-sm"
                      dir="ltr"
                    />
                  </div>
                  <input
                    type="text"
                    value={sl.notes}
                    onChange={e => updateSlot(i, 'notes', e.target.value)}
                    placeholder="הערות (אופציונלי)"
                    className="input text-sm text-right w-full"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={addSlot}
              className="w-full py-2 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 flex items-center justify-center gap-2 mb-3 dark:text-gray-400"
            >
              <Plus size={14} />
              הוסף שיעור
            </button>

            <button
              onClick={handleSaveSlots}
              disabled={savingSlots}
              className="w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {savingSlots ? <Loader2 size={16} className="animate-spin" /> : savedSlots ? <CheckCircle2 size={16} /> : <Save size={16} />}
              {savedSlots ? 'נשמר!' : 'שמור לוח שיעורים'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
