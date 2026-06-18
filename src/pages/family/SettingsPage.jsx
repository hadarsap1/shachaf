import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { updateUserProfile, updateChildProfile, uploadChildPhoto, deleteChildPhoto, registerCoParent, getChildrenByParent } from '../../lib/db'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { User, Phone, Mail, MapPin, ChevronDown, ChevronUp, CheckCircle2, Settings, Loader2, UserPlus, Briefcase, Smile, Clock, PawPrint, Camera, X } from 'lucide-react'
import clsx from 'clsx'

const TEMPORARY_STATUS_OPTIONS = [
  { value: '',           label: 'ללא סטטוס זמני' },
  { value: 'reserve',   label: 'מילואים' },
  { value: 'maternity', label: 'חופשת לידה' },
  { value: 'sick',      label: 'מחלה / אשפוז' },
  { value: 'sabbatical',label: 'שבתון' },
  { value: 'other',     label: 'אחר' },
]

const TUTORIALS = [
  {
    id: 'tasks',
    title: 'איך מסמנים משימה כהושלמה',
    icon: '✅',
    steps: [
      'עברו לדף "משימות" מהתפריט',
      'מצאו את המשימה הרצויה ולחצו עליה להרחבה',
      'לחצו על עיגול הסטטוס בצד שמאל של כותרת המשימה',
      'הסטטוס עולה: "ממתין" → "בתהליך" → "הושלם"',
      'משימה שהושלמה תסומן בקו חוצה וייסגר תאריך ההשלמה',
    ],
  },
  {
    id: 'forms',
    title: 'איך ממלאים טופס',
    icon: '📝',
    steps: [
      'עברו ל"הטפסים שלי" מהתפריט',
      'טפסים ממתינים מסומנים בגבול כחול — לחצו "מלא טופס"',
      'מלאו את השדות ולחצו "הגש טופס"',
      'טופס שמולא מוצג בגבול ירוק עם תאריך הגשה',
      'אם ההורה השני כבר הגיש, תראו "הוגש על ידי [שם]" ותוכלו לערוך',
    ],
  },
  {
    id: 'co-parent',
    title: 'איך מוסיפים הורה שני לחשבון',
    icon: '👨‍👩‍👧',
    steps: [
      'עברו ל"הגדרות" מהתפריט',
      'גללו למטה לקטע "הוסף הורה שני"',
      'הזינו את שם ההורה, מייל ומספר טלפון',
      'לחצו "צור חשבון לשותף/ה"',
      'ישלח לינק לאיפוס סיסמה למייל שהוזן — ההורה השני מתחבר עם המייל שלו',
    ],
  },
  {
    id: 'calendar',
    title: 'איך מוסיפים אירוע ליומן',
    icon: '📅',
    steps: [
      'עברו לדף "אירועים" מהתפריט',
      'לחצו על כרטיס האירוע הרצוי לפתיחת פרטים',
      'בחרו "Google Calendar" להוספה ישירה',
      'לחלופין, לחצו "יומן (.ics)" לקובץ תואם כל יומן',
      'אירועים שעברו מציגים "האירוע הסתיים" ללא כפתורי הוספה',
    ],
  },
  {
    id: 'whatsapp',
    title: 'איך שולחים WhatsApp למשפחה המארחת',
    icon: '💬',
    steps: [
      'עברו לדף "משימות"',
      'פתחו משימה שיש לה כפתור "שלח וואטסאפ"',
      'לחצו על הכפתור הירוק — ייפתח WhatsApp עם הודעה מוכנה',
      'ערכו את ההודעה לפי הצורך ולחצו שלח',
    ],
  },
  {
    id: 'chatbot',
    title: 'איך משתמשים בעוזר החכם',
    icon: '🤖',
    steps: [
      'עברו ל"עוזר חכם" מהתפריט',
      'הקלידו שאלה חופשית או בחרו מהצעות מוכנות',
      'העוזר מכיר את המשימות, האירועים והשלב שלכם בתהליך',
      'שאלו על הצעד הבא, תאריכים, פרטי קשר וכל שאלה אחרת',
      'לחצו על ↺ כדי להתחיל שיחה חדשה',
    ],
  },
  {
    id: 'install',
    title: 'איך מתקינים את האפליקציה על הטלפון',
    icon: '📱',
    steps: [
      'פתחו את האפליקציה בדפדפן הטלפון (Safari ב-iPhone, Chrome ב-Android)',
      'iPhone: לחצו על כפתור השיתוף ← "הוסף למסך הבית"',
      'Android: לחצו על תפריט שלוש הנקודות ← "הוסף למסך הבית"',
      'האפליקציה תופיע כאייקון ותפתח ללא פס דפדפן',
    ],
  },
  {
    id: 'resources',
    title: 'איך מוצאים מידע שימושי',
    icon: '📚',
    steps: [
      'עברו ל"מידע שימושי" מהתפריט',
      'הקישורים מאורגנים לפי קטגוריות: בית הספר, קהילה, שאלות נפוצות',
      'לחצו על כרטיס כדי לפתוח את הקישור',
    ],
  },
]

