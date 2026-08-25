import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getEmergencyMode, getEmergencyDay, getChildrenByParent, getClasses, getChildren } from '../../lib/db'
import { EMPTY_DAY, addDays, today, formatDayLabel, visibleFor, childNames } from '../../lib/emergency'
import { AlertTriangle, ChevronRight, ChevronLeft, ExternalLink, Loader2, BookOpen, Users, Home, MapPin, Clock } from 'lucide-react'

function Section({ icon: Icon, title, count, children }) {
  return (
    <div>
      <div className="flex items-center justify-end gap-1.5 px-4 pt-3 pb-1">
        <span className="text-xs text-gray-400">{count}</span>
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400">{title}</h3>
        <Icon size={13} className="text-gray-400" />
      </div>
      {children}
    </div>
  )
}

export default function EmergencySchedulePage() {
  const { user } = useAuth()
  const [mode, setMode]       = useState(null)
  const [date, setDate]       = useState(today())
  const [myClasses, setMyClasses] = useState([])
  const [myChildIds, setMyChildIds] = useState([])
  const [roster, setRoster]   = useState({})   // childId → child
  const [days, setDays]       = useState({})   // classId → { slots, groups, playdates }
  const [loading, setLoading] = useState(true)
  const [loadingDay, setLoadingDay] = useState(false)

  useEffect(() => {
    if (!user?.uid) return
    Promise.all([getEmergencyMode(), getChildrenByParent(user.uid), getClasses()])
      .then(([m, kids, allClasses]) => {
        setMode(m)
        setMyChildIds(kids.map(k => k.id))
        const myClassIds = [...new Set(kids.map(k => k.classId).filter(Boolean))]
        setMyClasses(allClasses.filter(c => myClassIds.includes(c.id)))
        setLoading(false)
      })
  }, [user])

  // Class roster — resolves the child ids on groups / playdates into names.
  useEffect(() => {
    if (!myClasses.length) return
    Promise.all(myClasses.map(c => getChildren(c.id).catch(() => [])))
      .then(lists => {
        const map = {}
        lists.flat().forEach(c => { map[c.id] = c })
        setRoster(map)
      })
  }, [myClasses])

  useEffect(() => {
    if (!myClasses.length) return
    setLoadingDay(true)
    Promise.all(myClasses.map(c => getEmergencyDay(c.id, date))).then(results => {
      const map = {}
      myClasses.forEach((c, i) => { map[c.id] = results[i] })
      setDays(map)
      setLoadingDay(false)
    })
  }, [myClasses, date])

  // Groups / playdates are filtered to the ones this family belongs to.
  const forMe = useMemo(() => {
    const out = {}
    for (const cls of myClasses) {
      const d = days[cls.id] || EMPTY_DAY
      out[cls.id] = {
        slots: d.slots || [],
        groups: (d.groups || []).filter(g => visibleFor(g, myChildIds)),
        playdates: (d.playdates || []).filter(p => visibleFor(p, myChildIds)),
      }
    }
    return out
  }, [myClasses, days, myChildIds])

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
          <p className="font-bold text-gray-800 text-sm dark:text-gray-100">{formatDayLabel(date)}</p>
          <p className="text-xs text-gray-400">{date}</p>
        </div>
        <button
          onClick={() => setDate(d => addDays(d, -1))}
          disabled={date <= today()}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Per class: lessons, learning groups, playdates */}
      {loadingDay ? (
        <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin text-primary-400" /></div>
      ) : (
        <div className="space-y-4">
          {myClasses.map(cls => {
            const { slots, groups, playdates } = forMe[cls.id] || EMPTY_DAY
            const empty = !slots.length && !groups.length && !playdates.length
            return (
              <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden dark:bg-gray-800 dark:border-gray-700">
                <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between dark:border-gray-700">
                  <span className="text-xs text-gray-400">{slots.length} שיעורים</span>
                  <h2 className="font-bold text-gray-800 dark:text-gray-100">{cls.name}</h2>
                </div>

                {empty && (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">
                    אין פעילות מתוכננת ליום זה
                  </div>
                )}

                {slots.length > 0 && (
                  <Section icon={BookOpen} title="שיעורים" count={slots.length}>
                    <div className="divide-y divide-gray-50 dark:divide-gray-700">
                      {slots.map((sl, i) => (
                        <div key={i} className="px-4 py-3 flex items-start justify-between gap-3">
                          {sl.zoomLink && (
                            <a
                              href={sl.zoomLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs flex items-center gap-1 text-primary-600 hover:text-primary-800 flex-shrink-0"
                              dir="ltr"
                            >
                              <ExternalLink size={11} />
                              קישור לשיעור
                            </a>
                          )}
                          <div className="text-right flex-1">
                            <p className="font-semibold text-gray-800 text-sm dark:text-gray-100">{sl.subject}</p>
                            {sl.time && <p className="text-xs text-gray-400 mt-0.5" dir="ltr">{sl.time}</p>}
                            {sl.notes && <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">{sl.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {groups.length > 0 && (
                  <Section icon={Users} title="קבוצות למידה" count={groups.length}>
                    <div className="divide-y divide-gray-50 dark:divide-gray-700">
                      {groups.map((g, i) => {
                        const names = childNames(g, roster)
                        return (
                          <div key={i} className="px-4 py-3 flex items-start justify-between gap-3">
                            {g.link && (
                              <a
                                href={g.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs flex items-center gap-1 text-primary-600 hover:text-primary-800 flex-shrink-0"
                                dir="ltr"
                              >
                                <ExternalLink size={11} />
                                קישור
                              </a>
                            )}
                            <div className="text-right flex-1">
                              <p className="font-semibold text-gray-800 text-sm dark:text-gray-100">{g.name || 'קבוצת למידה'}</p>
                              <div className="flex items-center justify-end gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                                {g.place && <span className="flex items-center gap-1"><MapPin size={10} />{g.place}</span>}
                                {g.time && <span className="flex items-center gap-1" dir="ltr"><Clock size={10} />{g.time}</span>}
                              </div>
                              {g.guide && <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">מנחה: {g.guide}</p>}
                              {names.length > 0 && (
                                <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">משתתפים: {names.join(', ')}</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Section>
                )}

                {playdates.length > 0 && (
                  <Section icon={Home} title="מפגשי משחק" count={playdates.length}>
                    <div className="divide-y divide-gray-50 dark:divide-gray-700">
                      {playdates.map((p, i) => {
                        const names = childNames(p, roster)
                        return (
                          <div key={i} className="px-4 py-3 text-right">
                            <p className="font-semibold text-gray-800 text-sm dark:text-gray-100">
                              {p.host ? `אצל ${p.host}` : 'מפגש משחק'}
                            </p>
                            <div className="flex items-center justify-end gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                              {p.address && <span className="flex items-center gap-1"><MapPin size={10} />{p.address}</span>}
                              {p.time && <span className="flex items-center gap-1" dir="ltr"><Clock size={10} />{p.time}</span>}
                            </div>
                            {names.length > 0 && (
                              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">משתתפים: {names.join(', ')}</p>
                            )}
                            {p.notes && <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">{p.notes}</p>}
                          </div>
                        )
                      })}
                    </div>
                  </Section>
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
