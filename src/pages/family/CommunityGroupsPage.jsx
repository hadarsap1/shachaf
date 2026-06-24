import { useState, useEffect, useRef } from 'react'
import { getHobbyGroups, joinHobbyGroup, leaveHobbyGroup, getUsersByUids, subscribeGroupChat, sendGroupChatMessage } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
  Loader2, ExternalLink, ChevronLeft, ChevronDown, MessageCircle,
  Send, Info,
} from 'lucide-react'
import clsx from 'clsx'
import ContactModal from '../../components/ui/ContactModal'

const ICON_MAP = {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
}

// ── Group fields (info panel) ─────────────────────────────────────────────────
function GroupFields({ fields }) {
  if (!fields?.length) return null
  return (
    <div className="space-y-3">
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
            <a
              href={f.value}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-3 py-2 rounded-xl transition-[background-color,color] duration-150 max-w-full"
            >
              <ExternalLink size={13} className="flex-shrink-0" />
              <span className="truncate">{f.label || 'פתח קישור'}</span>
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

// ── Chat panel ────────────────────────────────────────────────────────────────
function GroupChat({ group, user }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    const unsub = subscribeGroupChat(group.id, msgs => {
      setMessages(msgs)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    })
    return unsub
  }, [group.id])

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    setSending(true)
    setText('')
    try {
      await sendGroupChatMessage(group.id, user.uid, user.name || '', trimmed)
    } finally {
      setSending(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">אין הודעות עדיין — התחל שיחה!</p>
        )}
        {messages.map(msg => {
          const isMe = msg.uid === user.uid
          return (
            <div key={msg.id} className={clsx('flex flex-col gap-0.5', isMe ? 'items-end' : 'items-start')}>
              {!isMe && <span className="text-xs text-gray-400 px-1">{msg.name}</span>}
              <div className={clsx(
                'max-w-[80%] px-3 py-2 rounded-2xl text-sm',
                isMe ? 'bg-primary-600 text-white rounded-tl-sm' : 'bg-gray-100 text-gray-800 rounded-tr-sm'
              )}>
                {msg.text}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 items-end">
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 transition-[background-color] duration-150 active:scale-[0.96]"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          placeholder="כתוב הודעה..."
          className="flex-1 input resize-none text-sm text-right leading-relaxed"
          style={{ minHeight: '2.5rem', maxHeight: '6rem' }}
        />
      </div>
    </div>
  )
}

// ── Group card ────────────────────────────────────────────────────────────────
function HobbyGroupCard({ group, uid, user }) {
  const [memberUids, setMemberUids] = useState(group.memberUids || [])
  const [joining, setJoining] = useState(false)
  const [activePanel, setActivePanel] = useState(null) // 'info' | 'members' | 'chat'
  const [members, setMembers] = useState(null)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState(null)
  const Icon = ICON_MAP[group.icon] || Users

  const isMember = memberUids.includes(uid)
  const hasFields = group.fields?.length > 0

  const toggle = (panel) => setActivePanel(p => p === panel ? null : panel)

  const handleJoin = async () => {
    setJoining(true)
    try {
      if (isMember) {
        await leaveHobbyGroup(group.id, uid)
        setMemberUids(m => m.filter(u => u !== uid))
        if (activePanel === 'chat') setActivePanel(null)
      } else {
        await joinHobbyGroup(group.id, uid)
        setMemberUids(m => [...m, uid])
      }
    } finally {
      setJoining(false)
    }
  }

  const handleShowMembers = async () => {
    if (activePanel !== 'members' && members === null) {
      setLoadingMembers(true)
      const fetched = await getUsersByUids(memberUids)
      setMembers(fetched)
      setLoadingMembers(false)
    }
    toggle('members')
  }

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: (group.color || '#1B3B70') + '20' }}>
            <Icon size={22} style={{ color: group.color || '#1B3B70' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-gray-800">{group.name}</h3>
              {/* Join/Leave */}
              <button
                onClick={handleJoin}
                disabled={joining}
                className={clsx(
                  'flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full transition-[background-color,color] duration-150',
                  isMember
                    ? 'bg-primary-100 text-primary-700 hover:bg-red-50 hover:text-red-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-primary-50 hover:text-primary-700'
                )}
              >
                {joining ? <Loader2 size={11} className="animate-spin inline" /> : isMember ? '✓ חבר' : '+ הצטרף'}
              </button>
            </div>
            {group.description && <p className="text-sm text-gray-500 mt-1">{group.description}</p>}
            {memberUids.length > 0 && (
              <p className="text-xs text-gray-400 mt-1 tabular-nums">{memberUids.length} חברים</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {hasFields && (
            <button onClick={() => toggle('info')}
              className={clsx('text-xs font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-[background-color,color] duration-150',
                activePanel === 'info' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}>
              <Info size={12} />
              מידע וקישורים
            </button>
          )}
          {memberUids.length > 0 && (
            <button onClick={handleShowMembers}
              className={clsx('text-xs font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-[background-color,color] duration-150',
                activePanel === 'members' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}>
              <Users size={12} />
              חברים
              {loadingMembers && <Loader2 size={11} className="animate-spin" />}
            </button>
          )}
          {isMember && (
            <button onClick={() => toggle('chat')}
              className={clsx('text-xs font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-[background-color,color] duration-150',
                activePanel === 'chat' ? 'bg-primary-600 text-white' : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
              )}>
              <MessageCircle size={12} />
              צ׳אט
            </button>
          )}
        </div>
      </div>

      {/* ── Panels ── */}

      {activePanel === 'info' && hasFields && (
        <div className="px-5 pb-5 border-t border-gray-50 pt-4">
          <GroupFields fields={group.fields} />
        </div>
      )}

      {activePanel === 'members' && members && (
        <div className="px-5 pb-4 border-t border-gray-50 pt-3">
          {members.length === 0
            ? <p className="text-xs text-gray-400">אין חברים עדיין</p>
            : members.map(m => (
              <button
                key={m.uid}
                onClick={() => setSelectedPerson(m)}
                className="w-full flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-1 px-1 rounded-lg transition-[background-color] duration-150 text-right"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">
                  {m.name?.[0] || '?'}
                </div>
                <span className="flex-1 text-sm font-medium text-gray-700 truncate">{m.name}</span>
                <ChevronLeft size={14} className="text-gray-300 flex-shrink-0" />
              </button>
            ))
          }
        </div>
      )}

      {activePanel === 'chat' && isMember && (
        <div className="px-5 pb-5 border-t border-gray-50 pt-4">
          <GroupChat group={group} user={user} />
        </div>
      )}

      {selectedPerson && (
        <ContactModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
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
          {groups.map(g => <HobbyGroupCard key={g.id} group={g} uid={user.uid} user={user} />)}
        </div>
      )}
    </div>
  )
}
