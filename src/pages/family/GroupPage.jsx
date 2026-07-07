import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'
import {
  subscribeGroupMessages, sendGroupMessage, deleteGroupMessage,
  getGroupEvents, addGroupEvent, deleteGroupEvent,
  uploadGroupFile, joinHobbyGroup, leaveHobbyGroup,
  fetchGroupMembers, getClasses,
} from '../../lib/db'
import {
  ArrowRight, MessageCircle, Calendar, FolderOpen, Info,
  Send, Paperclip, Trash2, Plus, X, CheckCircle2,
  Loader2, Users, ExternalLink, Image as ImageIcon, File,
  Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
  MapPin, Phone, Mail, GraduationCap,
} from 'lucide-react'
import clsx from 'clsx'

const ICON_MAP = {
  Users, Heart, Star, Music, Book, Globe, Zap, Gift,
  Coffee, Briefcase, Camera, Sun, Leaf, Palette, Flag, Shield,
}

function linkLabel(field) {
  if (field.label) return field.label
  try {
    const url = new URL(field.value)
    if (url.hostname.includes('docs.google.com'))  return 'Google Drive'
    if (url.hostname.includes('wa.me') || url.hostname.includes('whatsapp')) return 'WhatsApp'
    if (url.hostname.includes('t.me'))             return 'Telegram'
    return url.hostname.replace(/^www\./, '')
  } catch {
    return 'פתח קישור'
  }
}

