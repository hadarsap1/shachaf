import { useState, useEffect } from 'react'
import { getNewFamilies, getTasks } from '../../lib/db'
import { hasConsented } from '../../lib/consent'
import { Users, MessageCircle, Loader2, X, Phone, MapPin, Mail } from 'lucide-react'

function FamilyDetailPanel({ family, onClose }) {
  const phone = (() => { const d = (family.phone || '').replace(/\D/g, ''); return d.startsWith('972') ? d : '972' + d.replace(/^0/, '') })()
  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col animate-slide-from-right dark:bg-gray-800" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100">פרטי משפחה</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div className="flex flex-col items-center gap-3">
            <div className="avatar w-16 h-16 text-2xl bg-primary-100 text-primary-700 dark:text-primary-300 dark:bg-primary-900/40">
              {family.name?.[0] || '?'}
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-800 text-base dark:text-gray-100">{family.name}</div>
              <span className="text-xs bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded-full font-medium dark:text-primary-300 dark:bg-primary-900/30">משפחה חדשה</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 justify-end text-sm text-gray-600 dark:text-gray-300">
              <span className="truncate">{family.email}</span>
              <Mail size={14} className="text-gray-400 flex-shrink-0" />
            </div>
            {family.phone ? (
              <div className="flex items-center gap-2 justify-end text-sm text-gray-600 dark:text-gray-300">
                <span dir="ltr">{family.phone}</span>
                <Phone size={14} className="text-gray-400 flex-shrink-0" />
              </div>
            ) : (
              <div className="flex items-center gap-2 justify-end text-sm text-gray-400">
                <span>אין מספר טלפון</span>
                <Phone size={14} className="flex-shrink-0" />
              </div>
            )}
            {family.address ? (
              <div className="flex items-center gap-2 justify-end text-sm text-gray-600 dark:text-gray-300">
                <span>{family.address}</span>
                <MapPin size={14} className="text-gray-400 flex-shrink-0" />
              </div>
            ) : (
              <div className="flex items-center gap-2 justify-end text-sm text-gray-400">
                <span>אין כתובת</span>
                <MapPin size={14} className="flex-shrink-0" />
              </div>
            )}
          </div>
        </div>
        {phone && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700">
            <a
              href={`https://wa.me/${phone}?text=${encodeURIComponent('שלום! אני המשפחה המארחת שלכם 👋 אשמח לעזור בכל שאלה')}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors border border-green-200 dark:bg-green-900/20 dark:text-green-300">
              <MessageCircle size={15} />
              שלח הודעה ב-WhatsApp
            </a>
          </div>
        )}
      </div>
    </>
  )
}

const isUrl = (s) => typeof s === 'string' && s.startsWith('http')

function FamilyCard({ family, taskCounts, onClick }) {
  const phone = (() => { const d = (family.phone || '').replace(/\D/g, ''); return d.startsWith('972') ? d : '972' + d.replace(/^0/, '') })()
  const { done = 0, total = 0 } = taskCounts || {}
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div className="card p-5 cursor-pointer hover:bg-gray-50 transition-colors dark:hover:bg-gray-700/50" onClick={onClick}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {isUrl(family.avatar)
            ? <img src={family.avatar} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
            : <div className="avatar w-12 h-12 text-lg bg-primary-100 text-primary-700 dark:text-primary-300 dark:bg-primary-900/40">{family.name?.[0] || '?'}</div>
          }
          <div className="text-right">
            <h3 className="font-bold text-gray-800 dark:text-gray-100">{family.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{family.email}</p>
          </div>
        </div>
        <span className="badge badge-primary text-xs">משפחה חדשה</span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5 dark:text-gray-400">
          <span>התקדמות משימות</span>
          <span className="font-medium text-gray-700 dark:text-gray-200">{done}/{total}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-xs text-gray-400 mt-1 text-left">{pct}%</div>
      </div>

      {phone && (
        <a
          href={`https://wa.me/${phone}?text=${encodeURIComponent(`שלום! אני המשפחה המארחת שלכם 👋 אשמח לעזור בכל שאלה`)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="mt-4 flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors border border-green-200 dark:bg-green-900/20 dark:text-green-300"
        >
          <MessageCircle size={15} />
          שלח הודעה ב-WhatsApp
        </a>
      )}
    </div>
  )
}

export default function FamiliesPage() {
  const [families, setFamilies] = useState([])
  const [tasksByFamily, setTasksByFamily] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedFamily, setSelectedFamily] = useState(null)

  useEffect(() => {
    Promise.all([getNewFamilies(), getTasks()])
      .then(([allNewFamilies, allTasks]) => {
        // Privacy: a family's details appear to hosts only after that family
        // approved the current policy version.
        const newFamilies = allNewFamilies.filter(f => hasConsented(f))
        setFamilies(newFamilies)
        const counts = {}
        newFamilies.forEach(f => {
          const ft = allTasks.filter(t => t.assignedTo === f.uid)
          counts[f.uid] = { total: ft.length, done: ft.filter(t => t.status === 'done').length }
        })
        setTasksByFamily(counts)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="page-container rtl flex justify-center items-center py-16" dir="rtl">
        <Loader2 size={32} className="animate-spin text-primary-400" />
      </div>
    )
  }

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 dark:text-primary-300">
          <span className="text-xl leading-none">👨‍👩‍👧</span>
          המשפחות שלי
        </h1>
        <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">{families.length} משפחות חדשות בטיפולך</p>
      </div>

      {families.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={44} className="mx-auto mb-4 opacity-25" />
          <p className="font-semibold text-gray-500 dark:text-gray-400">עדיין לא שויכו אליך משפחות</p>
          <p className="text-sm mt-1">המנהל ישייך אליך משפחות חדשות בקרוב</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {families.map(family => (
            <FamilyCard key={family.uid} family={family} taskCounts={tasksByFamily[family.uid]} onClick={() => setSelectedFamily(family)} />
          ))}
        </div>
      )}

      {selectedFamily && (
        <FamilyDetailPanel family={selectedFamily} onClose={() => setSelectedFamily(null)} />
      )}
    </div>
  )
}