function TutorialItem({ tutorial }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-right hover:bg-gray-50 transition-colors"
      >
        <span className="text-gray-400">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xl">{tutorial.icon}</span>
          <span className="font-semibold text-gray-800 text-sm">{tutorial.title}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <ol className="space-y-2 mt-3">
            {tutorial.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function CoParentSection({ currentUser, onRegistered }) {
  const existing = currentUser.coParent
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return
    setSaving(true)
    setError('')
    try {
      const result = await registerCoParent(currentUser, form)
      setDone(true)
      onRegistered(result)
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('כתובת המייל כבר רשומה. פנה למנהל לקישור ידני.')
      } else {
        setError('אירעה שגיאה. נסה שוב.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (existing) {
    return (
      <section className="card p-5 mb-6">
        <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2 justify-end">
          <UserPlus size={16} className="text-primary-600" />
          הורה שני
        </h2>
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 font-bold text-primary-700">
            {existing.name?.[0] || '?'}
          </div>
          <div className="text-right flex-1">
            <div className="font-semibold text-gray-800 text-sm">{existing.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{existing.email}</div>
            {existing.phone && <div className="text-xs text-gray-500">{existing.phone}</div>}
          </div>
          <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
        </div>
        <p className="text-xs text-gray-400 mt-2 text-right">ההורה השני מקושר לחשבון ויש לו גישה מלאה</p>
      </section>
    )
  }

  if (done) {
    return (
      <section className="card p-5 mb-6">
        <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2 justify-end">
          <UserPlus size={16} className="text-primary-600" />
          הורה שני
        </h2>
        <div className="text-center py-4">
          <CheckCircle2 size={36} className="text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-gray-800">החשבון נוצר בהצלחה!</p>
          <p className="text-sm text-gray-500 mt-1">שלחנו לינק לאיפוס סיסמה למייל {form.email}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="card p-5 mb-6">
      <h2 className="font-bold text-gray-700 mb-1 flex items-center gap-2 justify-end">
        <UserPlus size={16} className="text-primary-600" />
        הוסף הורה שני
      </h2>
      <p className="text-xs text-gray-400 mb-4 text-right">ניתן לרשום הורה נוסף — הוא יקבל גישה מלאה לאותם ילדים ומשימות</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label block mb-1 text-right">שם מלא *</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            maxLength={100}
            className="input w-full text-right"
            placeholder="שם פרטי ומשפחה"
            required
          />
        </div>
        <div>
          <label className="label block mb-1 text-right flex items-center gap-1.5 justify-end">
            <Mail size={13} className="text-gray-400" />
            אימייל *
          </label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            maxLength={254}
            className="input w-full text-right"
            placeholder="email@example.com"
            dir="ltr"
            required
          />
        </div>
        <div>
          <label className="label block mb-1 text-right flex items-center gap-1.5 justify-end">
            <Phone size={13} className="text-gray-400" />
            טלפון
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            maxLength={30}
            className="input w-full text-right"
            placeholder="050-0000000"
            dir="ltr"
          />
        </div>
        {error && <p className="text-xs text-red-500 text-right">{error}</p>}
        <button
          type="submit"
          disabled={saving || !form.name.trim() || !form.email.trim()}
          className="w-full py-2.5 rounded-xl font-semibold text-sm bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          {saving ? 'יוצר חשבון...' : 'צור חשבון לשותף/ה'}
        </button>
        <p className="text-xs text-gray-400 text-center">ישלח לינק לאיפוס סיסמה לכתובת המייל שהוזנה</p>
      </form>
    </section>
  )
}

function ChildProfileCard({ child }) {
  const [form, setForm] = useState({ pet: child.pet || '' })
  const [hobbiesInput, setHobbiesInput] = useState((child.hobbies || []).join(', '))
  const [photoPreview, setPhotoPreview] = useState(child.photoUrl || null)
  const [photoFile, setPhotoFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handlePhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const hobbies = hobbiesInput.split(',').map(h => h.trim()).filter(Boolean)
      const update = { hobbies, pet: form.pet }
      if (photoFile) {
        if (child.photoPath) await deleteChildPhoto(child.photoPath)
        const { url, path } = await uploadChildPhoto(child.id, photoFile)
        update.photoUrl = url
        update.photoPath = path
      }
      await updateChildProfile(child.id, update)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3 justify-end">
        <span className="font-semibold text-gray-800 text-sm">{child.name}</span>
        <label className="relative cursor-pointer group">
          <div className="w-12 h-12 rounded-full bg-primary-100 overflow-hidden flex items-center justify-center text-base font-bold text-primary-600">
            {photoPreview
              ? <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              : child.name?.[0] || '?'
            }
          </div>
          <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <Camera size={14} className="text-white" />
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </label>
      </div>
      <div>
        <label className="label block mb-1 text-right flex items-center gap-1.5 justify-end">
          <Smile size={13} className="text-gray-400" />
          תחביבים
        </label>
        <input
          value={hobbiesInput}
          onChange={e => setHobbiesInput(e.target.value)}
          className="input w-full text-right text-sm"
          placeholder="ריצה, ציור, כדורגל... (מופרדים בפסיק)"
        />
      </div>
      <div>
        <label className="label block mb-1 text-right flex items-center gap-1.5 justify-end">
          <PawPrint size={13} className="text-gray-400" />
          חיית מחמד
        </label>
        <input
          value={form.pet}
          onChange={e => setForm(f => ({ ...f, pet: e.target.value }))}
          maxLength={80}
          className="input w-full text-right text-sm"
          placeholder="כלב, חתול..."
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className={clsx(
          'w-full py-2 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2',
          saved ? 'bg-green-500 text-white' : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-70'
        )}
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <><CheckCircle2 size={14} /> נשמר</> : 'שמור'}
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [coParent, setCoParent] = useState(user?.coParent || null)
  const [children, setChildren] = useState([])
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: '',
    workplace: '',
    profession: '',
    hobbies: '',
    temporaryStatus: '',
  })

  useEffect(() => {
    if (!user?.uid) return
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data()
        setForm(prev => ({
          ...prev,
          address: data.address || '',
          workplace: data.workplace || '',
          profession: data.profession || '',
          hobbies: (data.hobbies || []).join(', '),
          temporaryStatus: data.temporaryStatus || '',
        }))
      }
    })
    getChildrenByParent(user.uid).then(setChildren).catch(() => {})
  }, [user])

  const handleChange = (field, value) => {
    setSaved(false)
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateUserProfile(user.uid, {
        name: form.name,
        phone: form.phone,
        address: form.address,
        workplace: form.workplace,
        profession: form.profession,
        hobbies: form.hobbies.split(',').map(h => h.trim()).filter(Boolean),
        temporaryStatus: form.temporaryStatus,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2">
          <Settings size={22} />
          הגדרות
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">פרטים אישיים ומדריכי שימוש</p>
      </div>

      {/* Profile section */}
      <section className="card p-5 mb-6">
        <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2 justify-end">
          <User size={16} className="text-primary-600" />
          פרטים אישיים
        </h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label block mb-1 text-right">שם מלא</label>
            <input
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              maxLength={100}
              className="input w-full text-right"
              placeholder="שם מלא"
            />
          </div>
          <div>
            <label className="label block mb-1 text-right flex items-center gap-1.5 justify-end">
              <Mail size={13} className="text-gray-400" />
              אימייל
            </label>
            <input
              type="email"
              value={form.email}
              readOnly
              className="input w-full text-right bg-gray-50 text-gray-500 cursor-not-allowed"
              placeholder="your@email.com"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">לא ניתן לשנות את כתובת האימייל</p>
          </div>
          <div>
            <label className="label block mb-1 text-right flex items-center gap-1.5 justify-end">
              <Phone size={13} className="text-gray-400" />
              מספר טלפון
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => handleChange('phone', e.target.value)}
              maxLength={30}
              className="input w-full text-right"
              placeholder="050-0000000"
              dir="ltr"
            />
          </div>
          <div>
            <label className="label block mb-1 text-right flex items-center gap-1.5 justify-end">
              <MapPin size={13} className="text-gray-400" />
              כתובת
            </label>
            <input
              value={form.address}
              onChange={e => handleChange('address', e.target.value)}
              maxLength={200}
              className="input w-full text-right"
              placeholder="רחוב, עיר"
            />
          </div>
          <div>
            <label className="label block mb-1 text-right flex items-center gap-1.5 justify-end">
              <Briefcase size={13} className="text-gray-400" />
              מקום עבודה / תפקיד
            </label>
            <div className="flex gap-2">
              <input
                value={form.workplace}
                onChange={e => handleChange('workplace', e.target.value)}
                maxLength={100}
                className="input flex-1 text-right text-sm"
                placeholder="חברה / ארגון"
              />
              <input
                value={form.profession}
                onChange={e => handleChange('profession', e.target.value)}
                maxLength={100}
                className="input flex-1 text-right text-sm"
                placeholder="תפקיד / מקצוע"
              />
            </div>
          </div>
          <div>
            <label className="label block mb-1 text-right flex items-center gap-1.5 justify-end">
              <Smile size={13} className="text-gray-400" />
              תחביבים
            </label>
            <input
              value={form.hobbies}
              onChange={e => handleChange('hobbies', e.target.value)}
              maxLength={300}
              className="input w-full text-right"
              placeholder="ריצה, בישול, טיולי ג׳יפ... (מופרדים בפסיק)"
            />
          </div>
          <div>
            <label className="label block mb-1 text-right flex items-center gap-1.5 justify-end">
              <Clock size={13} className="text-gray-400" />
              סטטוס זמני
            </label>
            <select
              value={form.temporaryStatus}
              onChange={e => handleChange('temporaryStatus', e.target.value)}
              className="input w-full text-right"
            >
              {TEMPORARY_STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className={clsx(
              'w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
              saved
                ? 'bg-green-500 text-white'
                : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-70'
            )}
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : saved ? (
              <>
                <CheckCircle2 size={16} />
                נשמר בהצלחה
              </>
            ) : 'שמור שינויים'}
          </button>
        </form>
      </section>

      {/* Co-parent section */}
      {(user?.role === 'new_family' || user?.role === 'host_family') && (
        <CoParentSection
          currentUser={{ ...user, coParent: coParent }}
          onRegistered={(result) => setCoParent(result)}
        />
      )}

      {/* Children profiles */}
      {children.length > 0 && (
        <section className="mb-6">
          <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2 justify-end">
            <span className="text-base">👦</span>
            פרופיל ילדים
          </h2>
          <div className="space-y-3">
            {children.map(child => (
              <ChildProfileCard key={child.id} child={child} />
            ))}
          </div>
        </section>
      )}

      {/* Tutorials section */}
      <section>
        <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2 justify-end">
          <span className="text-base">📖</span>
          מדריכי שימוש
        </h2>
        <div className="space-y-2">
          {TUTORIALS.map(t => (
            <TutorialItem key={t.id} tutorial={t} />
          ))}
        </div>
      </section>
    </div>
  )
}
