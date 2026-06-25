import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getEmergencyMode, getEmergencySchedule, getChildrenByParent, getClasses } from '../../lib/db'
import { AlertTriangle, ChevronRight, ChevronLeft, ExternalLink, Loader2 } from 'lucide-react'

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function EmergencySchedulePage() {
  const { user } = useAuth()
  const [mode, setMode]       = useState(null)
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10))
  const [myClasses, setMyClasses] = useState([])
  const [schedules, setSchedules] = useState({}) // classId → slots[]
  const [loading, setLoading] = useState(true)
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  useEffect(() => {
    if (!user?.uid) return
    Promise.all([getEmergencyMode(), getChildrenByParent(user.uid), getClasses()])
      .then(([m, kids, allClasses]) => {
        setMode(m)
        const myClassIds = [...new Set(kids.map(k => k.classId).filter(Boolean))]
        setMyClasses(allClasses.filter(c => myClassIds.includes(c.id)))
        setLoading(false)
      })
  }, [user])

  useEffect(() => {
    if (!myClasses.length) return
    setLoadingSchedule(true)
    Promise.all(myClasses.map(c => getEmergencySchedule(c.id, date))).then(results => {
      const map = {}
      myClasses.forEach((c, i) => { map[c.id] = results[i] })
      setSchedules(map)
      setLoadingSchedule(false)
    })
  }, [myClasses, date])

  if (loading) return (
    <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary-400" /></div>
  )

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 dark:bg-red-900/30">
          <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">{mode?.title || 'שגרת חירום'}</h1>
          {mode?.message && <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">{mode.message}</p>}
        </div>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-card px-4 py-3 mb-5 dark:bg-gray-800 dark:border-gray-700">
        <button
          onClick={() => setDate(d => addDays(d, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="font-bold text-gray-800 text-sm dark:text-gray-100">{formatDate(date)}</p>
          <p className="text-xs text-gray-400">{date}</p>
        </div>
        <button
          onClick={() => setDate(d => addDays(d, -1))}
          disabled={date <= new Date().toISOString().slice(0, 10)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Schedules per class */}
      {loadingSchedule ? (
        <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin text-primary-400" /></div>
      ) : (
        <div className="space-y-4">
          {myClasses.map(cls => {
            const slots = schedules[cls.id] || []
            return (
              <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden dark:bg-gray-800 dark:border-gray-700">
                <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                  <span className="text-xs text-gray-400">{slots.length} שיעורים</span>
                  <h2 className="font-bold text-gray-800 dark:text-gray-100">{cls.name}</h2>
                </div>

                {slots.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">
                    אין שיעורים מתוכננים ליום זה
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-gray-700">
                    {slots.map((sl, i) => (
                      <div key={i} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-1">
                            {sl.zoomLink && (
                              <a
                                href={sl.zoomLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs flex items-center gap-1 text-primary-600 hover:text-primary-800"
                                dir="ltr"
                              >
                                <ExternalLink size={11} />
                                קישור לשיעור
                              </a>
                            )}
                          </div>
                          <div className="text-right flex-1">
                            <p className="font-semibold text-gray-800 text-sm dark:text-gray-100">{sl.subject}</p>
                            {sl.time && <p className="text-xs text-gray-400 mt-0.5" dir="ltr">{sl.time}</p>}
                            {sl.notes && <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">{sl.notes}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {myClasses.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <AlertTriangle size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">לא נמצאו כיתות מקושרות לחשבונך</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
