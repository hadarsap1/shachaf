import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { updateUserProfile } from '../../lib/db'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { User, Phone, Mail, MapPin, ChevronDown, ChevronUp, CheckCircle2, Settings, Loader2 } from 'lucide-react'
import clsx from 'clsx'

const TUTORIALS = [
  {
    id: 'tasks',
    title: 'איך מסמנים משימה כהושלמה',
    icon: '✅',
    steps: [
      'עברו לדף "המשימות שלי" מהתפריט',
      'מצאו את המשימה הרצויה ולחצו עליה להרחבה',
      'לחצו על עיגול הסטטוס משמאל לכותרת המשימה',
      'הסטטוס יעלה מ"ממתין" → "בתהליך" → "הושלם"',
      'המשימה תסומן בקו חוצה ויירשם תאריך ההשלמה',
    ],
  },
  {
    id: 'calendar',
    title: 'איך מוסיפים אירוע ליומן',
    icon: '📅',
    steps: [
      'עברו לדף "אירועים" מהתפריט',
      'לחצו על כרטיס האירוע הרצוי',
      'בחרו "Google Calendar" להוספה ישירה לגוגל',
      'לחלופין, לחצו "יומן (.ics)" להורדת קובץ תואם לכל יומן',
      'אשרו את האירוע ביומן שלכם',
    ],
  },
  {
    id: 'whatsapp',
    title: 'איך שולחים הודעת WhatsApp למשפחה המארחת',
    icon: '💬',
    steps: [
      'עברו לדף "המשימות שלי"',
      'פתחו משימה שיש לה כפתור "שלח וואטסאפ"',
      'לחצו על הכפתור הירוק — ייפתח WhatsApp',
      'הודעה מוכנה מראש ממתינה לשליחה',
      'ערכו אותה לפי הצורך ולחצו שלח',
    ],
  },
  {
    id: 'chatbot',
    title: 'איך משתמשים בעוזר החכם',
    icon: '🤖',
    steps: [
      'עברו ל"עוזר חכם" מהתפריט',
      'הקלידו שאלה בתיבה התחתונה או לחצו על אחד מהכפתורים המוצעים',
      'העוזר מכיר את המשימות והאירועים שלכם',
      'שאלו על הצעד הבא, תאריכים, פרטי קשר ועוד',
      'לחצו על סמל הרענון (↺) כדי להתחיל שיחה חדשה',
    ],
  },
  {
    id: 'resources',
    title: 'איך מוצאים מידע שימושי',
    icon: '📚',
    steps: [
      'עברו ל"מידע שימושי" מהתפריט',
      'הקישורים מאורגנים לפי קטגוריות: בית הספר, קהילה, שאלות נפוצות',
      'לחצו על כל כרטיס כדי לפתוח את הקישור',
      'שמרו את הדפים שחשובים לכם בדפדפן',
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

export default function SettingsPage() {
  const { user } = useAuth()
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: '',
  })

  useEffect(() => {
    if (!user?.uid) return
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data()
        setForm(prev => ({ ...prev, address: data.address || '' }))
      }
    })
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
              className="input w-full text-right"
              placeholder="רחוב, עיר"
            />
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
