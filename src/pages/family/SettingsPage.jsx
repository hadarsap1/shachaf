import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { updateUserProfile, updateChildProfile, uploadChildPhoto, deleteChildPhoto, uploadUserAvatar, deleteUserAvatar, registerCoParent, getChildrenByParent, getUsersByUids, logConsent } from '../../lib/db'
import { CONSENT_VERSION, hasConsented } from '../../lib/consent'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { User, Phone, Mail, MapPin, ChevronDown, ChevronUp, CheckCircle2, Settings, Loader2, UserPlus, Briefcase, Smile, Clock, PawPrint, Camera, X, Calendar } from 'lucide-react'
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
      'יישלח לינק לאיפוס סיסמה למייל שהוזן — ההורה השני מתחבר עם המייל שלו',
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
    title: 'איך שולחים WhatsApp למשפחה הקולטת',
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
        className="w-full flex items-center justify-between p-4 text-right hover:bg-gray-50 transition-colors dark:hover:bg-gray-700/50"
      >
        <span className="text-gray-400">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xl">{tutorial.icon}</span>
          <span className="font-semibold text-gray-800 text-sm dark:text-gray-100">{tutorial.title}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
          <ol className="space-y-2 mt-3">
            {tutorial.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 dark:text-primary-300 dark:bg-primary-900/40">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700 leading-relaxed dark:text-gray-200">{step}</span>
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
  // null = unknown (doc unreadable until their first login) → treated as pending
  const [coParentConsented, setCoParentConsented] = useState(null)

  useEffect(() => {
    if (!existing?.uid) return
    getUsersByUids([existing.uid])
      .then(([u]) => setCoParentConsented(hasConsented(u)))
      .catch(() => setCoParentConsented(null))
  }, [existing?.uid])

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
        <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2 justify-end dark:text-gray-200">
          <UserPlus size={16} className="text-primary-600" />
          הורה שני
        </h2>
        <div className={clsx(
          'flex items-center gap-3 p-3 border rounded-xl',
          coParentConsented
            ? 'bg-green-50 border-green-200 dark:bg-green-900/20'
            : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20'
        )}>
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 font-bold text-primary-700 dark:text-primary-300 dark:bg-primary-900/40">
            {existing.name?.[0] || '?'}
          </div>
          <div className="text-right flex-1">
            <div className="font-semibold text-gray-800 text-sm dark:text-gray-100">{existing.name}</div>
            <div className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{existing.email}</div>
            {existing.phone && <div className="text-xs text-gray-500 dark:text-gray-400">{existing.phone}</div>}
          </div>
          {coParentConsented
            ? <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
            : <Clock size={18} className="text-amber-500 flex-shrink-0" />}
        </div>
        <p className="text-xs text-gray-400 mt-2 text-right">
          {coParentConsented
            ? 'ההורה השני מקושר לחשבון ויש לו גישה מלאה'
            : 'ממתין לאישור התקנון — פרטי ההורה השני לא יוצגו לחברי הקהילה עד שיתחבר ויאשר את תקנון הפרטיות'}
        </p>
      </section>
    )
  }

  if (done) {
    return (
      <section className="card p-5 mb-6">
        <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2 justify-end dark:text-gray-200">
          <UserPlus size={16} className="text-primary-600" />
          הורה שני
        </h2>
        <div className="text-center py-4">
          <CheckCircle2 size={36} className="text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-gray-800 dark:text-gray-100">החשבון נוצר בהצלחה!</p>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">שלחנו לינק לאיפוס סיסמה למייל {form.email}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="card p-5 mb-6">
      <h2 className="font-bold text-gray-700 mb-1 flex items-center gap-2 justify-end dark:text-gray-200">
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
        <p className="text-xs text-gray-400 text-center">יישלח לינק לאיפוס סיסמה לכתובת המייל שהוזנה</p>
        <p className="text-xs text-gray-400 text-center">
          פרטי ההורה השני יוצגו לחברי הקהילה רק לאחר שיתחבר ויאשר את תקנון הפרטיות בעצמו
        </p>
      </form>
    </section>
  )
}

