import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getBusinesses, saveBusiness, deleteBusiness, uploadBusinessImage, getUsersByUids } from '../../lib/db'
import { Plus, Search, Phone, Globe, Mail, Pencil, Trash2, X, Check, Loader2, ImagePlus, Store } from 'lucide-react'
import clsx from 'clsx'

const CATEGORIES = [
  { value: 'all',           label: 'הכל' },
  { value: 'food',          label: '🍕 מזון ומשקאות' },
  { value: 'health',        label: '💪 בריאות וספורט' },
  { value: 'education',     label: '📚 חינוך והדרכה' },
  { value: 'home',          label: '🏠 בית וגינה' },
  { value: 'tech',          label: '💻 טכנולוגיה' },
  { value: 'beauty',        label: '💅 יופי וטיפוח' },
  { value: 'transport',     label: '🚗 תחבורה' },
  { value: 'art',           label: '🎨 אמנות ויצירה' },
  { value: 'entertainment', label: '🎉 בידור ואירועים' },
  { value: 'consulting',    label: '🤝 ייעוץ ושירותים מקצועיים' },
  { value: 'legal',         label: '⚖️ משפטים וחשבונאות' },
  { value: 'pets',          label: '🐾 חיות מחמד' },
  { value: 'fashion',       label: '👗 אופנה וביגוד' },
  { value: 'other',         label: '✨ אחר / כתוב בעצמך' },
]

const CAT_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))

function blank(uid, name) {
  return { id: 'biz-' + Date.now(), uid, ownerName: name || '', businessName: '', category: 'other', description: '', phone: '', email: '', website: '', imageUrl: '', imagePath: '' }
}

// ── Business form (slide panel) ────────────────────────────────────────────────
function BusinessForm({ draft, setDraft, onSave, onClose, saving }) {
  const fileRef = useRef()
  const [uploading, setUploading] = useState(false)

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))

  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { url, path } = await uploadBusinessImage(draft.id, file)
      setDraft(d => ({ ...d, imageUrl: url, imagePath: path }))
    } finally { setUploading(false) }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right dark:bg-gray-800" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Store size={16} className="text-primary-600" />
            {draft.id.startsWith('biz-') ? 'הוספת עסק' : 'עריכת עסק'}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Image */}
          <div>
            <div
              onClick={() => fileRef.current?.click()}
              className="relative w-full h-36 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-primary-400 transition-colors overflow-hidden bg-gray-50 dark:bg-gray-700"
            >
              {draft.imageUrl
                ? <img src={draft.imageUrl} alt="" className="absolute inset-0 w-full h-full object-contain p-2" />
                : uploading
                  ? <Loader2 size={24} className="animate-spin text-primary-400" />
                  : <div className="flex flex-col items-center gap-1 text-gray-400">
                      <ImagePlus size={28} />
                      <span className="text-xs">הוסף תמונה</span>
                    </div>
              }
              {draft.imageUrl && !uploading && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-2xl">
                  <ImagePlus size={24} className="text-white" />
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          </div>

          <div>
            <label className="label block mb-1 text-right">שם העסק *</label>
            <input value={draft.businessName} onChange={e => set('businessName', e.target.value)}
              className="input w-full text-right" placeholder="למשל: חנות האופניים של יוסי" />
          </div>

          <div>
            <label className="label block mb-1 text-right">קטגוריה</label>
            <select value={draft.category} onChange={e => set('category', e.target.value)}
              className="input w-full text-right">
              {CATEGORIES.filter(c => c.value !== 'all').map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {draft.category === 'other' && (
              <input value={draft.customCategory || ''} onChange={e => set('customCategory', e.target.value)}
                className="input w-full text-right mt-2" placeholder="כתוב את הקטגוריה שלך..." />
            )}
          </div>

          <div>
            <label className="label block mb-1 text-right">תיאור</label>
            <textarea value={draft.description} onChange={e => set('description', e.target.value)}
              rows={3} className="input w-full text-right resize-none"
              placeholder="ספרו על העסק שלכם, מה אתם מציעים..." />
          </div>

          <div>
            <label className="label block mb-1 text-right">טלפון</label>
            <input value={draft.phone} onChange={e => set('phone', e.target.value)}
              className="input w-full" dir="ltr" placeholder="050-0000000" type="tel" />
          </div>

          <div>
            <label className="label block mb-1 text-right">אימייל</label>
            <input value={draft.email} onChange={e => set('email', e.target.value)}
              className="input w-full" dir="ltr" placeholder="business@email.com" type="email" />
          </div>

          <div>
            <label className="label block mb-1 text-right">אתר / אינסטגרם</label>
            <input value={draft.website} onChange={e => set('website', e.target.value)}
              className="input w-full" dir="ltr" placeholder="https://..." />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => onSave(draft)}
            disabled={saving || !draft.businessName.trim()}
            className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            שמור
          </button>
        </div>
      </div>
    </>
  )
}

