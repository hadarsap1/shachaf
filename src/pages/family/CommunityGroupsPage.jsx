import { useState, useEffect } from 'react'
import { getHobbyGroups, joinHobbyGroup, leaveHobbyGroup } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield, Loader2, ExternalLink,
} from 'lucide-react'
import clsx from 'clsx'

function GroupFields({ fields }) {
  if (!fields?.length) return null
  return (
    <div className="mt-3 space-y-3">
      {fields.map((f, i) => {
        if (f.type === 'text') return (
          <div key={i}>
            {f.label && <p className="text-xs font-semibold text-gray-500 mb-0.5">{f.label}</p>}
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{f.value}</p>
          </div>
        )
        if (f.type === 'link') return (
          <div key={i}>
            {f.label && <p className="text-xs font-semibold text-gray-500 mb-0.5">{f.label}</p>}
            <a href={f.value} target="_blank" rel="noopener noreferrer"
              className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              <ExternalLink size={12} /> {f.label || f.value}
            </a>
          </div>
        )
        if (f.type === 'table' && f.columns?.length) return (
          <div key={i}>
            {f.label && <p className="text-xs font-semibold text-gray-500 mb-1">{f.label}</p>}
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs" dir="rtl">
                <thead className="bg-gray-50">
                  <tr>{f.columns.map((c, ci) => <th key={ci} className="px-3 py-2 text-right font-semibold text-gray-600">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {(f.rows || []).map((row, ri) => (
                    <tr key={ri} className="border-t border-gray-100">
                      {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-gray-700">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
        return null
      })}
    </div>
  )
}

const ICON_MAP = {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
}

function HobbyGroupCard({ group, uid }) {
  const isMember = (group.memberUids || []).includes(uid)
  const [loading, setLoading] = useState(false)
  const [memberUids, setMemberUids] = useState(group.memberUids || [])
  const Icon = ICON_MAP[group.icon] || Users

  const toggle = async () => {
    setLoading(true)
    try {
      if (isMember) {
        await leaveHobbyGroup(group.id, uid)
        setMemberUids(m => m.filter(u => u !== uid))
      } else {
        await joinHobbyGroup(group.id, uid)
        setMemberUids(m => [...m, uid])
      }
    } finally {
      setLoading(false)
    }
  }

  const joined = memberUids.includes(uid)

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: (group.color || '#1B3B70') + '20' }}>
          <Icon size={22} style={{ color: group.color || '#1B3B70' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800">{group.name}</h3>
          {group.description && <p className="text-sm text-gray-500 mt-1">{group.description}</p>}
          <p className="text-xs text-gray-400 mt-1">{memberUids.length} חברים</p>
        </div>
      </div>
      <GroupFields fields={group.fields} />
      <button
        onClick={toggle}
        disabled={loading}
        className={clsx(
          'mt-4 w-full py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2',
          joined
            ? 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600'
            : 'bg-primary-600 text-white hover:bg-primary-700'
        )}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : joined ? 'עזוב קבוצה' : 'הצטרף לקבוצה'}
      </button>
    </div>
  )
}

export default function CommunityGroupsPage() {
  const { user } = useAuth()
  const [groups, setGroups]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getHobbyGroups().then(setGroups).finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" dir="rtl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Heart size={24} className="text-primary-600" />
          קבוצות קהילה
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">הצטרפו לקבוצות לפי תחומי עניין</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary-400" /></div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Heart size={44} className="mx-auto mb-4 opacity-25" />
          <p className="font-semibold text-gray-500">אין קבוצות קהילה עדיין</p>
          <p className="text-sm mt-1">הנהלת הקהילה תפתח קבוצות בהתאם לתחומי העניין</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(g => <HobbyGroupCard key={g.id} group={g} uid={user.uid} />)}
        </div>
      )}
    </div>
  )
}
