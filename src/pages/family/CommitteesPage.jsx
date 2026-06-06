import { useState, useEffect } from 'react'
import { getCommittees } from '../../lib/db'
import { COMMITTEE_ICONS } from '../../lib/classColors'
import {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
  Phone, Mail, Loader2,
} from 'lucide-react'
import clsx from 'clsx'

const ICON_MAP = {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
}

function CommitteeIcon({ name, size = 20, className, style }) {
  const Icon = ICON_MAP[name] || Users
  return <Icon size={size} className={className} style={style} />
}

function MemberCard({ member }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">
        {member.name?.[0] || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-gray-800">{member.name}</span>
          {member.title && <span className="text-xs text-gray-400">{member.title}</span>}
        </div>
        <div className="flex flex-wrap gap-3 mt-1">
          {member.phone && (
            <a href={`tel:${member.phone}`}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
              dir="ltr">
              <Phone size={11} />
              {member.phone}
            </a>
          )}
          {member.email && (
            <a href={`mailto:${member.email}`}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
              dir="ltr">
              <Mail size={11} />
              {member.email}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function CommitteeCard({ committee }) {
  const [expanded, setExpanded] = useState(false)
  const hasMembers = committee.members?.length > 0

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: (committee.color || '#1B3B70') + '20' }}>
            <CommitteeIcon
              name={committee.icon}
              size={22}
              style={{ color: committee.color || '#1B3B70' }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-800">{committee.name}</h3>
            {committee.description && (
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{committee.description}</p>
            )}
          </div>
        </div>

        {hasMembers && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-4 text-sm font-medium flex items-center gap-1.5"
            style={{ color: committee.color || '#1B3B70' }}
          >
            <Users size={14} />
            {expanded ? 'הסתר חברים' : `הצג ${committee.members.length} חברים`}
          </button>
        )}
      </div>

      {expanded && hasMembers && (
        <div className="px-5 pb-4 border-t border-gray-50">
          {committee.members.map((m, i) => (
            <MemberCard key={i} member={m} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CommitteesPage() {
  const [committees, setCommittees] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCommittees().then(setCommittees).finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users size={24} className="text-primary-600" />
          ועדות
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          הוועדות הפעילות בשחף
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-primary-400" />
        </div>
      ) : committees.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">אין ועדות פעילות כרגע</p>
        </div>
      ) : (
        <div className="space-y-4">
          {committees.map(c => (
            <CommitteeCard key={c.id} committee={c} />
          ))}
        </div>
      )}
    </div>
  )
}
