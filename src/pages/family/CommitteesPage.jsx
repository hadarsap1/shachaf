import { useState, useEffect } from 'react'
import { getCommittees, sendCommitteeMessage, getHobbyGroups, joinHobbyGroup, leaveHobbyGroup, getEventsByCommittee } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
  Phone, Mail, Loader2, MessageSquare, Send, CheckCircle2, Calendar,
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

function CommitteeCard({ committee, userName }) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [msgOpen, setMsgOpen] = useState(false)
  const [eventsOpen, setEventsOpen] = useState(false)
  const [events, setEvents] = useState([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const hasMembers = committee.members?.length > 0

  const handleShowEvents = async () => {
    if (!eventsOpen && events.length === 0) {
      const evts = await getEventsByCommittee(committee.id)
      setEvents(evts)
    }
    setEventsOpen(o => !o)
  }

  const handleSend = async () => {
    if (!body.trim()) return
    setSending(true)
    try {
      await sendCommitteeMessage(committee.id, user.uid, user.name || '', body.trim())
      setSent(true)
      setBody('')
      setTimeout(() => { setSent(false); setMsgOpen(false) }, 2500)
    } catch { /* ignore */ } finally {
      setSending(false)
    }
  }

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

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          {hasMembers && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-sm font-medium flex items-center gap-1.5"
              style={{ color: committee.color || '#1B3B70' }}
            >
              <Users size={14} />
              {expanded ? 'הסתר חברים' : `הצג ${committee.members.length} חברים`}
            </button>
          )}
          <button
            onClick={handleShowEvents}
            className="text-sm font-medium flex items-center gap-1.5 text-gray-500 hover:text-gray-700"
          >
            <Calendar size={14} />
            {eventsOpen ? 'הסתר אירועים' : 'אירועי הוועדה'}
          </button>
          <button
            onClick={() => setMsgOpen(o => !o)}
            className="text-sm font-medium flex items-center gap-1.5 text-gray-500 hover:text-gray-700"
          >
            <MessageSquare size={14} />
            {msgOpen ? 'סגור' : 'שלח הודעה'}
          </button>
        </div>
      </div>

      {expanded && hasMembers && (
        <div className="px-5 pb-4 border-t border-gray-50">
          {committee.members.map((m, i) => (
            <MemberCard key={i} member={m} />
          ))}
        </div>
      )}

      {eventsOpen && (
        <div className="px-5 pb-4 border-t border-gray-50 pt-3">
          {events.length === 0 ? (
            <p className="text-xs text-gray-400 text-right">אין אירועים מתוכננים לוועדה זו</p>
          ) : (
            <div className="space-y-2">
              {events.map(ev => (
                <div key={ev.id} className="flex items-center justify-between text-sm">
                  <span className="text-xs text-gray-400">{ev.date} {ev.time || ''}</span>
                  <div className="text-right">
                    <p className="font-medium text-gray-800 text-sm">{ev.title}</p>
                    {ev.location && <p className="text-xs text-gray-400">{ev.location}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {msgOpen && (
        <div className="px-5 pb-5 border-t border-gray-50 pt-4">
          {sent ? (
            <div className="flex items-center gap-2 text-green-600 text-sm justify-center py-2">
              <CheckCircle2 size={16} />
              ההודעה נשלחה לוועדה
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-2 text-right">הודעתך תגיע למנהלי הוועדה</p>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={3}
                maxLength={2000}
                className="input w-full resize-none text-sm text-right"
                placeholder="כתוב הודעתך לוועדה..."
              />
              <button
                onClick={handleSend}
                disabled={sending || !body.trim()}
                className="mt-2 w-full py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                שלח
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function HobbyGroupCard({ group, uid }) {
  const isMember = (group.memberUids || []).includes(uid)
  const [loading, setLoading] = useState(false)
  const Icon = ICON_MAP[group.icon] || Users

  const toggle = async () => {
    setLoading(true)
    try {
      if (isMember) await leaveHobbyGroup(group.id, uid)
      else await joinHobbyGroup(group.id, uid)
    } finally {
      setLoading(false)
    }
  }

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
          <p className="text-xs text-gray-400 mt-1">{(group.memberUids || []).length} חברים</p>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={loading}
        className={clsx(
          'mt-4 w-full py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2',
          isMember
            ? 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600'
            : 'bg-primary-600 text-white hover:bg-primary-700'
        )}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : isMember ? 'עזוב קבוצה' : 'הצטרף לקבוצה'}
      </button>
    </div>
  )
}

export default function CommitteesPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('committees')
  const [committees, setCommittees] = useState([])
  const [hobbyGroups, setHobbyGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingHobby, setLoadingHobby] = useState(false)

  useEffect(() => {
    getCommittees().then(setCommittees).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab !== 'hobby' || hobbyGroups.length > 0) return
    setLoadingHobby(true)
    getHobbyGroups().then(setHobbyGroups).finally(() => setLoadingHobby(false))
  }, [tab])

  const TABS = [
    { id: 'committees', label: 'ועדות' },
    { id: 'hobby', label: 'קבוצות תחביב' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" dir="rtl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users size={24} className="text-primary-600" />
          ועדות וקבוצות
        </h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit me-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Committees tab */}
      {tab === 'committees' && (loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary-400" /></div>
      ) : committees.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={44} className="mx-auto mb-4 opacity-25" />
          <p className="font-semibold text-gray-500">אין ועדות פעילות כרגע</p>
        </div>
      ) : (
        <div className="space-y-4">
          {committees.map(c => <CommitteeCard key={c.id} committee={c} />)}
        </div>
      ))}

      {/* Hobby groups tab */}
      {tab === 'hobby' && (loadingHobby ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary-400" /></div>
      ) : hobbyGroups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Heart size={44} className="mx-auto mb-4 opacity-25" />
          <p className="font-semibold text-gray-500">אין קבוצות תחביב עדיין</p>
          <p className="text-sm mt-1">הנהלת הקהילה תפתח קבוצות בהתאם לתחומי העניין</p>
        </div>
      ) : (
        <div className="space-y-4">
          {hobbyGroups.map(g => <HobbyGroupCard key={g.id} group={g} uid={user.uid} />)}
        </div>
      ))}
    </div>
  )
}
