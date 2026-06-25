import { useState, useEffect } from 'react'
import { getAnnouncements, saveAnnouncement, deleteAnnouncement, getClasses } from '../../lib/db'
import { Megaphone, Plus, Edit2, Trash2, X, Check, Loader2 } from 'lucide-react'
import clsx from 'clsx'

const AUDIENCE_OPTIONS = [
  { value: 'all',         label: 'כולם' },
  { value: 'new_family',  label: 'משפחות חדשות' },
  { value: 'host_family', label: 'משפחות מארחות' },
  { value: 'class',       label: 'כיתה ספציפית' },
]

const blankAnn = () => ({
  id: 'ann-' + Date.now(),
  title: '',
  body: '',
  targetGroups: ['all'],
  classIds: [],
})

function AnnPanel({ ann, isNew, onSave, onClose, allClasses }) {
  const [draft, setDraft] = useState({ ...ann })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (f, v) => setDraft(d => ({ ...d, [f]: v }))

  const currentAudience = draft.targetGroups?.[0] || 'all'
  const setAudience = (val) => {
    set('targetGroups', [val])
    if (val !== 'class') set('classIds', [])
  }
  const toggleClass = (id) => {
    const next = (draft.classIds || []).includes(id)
      ? (draft.classIds || []).filter(c => c !== id)
      : [...(draft.classIds || []), id]
    set('classIds', next)
  }

  const handleSave = async () => {
    if (!draft.title?.trim()) { setError('כותרת היא שדה חובה'); return }
    if (!draft.body?.trim()) { setError('תוכן הוא שדה חובה'); return }
    setSaving(true)
    try {
      await onSave({ ...draft, title: draft.title.trim(), body: draft.body.trim() })
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right dark:bg-gray-800" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100">{isNew ? 'הודעה חדשה' : 'עריכת הודעה'}</h2>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 btn-primary text-sm py-1.5 px-3">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            שמור
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 dark:bg-red-900/20 dark:text-red-400">{error}</div>}

          <div>
            <label className="label">כותרת</label>
            <input value={draft.title || ''} onChange={e => set('title', e.target.value)}
              placeholder="כותרת ההודעה" className="input w-full" />
          </div>

          <div>
            <label className="label">תוכן</label>
            <textarea value={draft.body || ''} onChange={e => set('body', e.target.value)}
              placeholder="תוכן ההודעה..." rows={5} className="input w-full resize-none text-sm" />
          </div>

          <div>
            <label className="label mb-2">קהל יעד</label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setAudience(opt.value)}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                    currentAudience === opt.value
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  )}>
                  {opt.label}
                </button>
              ))}
            </div>
            {currentAudience === 'class' && (
              <div className="mt-2 bg-gray-50 rounded-xl px-4 py-3 space-y-2 max-h-48 overflow-y-auto dark:bg-gray-900">
                {allClasses.length === 0 && <p className="text-sm text-gray-400 text-center py-1">אין כיתות במערכת</p>}
                {allClasses.map(cls => (
                  <label key={cls.id} className="flex items-center justify-end gap-2 cursor-pointer">
                    <span className="text-sm text-gray-700 flex items-center gap-1.5 dark:text-gray-200">
                      {cls.name}
                      <span className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: cls.color || '#1B3B70' }} />
                    </span>
                    <input type="checkbox"
                      checked={(draft.classIds || []).includes(cls.id)}
                      onChange={() => toggleClass(cls.id)}
                      className="w-4 h-4 accent-primary-600" />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

const formatDate = (ts) => {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function AdminAnnouncementsPage({ embedded = false }) {
  const [announcements, setAnnouncements] = useState([])
  const [classes, setClasses] = useState([])
  const [selected, setSelected] = useState(null)
  const [isNew, setIsNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getAnnouncements(), getClasses()])
      .then(([anns, cls]) => { setAnnouncements(anns); setClasses(cls) })
      .catch(err => { console.error('AdminAnnouncementsPage load failed', err); setError('שגיאה בטעינת הנתונים') })
      .finally(() => setLoading(false))
  }, [])

  const classNameMap = Object.fromEntries(classes.map(c => [c.id, c]))

  const handleSave = async (ann) => {
    const saved = await saveAnnouncement(ann)
    setAnnouncements(prev => {
      const idx = prev.findIndex(a => a.id === saved.id)
      return idx >= 0 ? prev.map(a => a.id === saved.id ? saved : a) : [saved, ...prev]
    })
    setSelected(null)
    setIsNew(false)
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await deleteAnnouncement(id)
      setAnnouncements(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      console.error('deleteAnnouncement failed', e)
      setError('שגיאה במחיקה, נסה שוב')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className={embedded ? '' : 'p-4 md:p-6 max-w-3xl mx-auto'} dir="rtl">
      <div className="flex items-center justify-between mb-6">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">הודעות כלליות</h1>
            <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">{announcements.length} הודעות</p>
          </div>
        )}
        {embedded && <p className="text-sm text-gray-500 dark:text-gray-400">{announcements.length} הודעות</p>}
        <button
          onClick={() => { setSelected(blankAnn()); setIsNew(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          הודעה חדשה
        </button>
      </div>

      {error && <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm dark:bg-red-900/20 dark:text-red-300">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-primary-400" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Megaphone size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">אין הודעות עדיין</p>
          <button onClick={() => { setSelected(blankAnn()); setIsNew(true) }}
            className="mt-3 text-sm text-primary-600 hover:underline">
            צור הודעה ראשונה
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(ann => (
            <div key={ann.id} className="bg-white rounded-2xl shadow-card border border-gray-100 p-4 dark:bg-gray-800 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-gray-400">{formatDate(ann.createdAt)}</div>
                    <div className="flex items-center gap-1">
                      {(() => {
                        const tg = ann.targetGroups || ['all']
                        const audience = tg[0]
                        if (audience === 'class' && ann.classIds?.length) {
                          return ann.classIds.map(cid => (
                            <span key={cid} className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{
                                backgroundColor: (classNameMap[cid]?.color || '#1B3B70') + '22',
                                color: classNameMap[cid]?.color || '#1B3B70',
                              }}>
                              {classNameMap[cid]?.name || cid}
                            </span>
                          ))
                        }
                        const audienceLabels = { all: 'כולם', new_family: 'משפחות חדשות', host_family: 'משפחות מארחות' }
                        return (
                          <span className="badge-primary text-xs">
                            {audienceLabels[audience] || 'כולם'}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-800 mt-1 dark:text-gray-100">{ann.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed dark:text-gray-400">{ann.body}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => { setSelected(ann); setIsNew(false) }}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl dark:hover:bg-primary-900/30">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => handleDelete(ann.id)} disabled={deleting === ann.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl dark:hover:bg-red-900/20">
                    {deleting === ann.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <AnnPanel
          ann={selected}
          isNew={isNew}
          onSave={handleSave}
          onClose={() => { setSelected(null); setIsNew(false) }}
          allClasses={classes}
        />
      )}
    </div>
  )
}