function formatTime(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Chat Tab ──────────────────────────────────────────────────────────────

function ChatTab({ groupId, user }) {
  const { t } = useLang()
  const noMsgsLabel = t('groupPage', 'noMessages')
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    const unsub = subscribeGroupMessages(groupId, setMessages)
    return unsub
  }, [groupId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const content = text.trim()
    if (!content) return
    setSending(true)
    setText('')
    try {
      await sendGroupMessage(groupId, {
        senderId: user.uid,
        senderName: user.name || user.email,
        senderAvatar: user.avatar || '',
        content,
        type: 'text',
      })
    } finally {
      setSending(false)
    }
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    try {
      const { url, fileName, fileSize, fileType } = await uploadGroupFile(groupId, file)
      const isImage = fileType.startsWith('image/')
      await sendGroupMessage(groupId, {
        senderId: user.uid,
        senderName: user.name || user.email,
        senderAvatar: user.avatar || '',
        content: fileName,
        type: isImage ? 'image' : 'file',
        fileUrl: url,
        fileName,
        fileSize,
        fileType,
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (msg) => {
    if (msg.senderId !== user.uid) return
    await deleteGroupMessage(groupId, msg.id)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <MessageCircle size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{noMsgsLabel}</p>
          </div>
        )}
        {messages.map(msg => {
          const isOwn = msg.senderId === user.uid
          return (
            <div key={msg.id} className={clsx('flex items-end gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}>
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 flex-shrink-0">
                {msg.senderAvatar
                  ? <img src={msg.senderAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                  : (msg.senderName?.[0] || '?')
                }
              </div>

              {/* Bubble */}
              <div className={clsx('max-w-[72%] group relative', isOwn ? 'items-end' : 'items-start')}>
                {!isOwn && <p className="text-[10px] text-gray-400 mb-0.5 px-1">{msg.senderName}</p>}
                <div className={clsx(
                  'rounded-2xl px-3 py-2 text-sm',
                  isOwn ? 'bg-primary-600 text-white rounded-tl-sm' : 'bg-gray-100 text-gray-800 rounded-tr-sm dark:bg-gray-700 dark:text-gray-100'
                )}>
                  {msg.type === 'image' && msg.fileUrl ? (
                    <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                      <img src={msg.fileUrl} alt={msg.fileName} className="max-w-full rounded-xl max-h-48 object-cover" />
                    </a>
                  ) : msg.type === 'file' && msg.fileUrl ? (
                    <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                      className={clsx('flex items-center gap-2 hover:underline', isOwn ? 'text-white' : 'text-primary-600')}>
                      <File size={14} />
                      <span>{msg.fileName}</span>
                    </a>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  )}
                </div>
                <div className={clsx('flex items-center gap-1 mt-0.5 px-1', isOwn ? 'flex-row-reverse' : 'flex-row')}>
                  <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>
                  {isOwn && (
                    <button onClick={() => handleDelete(msg)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity">
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-2 bg-white">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
          className="hidden"
          onChange={handleFile}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="p-2 text-gray-400 hover:text-primary-600 rounded-xl hover:bg-primary-50 transition-colors flex-shrink-0"
        >
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
        </button>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          placeholder={t('groupPage', 'msgPlaceholder')}
          dir="rtl"
          className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="p-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors flex-shrink-0"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  )
}

// ── Events Tab ────────────────────────────────────────────────────────────

function EventsTab({ groupId, user }) {
  const { t } = useLang()
  const [events, setEvents]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ title: '', date: '', time: '', location: '', description: '' })
  const [saving, setSaving]     = useState(false)

  const load = () => {
    setLoading(true)
    getGroupEvents(groupId).then(setEvents).finally(() => setLoading(false))
  }
  useEffect(load, [groupId])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.date) return
    setSaving(true)
    try {
      const dateTime = form.time ? new Date(`${form.date}T${form.time}`) : new Date(`${form.date}T00:00`)
      await addGroupEvent(groupId, {
        title: form.title.trim(),
        date: dateTime,
        description: form.description.trim(),
        location: form.location.trim(),
        createdBy: user.uid,
      })
      setForm({ title: '', date: '', time: '', location: '', description: '' })
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (eventId, createdBy) => {
    if (createdBy !== user.uid) return
    await deleteGroupEvent(groupId, eventId)
    setEvents(es => es.filter(e => e.id !== eventId))
  }

  const now = new Date()

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-3">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-800 dark:text-gray-100">{t('groupPage', 'groupEvents')}</h3>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-sm bg-primary-600 text-white px-3 py-1.5 rounded-xl hover:bg-primary-700 transition-colors">
          <Plus size={14} /> {t('groupPage', 'newEvent')}
        </button>
      </div>

      {/* Add event form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-primary-50 border border-primary-100 rounded-2xl p-4 mb-4 space-y-3">
          <h4 className="font-semibold text-primary-800 text-sm">{t('groupPage', 'addEvent')}</h4>
          <input
            required
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder={t('groupPage', 'eventName')}
            className="input w-full text-right text-sm"
            dir="rtl"
          />
          <div className="flex gap-2">
            <input
              required
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="input flex-1 text-sm"
              dir="ltr"
            />
            <input
              type="time"
              value={form.time}
              onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
              className="input flex-1 text-sm"
              dir="ltr"
            />
          </div>
          <input
            value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder={t('groupPage', 'locationOpt')}
            className="input w-full text-right text-sm"
            dir="rtl"
          />
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder={t('groupPage', 'descOpt')}
            rows={2}
            className="input w-full text-right text-sm resize-none"
            dir="rtl"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {t('groupPage', 'add')}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
              {t('groupPage', 'cancel')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary-400" /></div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Calendar size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t('groupPage', 'noEvents')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(ev => {
            const d = ev.date?.toDate ? ev.date.toDate() : ev.date ? new Date(ev.date) : null
            const isPast = d && d < now
            return (
              <div key={ev.id} className={clsx('bg-white border rounded-2xl p-4', isPast ? 'border-gray-100 opacity-60' : 'border-primary-100')}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-100">{ev.title}</h4>
                    {d && (
                      <p className="text-xs text-primary-600 flex items-center gap-1 mt-1">
                        <Calendar size={11} /> {formatDate(ev.date)}
                      </p>
                    )}
                    {ev.location && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 dark:text-gray-400">
                        <MapPin size={11} /> {ev.location}
                      </p>
                    )}
                    {ev.description && <p className="text-sm text-gray-600 mt-2 dark:text-gray-300">{ev.description}</p>}
                  </div>
                  {ev.createdBy === user.uid && (
                    <button onClick={() => handleDelete(ev.id, ev.createdBy)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Files Tab ─────────────────────────────────────────────────────────────

function FilesTab({ groupId, user }) {
  const { t } = useLang()
  const [messages, setMessages] = useState([])

  useEffect(() => {
    const unsub = subscribeGroupMessages(groupId, msgs => {
      setMessages(msgs.filter(m => m.type === 'image' || m.type === 'file'))
    })
    return unsub
  }, [groupId])

  const images = messages.filter(m => m.type === 'image')
  const files  = messages.filter(m => m.type === 'file')

  if (messages.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <FolderOpen size={44} className="mb-3 opacity-25" />
      <p className="text-sm">{t('groupPage', 'noFiles')}</p>
      <p className="text-xs mt-1">{t('groupPage', 'noFilesSub')}</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-3">
      {images.length > 0 && (
        <div className="mb-5">
          <h3 className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-1 dark:text-gray-200">
            <ImageIcon size={14} /> {t('groupPage', 'images').replace('{count}', images.length)}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {images.map(m => (
              <a key={m.id} href={m.fileUrl} target="_blank" rel="noopener noreferrer"
                className="aspect-square rounded-xl overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity">
                <img src={m.fileUrl} alt={m.fileName} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-1 dark:text-gray-200">
            <File size={14} /> {t('groupPage', 'files').replace('{count}', files.length)}
          </h3>
          <div className="space-y-2">
            {files.map(m => (
              <a key={m.id} href={m.fileUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:border-primary-200 transition-colors">
                <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <File size={16} className="text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate dark:text-gray-100">{m.fileName}</p>
                  {m.fileSize && <p className="text-xs text-gray-400">{(m.fileSize / 1024).toFixed(0)} KB</p>}
                </div>
                <ExternalLink size={14} className="text-gray-400 flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Info Tab ──────────────────────────────────────────────────────────────

function GroupFields({ fields }) {
  if (!fields?.length) return null
  return (
    <div className="space-y-4">
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
            <a href={f.value} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline">
              <ExternalLink size={13} /> {linkLabel(f)}
            </a>
          </div>
        )
        if (f.type === 'table' && f.columns?.length) return (
          <div key={i}>
            {f.label && <p className="text-xs font-semibold text-gray-500 mb-1 dark:text-gray-400">{f.label}</p>}
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>{f.columns.map((c, ci) => <th key={ci} className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {(f.rows || []).map((row, ri) => (
                    <tr key={ri} className="border-t border-gray-100">
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

function MemberCard({ member, classMap }) {
  const classes = (member.classIds || [])
    .map(id => classMap[id])
    .filter(Boolean)

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700 flex-shrink-0 overflow-hidden">
          {member.avatar
            ? <img src={member.avatar} alt="" className="w-full h-full object-cover" />
            : (member.name?.[0] || '?')
          }
        </div>

        {/* Name + classes */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm dark:text-gray-100">{member.name || '—'}</p>
          {classes.length > 0 && (
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 dark:text-gray-400">
              <GraduationCap size={11} />
              {classes.join(' • ')}
            </p>
          )}
        </div>
      </div>

      {/* Contact */}
      <div className="mt-3 flex flex-wrap gap-3">
        {member.phone && (
          <a href={`tel:${member.phone}`} dir="ltr"
            className="flex items-center gap-1.5 text-xs text-primary-600 hover:underline">
            <Phone size={12} /> {member.phone}
          </a>
        )}
        {member.email && (
          <a href={`mailto:${member.email}`}
            className="flex items-center gap-1.5 text-xs text-primary-600 hover:underline">
            <Mail size={12} /> {member.email}
          </a>
        )}
      </div>
    </div>
  )
}

function InfoTab({ group, user, onToggle, toggling }) {
  const { t } = useLang()
  const isMember  = (group.memberUids || []).includes(user.uid)
  const [members, setMembers]   = useState([])
  const [classMap, setClassMap] = useState({})
  const [loadingMembers, setLoadingMembers] = useState(false)

  useEffect(() => {
    if (!isMember || !(group.memberUids?.length)) return
    setLoadingMembers(true)
    Promise.all([
      fetchGroupMembers(group.memberUids),
      getClasses(),
    ]).then(([mems, classes]) => {
      setMembers(mems)
      setClassMap(Object.fromEntries(classes.map(c => [c.id, c.name])))
    }).finally(() => setLoadingMembers(false))
  }, [group.memberUids, isMember])

  return (
    <div className="overflow-y-auto px-4 py-4 space-y-5">
      {group.description && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 mb-1.5 dark:text-gray-400">{t('groupPage', 'description')}</h3>
          <p className="text-sm text-gray-700 leading-relaxed dark:text-gray-200">{group.description}</p>
        </div>
      )}

      {group.fields?.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 mb-2 dark:text-gray-400">{t('groupPage', 'linksInfo')}</h3>
          <GroupFields fields={group.fields} />
        </div>
      )}

      {/* Member list */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1 dark:text-gray-400">
          <Users size={12} /> {t('groupPage', 'groupMembers').replace('{count}', (group.memberUids || []).length)}
        </h3>

        {!isMember ? (
          <p className="text-sm text-gray-400">{t('groupPage', 'joinToSee')}</p>
        ) : loadingMembers ? (
          <div className="flex justify-center py-4">
            <Loader2 size={20} className="animate-spin text-primary-400" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-400">{t('groupPage', 'noMembers')}</p>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <MemberCard key={m.id} member={m} classMap={classMap} />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onToggle}
        disabled={toggling}
        className={clsx(
          'w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
          isMember
            ? 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-red-900/20 dark:hover:text-red-400'
            : 'bg-primary-600 text-white hover:bg-primary-700'
        )}
      >
        {toggling ? <Loader2 size={16} className="animate-spin" /> : isMember ? t('community', 'leave') : t('community', 'join')}
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function GroupPage() {
  const { groupId } = useParams()
  const navigate    = useNavigate()
  const { user }    = useAuth()
  const { t }       = useLang()

  const TABS = [
    { key: 'chat',   label: t('groupPage', 'tabChat'),   icon: MessageCircle },
    { key: 'events', label: t('groupPage', 'tabEvents'), icon: Calendar },
    { key: 'files',  label: t('groupPage', 'tabFiles'),  icon: FolderOpen },
    { key: 'info',   label: t('groupPage', 'tabInfo'),   icon: Info },
  ]

  const [group,    setGroup]   = useState(null)
  const [loading,  setLoading] = useState(true)
  const [tab,      setTab]     = useState('chat')
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'hobbyGroups', groupId)).then(snap => {
      if (snap.exists()) setGroup({ id: snap.id, ...snap.data() })
    }).finally(() => setLoading(false))
  }, [groupId])

  const handleToggle = async () => {
    if (!group) return
    const isMember = (group.memberUids || []).includes(user.uid)
    setToggling(true)
    try {
      if (isMember) {
        await leaveHobbyGroup(group.id, user.uid)
        setGroup(g => ({ ...g, memberUids: (g.memberUids || []).filter(u => u !== user.uid) }))
      } else {
        await joinHobbyGroup(group.id, user.uid)
        setGroup(g => ({ ...g, memberUids: [...(g.memberUids || []), user.uid] }))
      }
    } finally {
      setToggling(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="animate-spin text-primary-400" />
    </div>
  )
  if (!group) return (
    <div className="text-center py-16 text-gray-400" dir="rtl">
      <p>{t('groupPage', 'notFound')}</p>
    </div>
  )

  const Icon     = ICON_MAP[group.icon] || Users
  const isMember = (group.memberUids || []).includes(user.uid)

  return (
    <div className="flex flex-col h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/community')}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 flex-shrink-0 dark:text-gray-300">
            <ArrowRight size={18} />
          </button>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: (group.color || '#1B3B70') + '20' }}>
            <Icon size={18} style={{ color: group.color || '#1B3B70' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-gray-900 text-base leading-tight dark:text-gray-100">{group.name}</h1>
              {isMember && (
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                  {t('groupPage', 'member')}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              <Users size={10} className="inline mr-0.5" /> {t('community', 'members').replace('{count}', (group.memberUids || []).length)}
            </p>
          </div>
          {!isMember && (
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-xl hover:bg-primary-700 disabled:opacity-60 flex-shrink-0 flex items-center gap-1"
            >
              {toggling ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              {t('groupPage', 'join')}
            </button>
          )}
        </div>

        {/* Non-member banner */}
        {!isMember && (
          <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700 text-center">
            {t('groupPage', 'joinBanner')}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex">
          {TABS.map(({ key, label, icon: TabIcon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={clsx(
                'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors border-b-2',
                tab === key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-300'
              )}
            >
              <TabIcon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'chat'   && <ChatTab   groupId={groupId} user={user} />}
        {tab === 'events' && <EventsTab groupId={groupId} user={user} />}
        {tab === 'files'  && <FilesTab  groupId={groupId} user={user} />}
        {tab === 'info'   && (
          <div className="h-full overflow-y-auto">
            <InfoTab group={group} user={user} onToggle={handleToggle} toggling={toggling} />
          </div>
        )}
      </div>
    </div>
  )
}
