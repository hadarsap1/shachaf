import { useState, useEffect } from 'react'
import { getCommittees, sendCommitteeMessage, getEventsByCommittee } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
  Phone, Mail, Loader2, MessageSquare, Send, CheckCircle2, Calendar, ChevronLeft,
} from 'lucide-react'
import ContactModal from '../../components/ui/ContactModal'

const ICON_MAP = {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
}

function CommitteeIcon({ name, size = 20, className, style }) {
  const Icon = ICON_MAP[name] || Users
  return <Icon size={size} className={className} style={style} />
}

function MemberCard({ member, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-1 px-1 rounded-lg transition-[background-color] duration-150 text-right"
    >
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">
        {member.name?.[0] || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-800">{member.name}</span>
          {member.title && <span className="text-xs text-gray-400">{member.title}</span>}
        </div>
        {(member.phone || member.email) && (
          <p className="text-xs text-gray-400 mt-0.5">
            {member.phone || member.email}
          </p>
        )}
      </div>
      <ChevronLeft size={14} className="text-gray-300 flex-shrink-0" />
    </button>
  )
}

function CommitteeCard({ committee }) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [msgOpen, setMsgOpen]   = useState(false)
  const [eventsOpen, setEventsOpen] = useState(false)
  const [events, setEvents]     = useState([])
  const [body, setBody]         = useState('')
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
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
    } catch { /* ignore */ } finally { setSending(false) }
  }

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: (committee.color || '#1B3B70') + '20' }}>
            <CommitteeIcon name={committee.icon} size={22} style={{ color: committee.color || '#1B3B70' }} />
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
            <button onClick={() => setExpanded(e => !e)}
              className="text-sm font-medium flex items-center gap-1.5"
              style={{ color: committee.color || '#1B3B70' }}>
              <Users size={14} />
              {expanded ? 'הסתר חברים' : `הצג ${committee.members.length} חברים`}
            </button>
          )}
          <button onClick={handleShowEvents}
            className="text-sm font-medium flex items-center gap-1.5 text-gray-500 hover:text-gray-700">
            <Calendar size={14} />
            {eventsOpen ? 'הסתר אירועים' : 'אירועי הוועדה'}
          </button>
          <button onClick={() => setMsgOpen(o => !o)}
            className="text-sm font-medium flex items-center gap-1.5 text-gray-500 hover:text-gray-700">
            <MessageSquare size={14} />
            {msgOpen ? 'סגור' : 'שלח הודעה'}
          </button>
        </div>
      </div>

      {expanded && hasMembers && (
        <div className="px-5 pb-4 border-t border-gray-50">
          {committee.members.map((m, i) => (
            <MemberCard key={i} member={m} onClick={() => setSelectedMember(m)} />
          ))}
        </div>
      )}

      {selectedMember && (
        <ContactModal person={selectedMember} onClose={() => setSelectedMember(null)} />
      )}

      {eventsOpen && (
        <div className="px-5 pb-4 border-t border-gray-50 pt-3">
          {events.length === 0
            ? <p className="text-xs text-gray-400 text-right">אין אירועים מתוכננים לוועדה זו</p>
            : (
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
              <CheckCircle2 size={16} />ההודעה נשלחה לוועדה
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-2 text-right">הודעתך תגיע למנהלי הוועדה</p>
              <textarea value={body} onChange={e => setBody(e.target.value)}
                rows={3} maxLength={2000}
                className="input w-full resize-none text-sm text-right"
                placeholder="כתוב הודעתך לוועדה..." />
              <button onClick={handleSend} disabled={sending || !body.trim()}
                className="mt-2 w-full py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center gap-2">
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

export default function CommitteesPage() {
  const [committees, setCommittees] = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    getCommittees().then(setCommittees).finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" dir="rtl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield size={24} className="text-primary-600" />
          ועדות
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">ועדות הקהילה ואנשי הקשר שלהן</p>
      </div>

      {loading ? (
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
      )}
    </div>
  )
}
