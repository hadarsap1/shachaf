import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  HelpCircle, ChevronDown, ChevronUp, MessageSquare,
  Calendar, Users, CheckSquare, BookOpen, GraduationCap,
  Home, Star,
} from 'lucide-react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'

const SECTIONS = [
  {
    id: 'getting-started',
    icon: Home,
    title: 'תחילת עבודה',
    color: 'text-primary-600',
    bg: 'bg-primary-50',
    roles: ['all'],
    faqs: [
      {
        q: 'איך נרשמים לאפליקציה?',
        a: 'ניתן להירשם עם חשבון Google או עם כתובת מייל וסיסמה. לחץ על "כניסה לחשבון" בעמוד הכניסה ובחר את האפשרות המתאימה לך.',
      },
      {
        q: 'האם האפליקציה עובדת על הטלפון?',
        a: 'כן! ניתן להתקין את האפליקציה ישירות ממסך הדפדפן על מסך הבית של הטלפון (PWA). היא עובדת ב-iOS וב-Android ומציעה חוויה כמו אפליקציה מלאה.',
      },
      {
        q: 'שכחתי סיסמה — מה עושים?',
        a: 'בעמוד הכניסה, לחץ על "שכחת סיסמה" והזן את כתובת המייל שלך. תקבל הוראות לאיפוס הסיסמה תוך דקות ספורות.',
      },
      {
        q: 'איך משנים פרטים אישיים?',
        a: 'ניתן לעדכן שם, טלפון וכתובת בדף ההגדרות (⚙ הגדרות). כתובת המייל מקושרת לחשבון ולא ניתנת לשינוי.',
      },
    ],
  },
  {
    id: 'onboarding',
    icon: CheckSquare,
    title: 'תהליך קליטה',
    color: 'text-secondary-600',
    bg: 'bg-secondary-50',
    roles: ['new_family', 'host_family'],
    faqs: [
      {
        q: 'איך עוקבים אחר התקדמות המשימות?',
        a: 'בדף "משימות" תמצאו את כל משימות הקליטה מסודרות לפי אבני דרך. סמנו משימה כהושלמה בלחיצה על הסימון בצד שמאל. ניתן לראות את ההתקדמות הכוללת בדשבורד.',
      },
      {
        q: 'מה זו משפחה מארחת?',
        a: 'משפחה מארחת היא משפחה ותיקה בשחף שמתנדבת ללוות משפחה חדשה בתהליך הקליטה. הם יכולים לעזור עם שאלות, להכיר את הקהילה ולהיות נקודת הקשר הראשונה.',
      },
      {
        q: 'איך יוצרים קשר עם המשפחה המארחת?',
        a: 'בדף "בית" תמצאו את פרטי הקשר של המשפחה המארחת שלכם. ניתן לפנות אליהם ישירות בטלפון או בוואטסאפ.',
      },
      {
        q: 'מה קורה אחרי שמסיימים את תהליך הקליטה?',
        a: 'לאחר השלמת תהליך הקליטה, ייפתחו בפניכם כל תכונות האפליקציה הקהילתית — דף הכיתה, הוועדות, אירועים ועוד.',
      },
    ],
  },
  {
    id: 'class',
    icon: GraduationCap,
    title: 'דף הכיתה',
    color: 'text-accent-600',
    bg: 'bg-accent-50',
    roles: ['all'],
    faqs: [
      {
        q: 'איך רואים את שעות המסגרת של הכיתה?',
        a: 'בדף הכיתה תמצאו את שעות המסגרת לכל יום בשבוע. אם ילדכם לומד ביותר מכיתה אחת, ניתן לעבור בין הכיתות בלשוניות בראש הדף.',
      },
      {
        q: 'מה ההבדל בין אירועי כיתה לאירועי בית ספר?',
        a: 'אירועי בית ספר מיועדים לכלל ההורים. אירועי כיתה מיועדים לכיתה הספציפית של ילדכם. בלוח האירועים, כל סוג מוצג בצבע שונה.',
      },
      {
        q: 'איך יוצרים קשר עם המחנך/ת?',
        a: 'פרטי הקשר של המחנכ/ת מופיעים בכרטיס "צוות הכיתה" בדף הכיתה. ניתן ללחוץ ישירות על מספר הטלפון להתקשרות.',
      },
      {
        q: 'מי הם מנהלי הכיתה?',
        a: 'מנהלי הכיתה הם הורים שמונו על ידי הנהלת בית הספר לנהל את תוכן הכיתה — הם יכולים לעדכן הודעות ואירועים ספציפיים לכיתה.',
      },
    ],
  },
  {
    id: 'events',
    icon: Calendar,
    title: 'אירועים ולוח שנה',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    roles: ['all'],
    faqs: [
      {
        q: 'מה המשמעות של הצבעים השונים בלוח השנה?',
        a: 'כל כיתה מזוהה בצבע ייחודי. אירועים צבועים לפי הכיתה אליה הם שייכים. אירועי בית הספר הכלליים מוצגים בצבע הנייבי הכחול.',
      },
      {
        q: 'איך מוסיפים אירוע ליומן Google?',
        a: 'בכל אירוע יש כפתור "הוסף ליומן". לחיצה עליו תפתח את יומן Google עם פרטי האירוע מלאים.',
      },
      {
        q: 'למה אני לא רואה אירוע מסוים?',
        a: 'ייתכן שהאירוע מיועד לכיתה אחרת. רק אירועי בית הספר הכלליים ואירועי הכיתה הספציפית שלכם יוצגו.',
      },
    ],
  },
  {
    id: 'committees',
    icon: Users,
    title: 'ועדות',
    color: 'text-pink-600',
    bg: 'bg-pink-50',
    roles: ['all'],
    faqs: [
      {
        q: 'מה זה עמוד הוועדות?',
        a: 'בעמוד הוועדות תמצאו מידע על כלל הוועדות הפעילות בשחף — ועד הורים, ועדת תרבות, ועדות כיתה ועוד. כל ועדה מוצגת עם תיאור, חברים ופרטי קשר.',
      },
      {
        q: 'איך אפשר להצטרף לוועדה?',
        a: 'פנו ישירות לחברי הוועדה המופיעים בכרטיס, או צרו קשר עם בית הספר דרך דף "צור קשר".',
      },
    ],
  },
  {
    id: 'resources',
    icon: BookOpen,
    title: 'מידע שימושי',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    roles: ['all'],
    faqs: [
      {
        q: 'מה נמצא בדף מידע שימושי?',
        a: 'קישורים ומסמכים חשובים שנאספו עבורכם — תקנונים, מפות, לינקים לאתרים רלוונטיים ועוד. התוכן מעודכן על ידי צוות בית הספר.',
      },
    ],
  },
]

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={clsx(
      'border-b border-gray-100 last:border-0 transition-colors',
      open && 'bg-gray-50/50'
    )}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between gap-3 py-3.5 px-1 text-right"
      >
        <span className="text-sm font-medium text-gray-800 flex-1">{q}</span>
        {open
          ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
          : <ChevronDown size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="pb-4 px-1">
          <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

export default function HelpPage() {
  const { user, isAdmin } = useAuth()

  const visibleSections = SECTIONS.filter(s =>
    s.roles.includes('all') ||
    s.roles.includes(user?.role) ||
    (isAdmin && s.roles.includes('admin'))
  )

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HelpCircle size={24} className="text-primary-600" />
          עזרה ושאלות נפוצות
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          כל מה שצריך לדעת על האפליקציה
        </p>
      </div>

      <div className="space-y-4">
        {visibleSections.map(section => {
          const Icon = section.icon
          return (
            <div key={section.id} className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
              <div className={clsx('flex items-center gap-3 px-5 py-4', section.bg)}>
                <div className={clsx('p-2 rounded-xl bg-white/60', section.color)}>
                  <Icon size={18} />
                </div>
                <h2 className={clsx('font-semibold text-base', section.color)}>{section.title}</h2>
              </div>
              <div className="px-5 divide-y divide-gray-50">
                {section.faqs.map((faq, i) => (
                  <FAQItem key={i} q={faq.q} a={faq.a} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 bg-primary-50 rounded-2xl p-5 text-center">
        <Star size={20} className="mx-auto text-primary-400 mb-2" />
        <p className="font-semibold text-primary-800 text-sm">לא מצאתם תשובה?</p>
        <p className="text-xs text-primary-600 mt-0.5 mb-3">
          צרו קשר עם צוות בית הספר ונשמח לעזור
        </p>
        <Link to="/contact" className="btn-primary text-sm py-2 px-5 inline-flex items-center gap-2">
          <MessageSquare size={14} />
          צור קשר
        </Link>
      </div>
    </div>
  )
}
