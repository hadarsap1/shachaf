import { useState, useEffect } from 'react'
import { getUsers } from '../../lib/db'
import { Users, MessageCircle, CheckSquare, Loader2 } from 'lucide-react'


function FamilyCard({ family }) {
  const phone = family.phone?.replace(/\D/g, '') || ''

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="avatar w-12 h-12 text-lg bg-primary-100 text-primary-700">
            {family.avatar || family.name?.[0] || '?'}
          </div>
          <div className="text-right">
            <h3 className="font-bold text-gray-800">{family.name}</h3>
            <p className="text-xs text-gray-500">{family.email}</p>
          </div>
        </div>
        <span className="badge badge-primary text-xs">משפחה חדשה</span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>התקדמות משימות</span>
          <span className="font-medium text-gray-700">0/0</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: '0%' }} />
        </div>
        <div className="text-xs text-gray-400 mt-1 text-left">0%</div>
      </div>

      {phone && (
        <a
          href={`https://wa.me/${phone}?text=${encodeURIComponent(`שלום! אני המשפחה המארחת שלכם 👋 אשמח לעזור בכל שאלה`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors border border-green-200"
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUsers()
      .then(users => {
        setFamilies(users.filter(u => u.role === 'new_family'))
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
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2">
          <Users size={22} />
          המשפחות שלי
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{families.length} משפחות חדשות בטיפולך</p>
      </div>

      {families.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">אין משפחות רשומות עדיין</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {families.map(family => (
            <FamilyCard key={family.uid} family={family} />
          ))}
        </div>
      )}
    </div>
  )
}