// ── Business card ──────────────────────────────────────────────────────────────
function BusinessCard({ biz, owner, isOwner, isAdmin, onEdit, onDelete }) {
  const phone = (biz.phone || '').replace(/\D/g, '')
  const wa = phone ? `https://wa.me/${phone.startsWith('972') ? phone : '972' + phone.replace(/^0/, '')}` : null
  const ownerPhone = (owner?.phone || '').replace(/\D/g, '')
  const ownerWa = ownerPhone ? `https://wa.me/${ownerPhone.startsWith('972') ? ownerPhone : '972' + ownerPhone.replace(/^0/, '')}` : null
  const isUrl = s => typeof s === 'string' && s.startsWith('http')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-card overflow-hidden">
      {biz.imageUrl && (
        <img src={biz.imageUrl} alt={biz.businessName} className="w-full h-40 object-cover" />
      )}
      <div className="p-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex gap-1">
            {(isOwner || isAdmin) && (
              <>
                <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors">
                  <Pencil size={14} />
                </button>
                <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
          <div className="text-right flex-1">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 leading-tight">{biz.businessName}</h3>
            <span className="text-xs text-gray-400">{biz.category === 'other' && biz.customCategory ? biz.customCategory : (CAT_LABEL[biz.category] || biz.category)}</span>
          </div>
        </div>

        {biz.description && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed text-right line-clamp-3">
            {biz.description}
          </p>
        )}

        {/* Business contact buttons */}
        <div className="flex flex-wrap gap-2 mt-3 justify-end">
          {biz.phone && (
            <a href={wa || `tel:${biz.phone}`} target={wa ? '_blank' : undefined} rel="noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors dark:bg-green-900/20 dark:text-green-300">
              <Phone size={12} />
              {biz.phone}
            </a>
          )}
          {biz.website && (
            <a href={biz.website.startsWith('http') ? biz.website : 'https://' + biz.website}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition-colors dark:bg-primary-900/20 dark:text-primary-300">
              <Globe size={12} />
              אתר
            </a>
          )}
          {biz.email && (
            <a href={`mailto:${biz.email}`}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors dark:bg-gray-700 dark:text-gray-300">
              <Mail size={12} />
              מייל
            </a>
          )}
        </div>

        {/* Owner section */}
        <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            {owner?.phone && (
              <a href={ownerWa || `tel:${owner.phone}`} target={ownerWa ? '_blank' : undefined} rel="noreferrer"
                className="text-xs text-primary-600 hover:underline" dir="ltr">
                {owner.phone}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{owner?.name || biz.ownerName}</p>
              {owner?.address && <p className="text-xs text-gray-400">{owner.address}</p>}
            </div>
            {isUrl(owner?.avatar)
              ? <img src={owner.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-100 flex-shrink-0" />
              : <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-sm font-bold text-primary-600 flex-shrink-0">
                  {(owner?.name || biz.ownerName || '?')[0]}
                </div>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function BusinessDirectoryPage() {
  const { user, isSuperAdmin } = useAuth()
  const [businesses, setBusinesses] = useState([])
  const [owners, setOwners] = useState({}) // uid → user profile
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getBusinesses().then(async data => {
      setBusinesses(data)
      const uids = [...new Set(data.map(b => b.uid).filter(Boolean))]
      if (uids.length) {
        const profiles = await getUsersByUids(uids).catch(() => [])
        setOwners(Object.fromEntries(profiles.map(p => [p.uid, p])))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = businesses.filter(b => {
    const matchCat = category === 'all' || b.category === category
    const q = search.toLowerCase()
    const matchSearch = !q || b.businessName?.toLowerCase().includes(q) ||
      b.description?.toLowerCase().includes(q) || b.ownerName?.toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  const myBiz = businesses.find(b => b.uid === user?.uid)

  const handleSave = async (draft) => {
    setSaving(true)
    try {
      const saved = await saveBusiness(draft)
      setBusinesses(prev => {
        const exists = prev.find(b => b.id === saved.id)
        return exists ? prev.map(b => b.id === saved.id ? saved : b) : [saved, ...prev]
      })
      setEditing(null)
    } catch (err) {
      console.error('saveBusiness error', err)
      alert('שגיאה בשמירה: ' + (err?.message || err))
    } finally { setSaving(false) }
  }

  const handleDelete = async (biz) => {
    if (!confirm(`למחוק את "${biz.businessName}"?`)) return
    await deleteBusiness(biz.id)
    setBusinesses(prev => prev.filter(b => b.id !== biz.id))
  }

  return (
    <div className="page-container rtl" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3">
        <button
          onClick={() => setEditing(myBiz ? { ...myBiz } : blank(user.uid, user.name))}
          className="flex items-center gap-2 btn-primary px-4 py-2 text-sm flex-shrink-0"
        >
          <Plus size={16} />
          {myBiz ? 'ערוך עסק שלי' : 'הוסף עסק'}
        </button>
        <div className="text-right">
          <h1 className="text-xl font-black text-primary-800 dark:text-primary-300 flex items-center gap-2 justify-end">
            <span className="text-2xl leading-none">🏪</span>
            עסקים בקהילה
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">{businesses.length} עסקים</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש עסק, תחום..."
          className="input w-full pe-10 text-right" />
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
        {CATEGORIES.filter(c => c.value !== 'other').map(c => (
          <button key={c.value} onClick={() => setCategory(c.value)}
            className={clsx(
              'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              category === c.value
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-300'
            )}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-primary-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Store size={44} className="mx-auto mb-4 opacity-25" />
          <p className="font-semibold text-gray-500 dark:text-gray-400">
            {search || category !== 'all' ? 'לא נמצאו עסקים תואמים' : 'אין עסקים עדיין'}
          </p>
          <p className="text-sm mt-1">היו הראשונים לפרסם את העסק שלכם בקהילה!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map(biz => (
            <BusinessCard
              key={biz.id}
              biz={biz}
              owner={owners[biz.uid]}
              isOwner={biz.uid === user?.uid}
              isAdmin={isSuperAdmin}
              onEdit={() => setEditing({ ...biz })}
              onDelete={() => handleDelete(biz)}
            />
          ))}
        </div>
      )}

      {editing && (
        <BusinessForm
          draft={editing}
          setDraft={setEditing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}
    </div>
  )
}