function ChildProfileCard({ child, user }) {
  const [form, setForm] = useState({ pet: child.pet || '', birthDate: child.birthDate || '' })
  const [hobbiesInput, setHobbiesInput] = useState((child.hobbies || []).join(', '))
  const [photoPreview, setPhotoPreview] = useState(child.photoUrl || null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoConsent, setPhotoConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [currentPhotoPath, setCurrentPhotoPath] = useState(child.photoPath || null)

  const handlePhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setPhotoFile(file)
    setPhotoConsent(false)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    // Uploading a child photo requires explicit parental consent to its
    // display — the photo appears in the app and on the class contact sheet.
    if (photoFile && !photoConsent) {
      setPhotoError('כדי לשמור את התמונה יש לאשר את הצגתה באפליקציה ובדף הקשר')
      return
    }
    setSaving(true)
    setPhotoError('')
    let photoFailed = false
    try {
      const hobbies = hobbiesInput.split(',').map(h => h.trim()).filter(Boolean)
      await updateChildProfile(child.id, { hobbies, pet: form.pet, birthDate: form.birthDate })
      if (photoFile) {
        try {
          if (currentPhotoPath) await deleteChildPhoto(currentPhotoPath)
          const { url, path } = await uploadChildPhoto(child.id, photoFile)
          await updateChildProfile(child.id, {
            photoUrl: url, photoPath: path,
            photoConsentAt: new Date().toISOString(),
          })
          logConsent(user.uid, 'child_photo', {
            label: 'אישור הצגת תמונת ילד/ה באפליקציה ובדף הקשר',
            version: CONSENT_VERSION,
            context: child.name || child.id,
          })
          setCurrentPhotoPath(path)
          setPhotoPreview(url)
          setPhotoFile(null)
        } catch (e) {
          console.error('child photo upload failed', e)
          photoFailed = true
          setPhotoError('התמונה לא נשמרה — נסו תמונה קטנה יותר או פורמט אחר')
          setPhotoPreview(child.photoUrl || null)
        }
      }
      if (!photoFailed) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (e) {
      console.error('child profile save failed', e)
      setPhotoError('השמירה נכשלה, נסו שוב')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3 dark:border-gray-700">
      <div className="flex items-center gap-3 justify-end">
        <span className="font-semibold text-gray-800 text-sm dark:text-gray-100">{child.name}</span>
        <label className="relative cursor-pointer group">
          <div className="w-12 h-12 rounded-full bg-primary-100 overflow-hidden flex items-center justify-center text-base font-bold text-primary-600 dark:text-primary-400 dark:bg-primary-900/40">
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
          <Calendar size={13} className="text-gray-400" />
          תאריך לידה
        </label>
        <input
          type="date"
          value={form.birthDate}
          onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))}
          className="input w-full text-right text-sm"
          dir="ltr"
        />
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
      {photoFile && (
        <label className="flex items-start gap-2 cursor-pointer bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 dark:bg-amber-900/20 dark:border-amber-800">
          <input
            type="checkbox"
            checked={photoConsent}
            onChange={e => { setPhotoConsent(e.target.checked); setPhotoError('') }}
            className="w-4 h-4 mt-0.5 accent-primary-600 flex-shrink-0"
          />
          <span className="text-xs text-amber-800 leading-relaxed text-right dark:text-amber-200">
            אני מאשר/ת שתמונת ילדי תוצג באפליקציה ובדף הקשר הכיתתי, בהתאם לתקנון.
            ניתן להסיר את התמונה בכל עת.
          </span>
        </label>
      )}
      {photoError && <p className="text-xs text-red-600 text-right bg-red-50 rounded-lg px-2.5 py-1.5 dark:bg-red-900/20 dark:text-red-400">{photoError}</p>}
      <button
        onClick={handleSave}
        disabled={saving || (photoFile && !photoConsent)}
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
  const { theme, toggleTheme } = useTheme()
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [coParent, setCoParent] = useState(user?.coParent || null)
  const [children, setChildren] = useState([])
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null)
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

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    let avatarFailed = false
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
      if (avatarFile) {
        try {
          if (user.avatarPath) await deleteUserAvatar(user.avatarPath)
          const { url, path } = await uploadUserAvatar(user.uid, avatarFile)
          await updateUserProfile(user.uid, { avatar: url, avatarPath: path })
          setAvatarPreview(url)
          setAvatarFile(null)
        } catch (err) {
          console.error('avatar upload failed', err)
          avatarFailed = true
          setSaveError('התמונה לא נשמרה — נסו תמונה קטנה יותר. שאר הפרטים נשמרו.')
          setAvatarPreview(user.avatar || null)
        }
      }
      if (!avatarFailed) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (err) {
      console.error('profile save failed', err)
      setSaveError('השמירה נכשלה, נסו שוב')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 dark:text-primary-300">
          <span className="text-2xl leading-none">⚙️</span>
          הגדרות
        </h1>
        <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">פרטים אישיים ומדריכי שימוש</p>
      </div>

      {/* Profile section */}
      <section className="card p-5 mb-6">
        <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2 justify-end dark:text-gray-200">
          <User size={16} className="text-primary-600" />
          פרטים אישיים
        </h2>
        <form onSubmit={handleSave} className="space-y-4">
          {/* Avatar upload */}
          <div className="flex justify-center">
            <label className="relative cursor-pointer group">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary-600 dark:text-primary-400 border-2 border-white shadow dark:bg-primary-900/40">
                {avatarPreview
                  ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                  : user?.name?.[0] || '?'
                }
              </div>
              <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <Camera size={16} className="text-white" />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
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
              className="input w-full text-right bg-gray-50 text-gray-500 cursor-not-allowed dark:bg-gray-900 dark:text-gray-400"
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

          {saveError && <p className="text-xs text-red-600 text-right bg-red-50 rounded-lg px-3 py-2 dark:bg-red-900/20 dark:text-red-400">{saveError}</p>}
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
          <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2 justify-end dark:text-gray-200">
            <span className="text-base">👦</span>
            פרופיל ילדים
          </h2>
          <div className="space-y-3">
            {children.map(child => (
              <ChildProfileCard key={child.id} child={child} user={user} />
            ))}
          </div>
        </section>
      )}

      {/* Tutorials section */}
      <section>
        <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2 justify-end dark:text-gray-200">
          <span className="text-base">📖</span>
          מדריכי שימוש
        </h2>
        <div className="space-y-2">
          {TUTORIALS.map(t => (
            <TutorialItem key={t.id} tutorial={t} />
          ))}
        </div>
      </section>

      {/* Theme section */}
      <section className="card p-5 mb-6">
        <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2 justify-end dark:text-gray-200">
          <span className="text-base">{theme === 'dark' ? '🌙' : '☀️'}</span>
          מצב תצוגה
        </h2>
        <div className="flex items-center justify-between">
          <button
            onClick={toggleTheme}
            className={clsx(
              'relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none',
              theme === 'dark' ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
            )}
            role="switch"
            aria-checked={theme === 'dark'}
          >
            <span className={clsx(
              'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200',
              theme === 'dark' ? 'translate-x-1' : 'translate-x-6'
            )} />
          </button>
          <span className="text-sm text-gray-700 dark:text-gray-200">
            {theme === 'dark' ? 'מצב כהה' : 'מצב בהיר'}
          </span>
        </div>
      </section>
    </div>
  )
}
