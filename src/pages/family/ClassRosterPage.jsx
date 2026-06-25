import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getClasses, getChildren, getChildrenByParent, getUsersByUids } from '../../lib/db'
import { GraduationCap, Phone, Users, Loader2, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'

function ChildCard({ child, parents }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-3 justify-end">
        <div>
          <p className="font-semibold text-gray-800 text-sm">{child.name}</p>
          {child.hobbies?.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{child.hobbies.join(' · ')}</p>
          )}
          {child.pet && (
            <p className="text-xs text-gray-400">🐾 {child.pet}</p>
          )}
        </div>
        <div className="w-10 h-10 rounded-full bg-primary-100 flex-shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold text-primary-600">
          {child.photoUrl
            ? <img src={child.photoUrl} alt="" className="w-full h-full object-cover" />
            : child.name?.[0] || '?'
          }
        </div>
      </div>
      {parents.length > 0 && (
        <div className="px-4 py-2 divide-y divide-gray-50">
          {parents.map(p => (
            <div key={p.uid} className="flex items-center gap-2 py-2 justify-end">
              <div className="text-right">
                <p className="text-xs font-medium text-gray-700">{p.name}</p>
                <div className="flex gap-3 mt-0.5 justify-end">
                  {p.phone && (
                    <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-xs text-primary-600" dir="ltr">
                      <Phone size={10} />
                      {p.phone}
                    </a>
                  )}
                  {p.email && (
                    <a href={`mailto:${p.email}`} className="flex items-center gap-1 text-xs text-primary-600" dir="ltr">
                      <Mail size={10} />
                      {p.email}
                    </a>
                  )}
                </div>
              </div>
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
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
  const [otherClasses, setOtherClasses] = useState([]) // classes user has no child in
  const [otherAdmins, setOtherAdmins] = useState({})  // classId → [user]
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [classChildren, setClassChildren] = useState([])
  const [parents, setParents] = useState({}) // childId → [user]
  const [loading, setLoading] = useState(true)
  const [loadingRoster, setLoadingRoster] = useState(false)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [myKids, allClasses] = await Promise.all([
        getChildrenByParent(user.uid),
        getClasses(),
      ])
      const myClassIds = [...new Set(myKids.map(c => c.classId).filter(Boolean))]
      const mine = allClasses.filter(c => myClassIds.includes(c.id))
      const other = allClasses.filter(c => !myClassIds.includes(c.id))
      setMyClasses(mine)
      setOtherClasses(other)

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
  }, [user])

  // Load roster for the selected class
  useEffect(() => {
    const cls = myClasses[selectedIdx]
    if (!cls) return
    setLoadingRoster(true)
    const loadRoster = async () => {
      const kids = await getChildren(cls.id)
      setClassChildren(kids)

      // Collect all unique parentUids across the class then fetch individually
      const allParentUids = [...new Set(kids.flatMap(k => k.parentUids || []))]
      const parentUsers = await getUsersByUids(allParentUids)
      const userMap = Object.fromEntries(parentUsers.map(u => [u.uid, u]))

      const parentMap = {}
      for (const kid of kids) {
        parentMap[kid.id] = (kid.parentUids || []).map(uid => userMap[uid]).filter(Boolean)
      }
      setParents(parentMap)
      setLoadingRoster(false)
    }
    loadRoster()
  }, [myClasses, selectedIdx])

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={32} className="animate-spin text-primary-400" />
    </div>
  )

  if (myClasses.length === 0) return (
    <div className="p-6 text-center" dir="rtl">
      <GraduationCap size={48} className="mx-auto mb-4 text-gray-300" />
      <h2 className="text-lg font-semibold text-gray-700">אין כיתה מקושרת</h2>
      <p className="text-sm text-gray-400 mt-1">ילדיכם טרם קושרו לכיתה</p>
      <Link to="/contact" className="mt-4 inline-flex btn-primary text-sm py-2 px-4">צור קשר</Link>
    </div>
  )

  const cls = myClasses[selectedIdx]

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" dir="rtl">
      <div className="mb-5">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2">
          <span className="text-2xl leading-none">👥</span>
          ספריית כיתה
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">ילדים ופרטי הורים</p>
      </div>

      {/* Class tabs */}
      {myClasses.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
          {myClasses.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setSelectedIdx(i)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-all border',
                i === selectedIdx
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
              style={i === selectedIdx ? { backgroundColor: c.color || '#1B3B70' } : {}}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Class header */}
      {cls && (
        <div className="rounded-2xl p-4 mb-5 text-white flex items-center justify-between"
          style={{ backgroundColor: cls.color || '#1B3B70' }}>
          <span className="text-sm opacity-80">{classChildren.length} ילדים</span>
          <div>
            <h2 className="text-lg font-black">{cls.name}</h2>
            {cls.grade && <p className="text-xs opacity-70">כיתה {cls.grade}</p>}
          </div>
        </div>
      )}

      {loadingRoster ? (
        <div className="flex justify-center py-10">
          <Loader2 size={28} className="animate-spin text-primary-400" />
        </div>
      ) : classChildren.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">אין ילדים רשומים בכיתה</div>
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
                <div key={cls.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3">
                  <div className="text-right flex-1">
                    <p className="font-semibold text-sm text-gray-800">{cls.name}</p>
                    {cls.grade && <p className="text-xs text-gray-400">כיתה {cls.grade}</p>}
                    {admins.length === 0 && <p className="text-xs text-gray-400 mt-1">אין רכז/ת כיתה</p>}
                    {admins.map(a => (
                      <div key={a.uid} className="flex flex-wrap gap-3 mt-1 justify-end">
                        <span className="text-xs text-gray-700">{a.name}</span>
                        {a.phone && (
                          <a href={`tel:${a.phone}`} className="flex items-center gap-1 text-xs text-primary-600" dir="ltr">
                            <Phone size={10} />{a.phone}
                          </a>
                        )}
                        {a.email && (
                          <a href={`mailto:${a.email}`} className="flex items-center gap-1 text-xs text-primary-600" dir="ltr">
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
