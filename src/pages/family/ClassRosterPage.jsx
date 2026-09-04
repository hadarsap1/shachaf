import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getClasses, getChildren, getChildrenByParent, getUsersByUids } from '../../lib/db'
import { hasConsented, childHasConsentedParent } from '../../lib/consent'
import { classLabel, parallelClasses } from '../../lib/grades'
import { GraduationCap, Phone, Users, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'

function ChildCard({ child, parents }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden dark:bg-gray-800 dark:border-gray-700">
      <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-3 justify-end">
        <div>
          <p className="font-semibold text-gray-800 text-sm dark:text-gray-100">{child.name}</p>
          {child.hobbies?.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{child.hobbies.join(' · ')}</p>
          )}
          {child.pet && (
            <p className="text-xs text-gray-400">🐾 {child.pet}</p>
          )}
        </div>
        <div className="w-10 h-10 rounded-full bg-primary-100 flex-shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold text-primary-600 dark:text-primary-400 dark:bg-primary-900/40">
          {child.photoUrl
            ? <img src={child.photoUrl} alt="" className="w-full h-full object-cover" />
            : child.name?.[0] || '?'
          }
        </div>
      </div>
      {parents.length > 0 && (
        <div className="px-4 py-2 divide-y divide-gray-50 dark:divide-gray-700">
          {parents.map(p => (
            <div key={p.uid} className="flex items-center gap-2 py-2 justify-end">
              <div className="text-right">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-200">{p.name}</p>
                <div className="flex gap-3 mt-0.5 justify-end">
                  {p.phone && (
                    <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400" dir="ltr">
                      <Phone size={10} />
                      {p.phone}
                    </a>
                  )}
                  {p.email && (
                    <a href={`mailto:${p.email}`} className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400" dir="ltr">
                      <Mail size={10} />
                      {p.email}
                    </a>
                  )}
                </div>
              </div>
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0 dark:bg-gray-800 dark:text-gray-400">
                {p.name?.[0] || '?'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ClassRosterPage() {
  const { user } = useAuth()
  const [myClasses, setMyClasses] = useState([])
  const [gradeClasses, setGradeClasses] = useState([])   // parallel classes in my grade
  const [otherClasses, setOtherClasses] = useState([])   // neither mine nor my grade
  const [otherAdmins, setOtherAdmins] = useState({})  // classId → [user]
  const [selectedId, setSelectedId] = useState('')
  const [classChildren, setClassChildren] = useState([])
  const [parents, setParents] = useState({}) // childId → [user]
  const [loading, setLoading] = useState(true)
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [rosterError, setRosterError] = useState(false)
  // ?class=<id> — the parallel-class links on the class page land here, on that
  // class, and the tab choice stays in the URL so a refresh keeps it.
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedClassId = searchParams.get('class')

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [myKids, allClasses] = await Promise.all([
        getChildrenByParent(user.uid),
        getClasses(),
      ])
      const myClassIds = [...new Set(myKids.map(c => c.classId).filter(Boolean))]
      const mine = allClasses.filter(c => myClassIds.includes(c.id))
      // Classes in the same grade level as one of mine — א1 next to א2. Their
      // roster opens in full; every other class shows its coordinator only.
      const parallel = parallelClasses(allClasses, mine)
      const parallelIds = new Set(parallel.map(c => c.id))
      const other = allClasses.filter(c => !myClassIds.includes(c.id) && !parallelIds.has(c.id))
      setMyClasses(mine)
      setGradeClasses(parallel)
      setOtherClasses(other)
      const openable = new Set([...mine, ...parallel].map(c => c.id))
      setSelectedId(prev => prev
        || (openable.has(requestedClassId) ? requestedClassId : '')
        || mine[0]?.id || '')

      // Fetch admin contacts for non-member classes (class admins are publicly readable)
      const adminUids = [...new Set(other.flatMap(c => c.adminUids || []))]
      if (adminUids.length) {
        const admins = await getUsersByUids(adminUids)
        const adminMap = Object.fromEntries(admins.map(u => [u.uid, u]))
        const byClass = {}
        for (const cls of other) {
          byClass[cls.id] = (cls.adminUids || []).map(uid => adminMap[uid]).filter(Boolean)
        }
        setOtherAdmins(byClass)
      }
      setLoading(false)
    }
    load()
  }, [user, requestedClassId])

  // Load roster for the selected class
  useEffect(() => {
    if (!selectedId) return
    setLoadingRoster(true)
    setRosterError(false)
    const loadRoster = async () => {
      const kids = await getChildren(selectedId)

      // Collect all unique parentUids across the class then fetch individually
      const allParentUids = [...new Set(kids.flatMap(k => k.parentUids || []))]
      const parentUsers = await getUsersByUids(allParentUids)
      const userMap = Object.fromEntries(parentUsers.map(u => [u.uid, u]))

      // Privacy: a child appears only after a linked parent approved the
      // current policy version, and each parent's contact appears only once
      // THEY approved (covers unclaimed imports and pending co-parents).
      const visibleKids = kids.filter(k => childHasConsentedParent(k, userMap))
      setClassChildren(visibleKids)
      const parentMap = {}
      for (const kid of visibleKids) {
        parentMap[kid.id] = (kid.parentUids || [])
          .map(uid => userMap[uid])
          .filter(u => hasConsented(u))
      }
      setParents(parentMap)
      setLoadingRoster(false)
    }
    // A parent whose profile has not synced its grade yet (no visit since the
    // parallel-class roster shipped) is denied by the rules — say so instead of
    // spinning forever.
    loadRoster().catch(() => {
      setClassChildren([])
      setParents({})
      setRosterError(true)
      setLoadingRoster(false)
    })
  }, [selectedId])

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={32} className="animate-spin text-primary-400" />
    </div>
  )

  if (myClasses.length === 0) return (
    <div className="p-6 text-center" dir="rtl">
      <GraduationCap size={48} className="mx-auto mb-4 text-gray-300" />
      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">אין כיתה מקושרת</h2>
      <p className="text-sm text-gray-400 mt-1">ילדיכם טרם קושרו לכיתה</p>
      <Link to="/contact" className="mt-4 inline-flex btn-primary text-sm py-2 px-4">צור קשר</Link>
    </div>
  )

  const viewable = [...myClasses, ...gradeClasses]
  const cls = viewable.find(c => c.id === selectedId)
  const isParallel = !!cls && gradeClasses.some(c => c.id === cls.id)

  const selectClass = (id) => {
    setSelectedId(id)
    setSearchParams({ class: id }, { replace: true })
  }

  const classTab = (c) => (
    <button
      key={c.id}
      onClick={() => selectClass(c.id)}
      className={clsx(
        'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-all border',
        c.id === selectedId
          ? 'text-white border-transparent shadow-sm'
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
      )}
      style={c.id === selectedId ? { backgroundColor: c.color || '#1B3B70' } : {}}
    >
      {c.name}
    </button>
  )

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" dir="rtl">
      <div className="mb-5">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 dark:text-primary-300">
          <span className="text-2xl leading-none">👥</span>
          ספריית כיתה
        </h1>
        <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">ילדים ופרטי הורים</p>
      </div>

      {/* Class tabs — my own classes, then the parallel ones in my grade */}
      {viewable.length > 1 && (
        <div className="mb-5 space-y-3">
          <div>
            {gradeClasses.length > 0 && (
              <p className="text-xs font-semibold text-gray-400 mb-1.5">
                {myClasses.length > 1 ? 'הכיתות שלי' : 'הכיתה שלי'}
              </p>
            )}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {myClasses.map(classTab)}
            </div>
          </div>
          {gradeClasses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5">
                <Users size={13} className="flex-shrink-0" />
                השכבה שלי — כיתות מקבילות
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {gradeClasses.map(classTab)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Class header */}
      {cls && (
        <div className="rounded-2xl p-4 mb-5 text-white flex items-center justify-between"
          style={{ backgroundColor: cls.color || '#1B3B70' }}>
          <span className="text-sm opacity-80">{classChildren.length} ילדים</span>
          <div>
            <h2 className="text-lg font-black">{cls.name}</h2>
            {cls.grade && (
              <p className="text-xs opacity-70">
                {classLabel(cls.grade)}{isParallel ? ' · כיתה מקבילה בשכבה שלי' : ''}
              </p>
            )}
          </div>
        </div>
      )}

      <p className="flex items-center gap-1.5 justify-end text-xs text-gray-400 mb-3">
        מוצגות רק משפחות שאישרו את תקנון הפרטיות
        <ShieldCheck size={13} className="flex-shrink-0" />
      </p>

      {loadingRoster ? (
        <div className="flex justify-center py-10">
          <Loader2 size={28} className="animate-spin text-primary-400" />
        </div>
      ) : rosterError ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          לא הצלחנו לטעון את הספרייה כרגע. אם זו כיתה מקבילה, התנתק והתחבר מחדש כדי לרענן את השיוך לשכבה.
        </div>
      ) : classChildren.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">אין ילדים להצגה — יוצגו רק ילדים שהוריהם אישרו את התקנון</div>
      ) : (
        <div className="space-y-3">
          {classChildren.map(child => (
            <ChildCard key={child.id} child={child} parents={parents[child.id] || []} />
          ))}
        </div>
      )}

      {/* Other classes — show admin contact only */}
      {otherClasses.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 text-right">כיתות אחרות — איש קשר</h2>
          <div className="space-y-2">
            {otherClasses.map(cls => {
              const admins = otherAdmins[cls.id] || []
              return (
                <div key={cls.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3 dark:bg-gray-800 dark:border-gray-700">
                  <div className="text-right flex-1">
                    <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">{cls.name}</p>
                    {cls.grade && <p className="text-xs text-gray-400">{classLabel(cls.grade)}</p>}
                    {admins.length === 0 && <p className="text-xs text-gray-400 mt-1">אין רכז/ת כיתה</p>}
                    {admins.map(a => (
                      <div key={a.uid} className="flex flex-wrap gap-3 mt-1 justify-end">
                        <span className="text-xs text-gray-700 dark:text-gray-200">{a.name}</span>
                        {a.phone && (
                          <a href={`tel:${a.phone}`} className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400" dir="ltr">
                            <Phone size={10} />{a.phone}
                          </a>
                        )}
                        {a.email && (
                          <a href={`mailto:${a.email}`} className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400" dir="ltr">
                            <Mail size={10} />{a.email}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="w-3 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: cls.color || '#1B3B70' }} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
