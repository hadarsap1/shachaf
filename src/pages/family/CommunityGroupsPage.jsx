import { useState, useEffect, useRef } from 'react'
import {
  getHobbyGroups, joinHobbyGroup, leaveHobbyGroup, getUsersByUids,
  subscribeGroupChat, sendGroupChatMessage,
  getGroupLinks, addGroupLink, deleteGroupLink,
  getGroupFiles, uploadGroupFile, deleteGroupFile,
  getGroupEvents, createGroupEvent, deleteGroupEvent,
  requestHobbyGroup,
} from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
  Loader2, ExternalLink, ChevronLeft, ChevronDown, MessageCircle,
  Send, Info, Link2, Paperclip, Calendar, Plus, Trash2, FileText, X,
  CheckCircle2, Clock3,
} from 'lucide-react'
import clsx from 'clsx'
import ContactModal from '../../components/ui/ContactModal'

const ICON_MAP = {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
}

const FILE_ICONS = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📑', pptx: '📑', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', mp4: '🎬', mp3: '🎵' }
function fileIcon(name) { return FILE_ICONS[(name || '').split('.').pop()?.toLowerCase()] || '📎' }

// ── Group fields (admin-managed info panel) ───────────────────────────────────
function GroupFields({ fields }) {
  if (!fields?.length) return null
  return (
    <div className="space-y-3">
      {fields.map((f, i) => {
        if (f.type === 'text') return (
          <div key={i}>
            {f.label && <p className="text-xs font-semibold text-gray-500 mb-0.5 dark:text-gray-400">{f.label}</p>}
            <p className="text-sm text-gray-700 whitespace-pre-wrap dark:text-gray-200">{f.value}</p>
          </div>
        )
        if (f.type === 'link') return (
          <div key={i}>
            {f.label && <p className="text-xs font-semibold text-gray-500 mb-0.5 dark:text-gray-400">{f.label}</p>}
            <a
              href={f.value}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-3 py-2 rounded-xl transition-[background-color,color] duration-150 max-w-full dark:bg-primary-900/30"
            >
              <ExternalLink size={13} className="flex-shrink-0" />
              <span className="truncate">{f.label || 'פתח קישור'}</span>
            </a>
          </div>
        )
        if (f.type === 'table' && f.columns?.length) return (
          <div key={i}>
            {f.label && <p className="text-xs font-semibold text-gray-500 mb-1 dark:text-gray-400">{f.label}</p>}
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
              <table className="w-full text-xs" dir="rtl">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>{f.columns.map((c, ci) => <th key={ci} className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {(f.rows || []).map((row, ri) => (
                    <tr key={ri} className="border-t border-gray-100 dark:border-gray-700">
                      {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-gray-700 dark:text-gray-200">{cell}</td>)}
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

// ── Member links & files ──────────────────────────────────────────────────────
function MemberLinks({ groupId, uid, isMember, isAdmin }) {
  const [links, setLinks] = useState(null)
  const [files, setFiles] = useState(null)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl]   = useState('')
  const [savingLink, setSavingLink] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef(null)
  const { user } = useAuth()

  useEffect(() => {
    getGroupLinks(groupId).then(setLinks).catch(() => setLinks([]))
    getGroupFiles(groupId).then(setFiles).catch(() => setFiles([]))
  }, [groupId])

  const handleAddLink = async () => {
    if (!linkUrl.trim()) return
    setSavingLink(true)
    try {
      await addGroupLink(groupId, uid, user.name || '', linkLabel.trim() || linkUrl.trim(), linkUrl.trim())
      const updated = await getGroupLinks(groupId)
      setLinks(updated)
      setLinkLabel(''); setLinkUrl(''); setShowLinkForm(false)
    } finally { setSavingLink(false) }
  }

  const handleDeleteLink = async (id) => {
    await deleteGroupLink(id)
    setLinks(l => l.filter(x => x.id !== id))
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    try {
      await uploadGroupFile(groupId, uid, file, file.name)
      const updated = await getGroupFiles(groupId)
      setFiles(updated)
    } finally {
      setUploadingFile(false)
      e.target.value = ''
    }
  }

  const handleDeleteFile = async (id, path) => {
    await deleteGroupFile(id, path)
    setFiles(f => f.filter(x => x.id !== id))
  }

  const canDelete = (item) => isAdmin || item.uid === uid

  return (
    <div className="space-y-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
      {/* Links */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 flex items-center gap-1 dark:text-gray-400"><Link2 size={12} />קישורים מחברי הקבוצה</p>
          {isMember && (
            <button onClick={() => setShowLinkForm(v => !v)}
              className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-0.5 font-medium">
              <Plus size={12} />הוסף
            </button>
          )}
        </div>

        {showLinkForm && (
          <div className="bg-gray-50 rounded-xl p-3 space-y-2 mb-3 dark:bg-gray-900">
            <input
              value={linkLabel} onChange={e => setLinkLabel(e.target.value)}
              placeholder="תיאור הקישור (אופציונלי)"
              className="w-full input text-sm text-right"
            />
            <input
              value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
              placeholder="כתובת URL"
              dir="ltr"
              className="w-full input text-sm"
              type="url"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowLinkForm(false); setLinkLabel(''); setLinkUrl('') }}
                className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">ביטול</button>
              <button onClick={handleAddLink} disabled={savingLink || !linkUrl.trim()}
                className="text-xs text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-40 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-[background-color] duration-150">
                {savingLink ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}שמור
              </button>
            </div>
          </div>
        )}

        {links === null
          ? <p className="text-xs text-gray-400 text-center py-2"><Loader2 size={13} className="animate-spin inline" /></p>
          : links.length === 0
            ? <p className="text-xs text-gray-400">{isMember ? 'אין קישורים עדיין — הוסיפו ראשונים!' : 'אין קישורים עדיין'}</p>
            : links.map(l => (
              <div key={l.id} className="flex items-center gap-2 py-1.5 group">
                <a href={/^https?:\/\//.test(l.url) ? l.url : '#'} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 min-w-0">
                  <ExternalLink size={13} className="flex-shrink-0" />
                  <span className="truncate">{l.label || l.url}</span>
                </a>
                <span className="text-xs text-gray-400 hidden group-hover:inline flex-shrink-0">{l.postedBy}</span>
                {canDelete(l) && (
                  <button onClick={() => handleDeleteLink(l.id)}
                    className="text-gray-300 hover:text-red-500 flex-shrink-0 transition-[color] duration-150">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))
        }
      </div>

      {/* Files */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 flex items-center gap-1 dark:text-gray-400"><Paperclip size={12} />קבצים מחברי הקבוצה</p>
          {isMember && (
            <>
              <button onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-0.5 font-medium disabled:opacity-40">
                {uploadingFile ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {uploadingFile ? 'מעלה...' : 'העלה'}
              </button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
            </>
          )}
        </div>

        {files === null
          ? <p className="text-xs text-gray-400 text-center py-2"><Loader2 size={13} className="animate-spin inline" /></p>
          : files.length === 0
            ? <p className="text-xs text-gray-400">{isMember ? 'אין קבצים עדיין — העלו ראשונים!' : 'אין קבצים עדיין'}</p>
            : files.map(f => (
              <div key={f.id} className="flex items-center gap-2 py-1.5 group">
                <span className="flex-shrink-0 text-base leading-none">{fileIcon(f.fileName)}</span>
                <a href={f.fileUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 min-w-0 text-sm text-primary-600 hover:text-primary-800 truncate">
                  {f.label || f.fileName}
                </a>
                <span className="text-xs text-gray-400 hidden group-hover:inline flex-shrink-0">{f.postedBy}</span>
                {canDelete(f) && (
                  <button onClick={() => handleDeleteFile(f.id, f.filePath)}
                    className="text-gray-300 hover:text-red-500 flex-shrink-0 transition-[color] duration-150">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))
        }
      </div>
    </div>
  )
}

// ── Group events ──────────────────────────────────────────────────────────────
function GroupEvents({ groupId, uid, isMember, isAdmin }) {
  const [events, setEvents] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', date: '', time: '', location: '', description: '' })

  useEffect(() => {
    getGroupEvents(groupId).then(setEvents).catch(() => setEvents([]))
  }, [groupId])

  const handleCreate = async () => {
    if (!form.title.trim() || !form.date) return
    setSaving(true)
    try {
      await createGroupEvent(groupId, uid, form)
      const updated = await getGroupEvents(groupId)
      setEvents(updated)
      setForm({ title: '', date: '', time: '', location: '', description: '' })
      setShowForm(false)
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    await deleteGroupEvent(id)
    setEvents(ev => ev.filter(e => e.id !== id))
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-3">
      {isMember && (
        <div className="flex justify-end">
          <button onClick={() => setShowForm(v => !v)}
            className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium">
            <Plus size={12} />צור אירוע קבוצתי
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 border border-gray-100 dark:bg-gray-900 dark:border-gray-700">
          <input value={form.title} onChange={set('title')} placeholder="שם האירוע *" className="w-full input text-sm text-right" />
          <div className="flex gap-2">
            <input value={form.date} onChange={set('date')} type="date" className="flex-1 input text-sm" />
            <input value={form.time} onChange={set('time')} type="time" className="w-28 input text-sm" />
          </div>
          <input value={form.location} onChange={set('location')} placeholder="מיקום (אופציונלי)" className="w-full input text-sm text-right" />
          <textarea value={form.description} onChange={set('description')} placeholder="תיאור (אופציונלי)" rows={2}
            className="w-full input text-sm text-right resize-none" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">ביטול</button>
            <button onClick={handleCreate} disabled={saving || !form.title.trim() || !form.date}
              className="text-xs text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-40 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-[background-color] duration-150">
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}שמור
            </button>
          </div>
        </div>
      )}

      {events === null
        ? <p className="text-xs text-gray-400 text-center py-4"><Loader2 size={16} className="animate-spin inline" /></p>
        : events.length === 0
          ? <p className="text-xs text-gray-400 text-center py-3">{isMember ? 'אין אירועים עדיין — צרו ראשונים!' : 'אין אירועים עדיין'}</p>
          : events.map(ev => {
            const d = new Date(ev.date)
            const canDel = isAdmin || ev.createdBy === uid
            return (
              <div key={ev.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-white group dark:bg-gray-800 dark:border-gray-700">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary-50 flex flex-col items-center justify-center text-primary-700 dark:text-primary-300 dark:bg-primary-900/30">
                  <span className="text-xs font-bold tabular-nums leading-tight">{d.getDate()}</span>
                  <span className="text-[10px] leading-tight">{d.toLocaleDateString('he-IL', { month: 'short' })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{ev.title}</p>
                  {ev.time && <p className="text-xs text-gray-500 tabular-nums dark:text-gray-400">{ev.time}</p>}
                  {ev.location && <p className="text-xs text-gray-500 truncate dark:text-gray-400">{ev.location}</p>}
                  {ev.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{ev.description}</p>}
                </div>
                {canDel && (
                  <button onClick={() => handleDelete(ev.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 flex-shrink-0 transition-[color,opacity] duration-150">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )
          })
      }
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
                isMe ? 'bg-primary-600 text-white rounded-tl-sm' : 'bg-gray-100 text-gray-800 rounded-tr-sm dark:bg-gray-700 dark:text-gray-100'
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
function HobbyGroupCard({ group, uid, user, isAdmin }) {
  const [memberUids, setMemberUids] = useState(group.memberUids || [])
  const [joining, setJoining] = useState(false)
  const [activePanel, setActivePanel] = useState(null)
  const [members, setMembers] = useState(null)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState(null)
  const Icon = ICON_MAP[group.icon] || Users

  const isMember = memberUids.includes(uid)
  const hasAdminFields = group.fields?.length > 0

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
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: (group.color || '#1B3B70') + '20' }}>
            <Icon size={22} style={{ color: group.color || '#1B3B70' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-gray-800 dark:text-gray-100">{group.name}</h3>
              <button
                onClick={handleJoin}
                disabled={joining}
                className={clsx(
                  'flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full transition-[background-color,color] duration-150',
                  isMember
                    ? 'bg-primary-100 text-primary-700 hover:bg-red-50 hover:text-red-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-primary-50 hover:text-primary-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-primary-900/30 dark:hover:text-primary-300'
                )}
              >
                {joining ? <Loader2 size={11} className="animate-spin inline" /> : isMember ? '✓ חבר' : '+ הצטרף'}
              </button>
            </div>
            {group.description && <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">{group.description}</p>}
            {memberUids.length > 0 && (
              <p className="text-xs text-gray-400 mt-1 tabular-nums">{memberUids.length} חברים</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {(hasAdminFields || isMember) && (
            <button onClick={() => toggle('info')}
              className={clsx('text-xs font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-[background-color,color] duration-150',
                activePanel === 'info' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              )}>
              <Info size={12} />
              מידע וקישורים
            </button>
          )}
          <button onClick={() => toggle('events')}
            className={clsx('text-xs font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-[background-color,color] duration-150',
              activePanel === 'events' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            )}>
            <Calendar size={12} />
            אירועים
          </button>
          {memberUids.length > 0 && (
            <button onClick={handleShowMembers}
              className={clsx('text-xs font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-[background-color,color] duration-150',
                activePanel === 'members' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
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

      {activePanel === 'info' && (
        <div className="px-5 pb-5 border-t border-gray-50 pt-4 space-y-3">
          {hasAdminFields && <GroupFields fields={group.fields} />}
          <MemberLinks groupId={group.id} uid={uid} isMember={isMember} isAdmin={isAdmin} />
        </div>
      )}

      {activePanel === 'events' && (
        <div className="px-5 pb-5 border-t border-gray-50 pt-4">
          <GroupEvents groupId={group.id} uid={uid} isMember={isMember} isAdmin={isAdmin} />
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
                className="w-full flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-1 px-1 rounded-lg transition-[background-color] duration-150 text-right dark:hover:bg-gray-700/50"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0 dark:bg-gray-800 dark:text-gray-400">
                  {m.name?.[0] || '?'}
                </div>
                <span className="flex-1 text-sm font-medium text-gray-700 truncate dark:text-gray-200">{m.name}</span>
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

// ── Request new group ─────────────────────────────────────────────────────────
function RequestGroupPanel({ onClose, onRequested }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await requestHobbyGroup({ name: name.trim(), description: description.trim(), requestedBy: user.uid, requestedByName: user.name || '' })
      setDone(true)
      onRequested?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-gray-800 z-50 flex flex-col animate-slide-from-right" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100">בקשה להקמת קבוצה חדשה</h2>
        </div>
        {done ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 size={26} className="text-green-600 dark:text-green-400" />
            </div>
            <p className="font-bold text-gray-800 dark:text-gray-100">הבקשה נשלחה!</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">מנהל הקהילה יבדוק את הבקשה ויאשר אותה בהקדם</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1 text-right">שם הקבוצה</label>
              <input value={name} onChange={e => setName(e.target.value)} required
                className="input w-full text-right" placeholder="לדוגמה: חובבי טיולים" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1 text-right">מה הקבוצה תעשה?</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={4} className="input w-full text-right text-sm resize-none leading-relaxed" placeholder="תארו את מטרת הקבוצה..." />
            </div>
            <button type="submit" disabled={saving || !name.trim()}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {saving ? 'שולח...' : 'שליחת בקשה'}
            </button>
          </form>
        )}
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function CommunityGroupsPage() {
  const { user, isAdmin } = useAuth()
  const [groups, setGroups]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showRequest, setShowRequest] = useState(false)

  useEffect(() => {
    getHobbyGroups().then(setGroups).finally(() => setLoading(false))
  }, [])

  const activeGroups = groups.filter(g => g.status !== 'pending')
  const myPending = groups.filter(g => g.status === 'pending' && g.requestedBy === user?.uid)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" dir="rtl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <button onClick={() => setShowRequest(true)}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors flex-shrink-0">
          <Plus size={15} />
          בקש קבוצה חדשה
        </button>
        <div className="text-right">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 justify-end dark:text-white">
            קבוצות קהילה
            <span className="text-2xl leading-none">🤝</span>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">הצטרפו לקבוצות לפי תחומי עניין</p>
        </div>
      </div>

      {myPending.length > 0 && (
        <div className="mb-4 space-y-2">
          {myPending.map(g => (
            <div key={g.id} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm justify-end">
              הבקשה שלך ל"{g.name}" ממתינה לאישור מנהל
              <Clock3 size={15} className="flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary-400" /></div>
      ) : activeGroups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Heart size={44} className="mx-auto mb-4 opacity-25" />
          <p className="font-semibold text-gray-500 dark:text-gray-400">אין קבוצות קהילה עדיין</p>
          <p className="text-sm mt-1">הנהלת הקהילה תפתח קבוצות בהתאם לתחומי העניין</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeGroups.map(g => <HobbyGroupCard key={g.id} group={g} uid={user.uid} user={user} isAdmin={isAdmin} />)}
        </div>
      )}

      {showRequest && (
        <RequestGroupPanel
          onClose={() => setShowRequest(false)}
          onRequested={() => getHobbyGroups().then(setGroups)}
        />
      )}
    </div>
  )
}
