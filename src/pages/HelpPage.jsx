import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  HelpCircle, ChevronDown, ChevronUp, MessageSquare,
  Calendar, Users, CheckSquare, BookOpen, GraduationCap,
  Home, Star, ClipboardList, Search, Heart, Phone,
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
        a: 'ניתן להירשם עם חשבון Google או עם כתובת מייל וסיסמה. לחצו על "כניסה לחשבון" בעמוד הכניסה ובחרו את האפשרות המתאימה.',
      },
      {
        q: 'האם האפליקציה עובדת על הטלפון?',
        a: 'כן! ניתן להתקין את האפליקציה על מסך הבית של הטלפון (PWA). ב-iPhone: לחצו על כפתור השיתוף → "הוסף למסך הבית". ב-Android: תפריט שלוש נקודות → "הוסף למסך הבית". האפליקציה תיפתח בלי פס דפדפן, כמו אפליקציה רגילה.',
      },
      {
        q: 'שכחתי סיסמה — מה עושים?',
        a: 'בעמוד הכניסה, לחצו על "שכחת סיסמה" והזינו את כתובת המייל. תקבלו הוראות לאיפוס הסיסמה תוך דקות ספורות.',
      },
      {
        q: 'איך משנים פרטים אישיים?',
        a: 'ניתן לעדכן שם, טלפון וכתובת בדף ההגדרות (הגדרות בתפריט). כתובת המייל מקושרת לחשבון ולא ניתנת לשינוי ישירות.',
      },
      {
        q: 'האם שני הורים יכולים להיכנס לאותו חשבון?',
        a: 'לא נכנסים לאותו חשבון — כל הורה יוצר חשבון נפרד עם המייל שלו. בדף ההגדרות ניתן להוסיף הורה שני — פשוט הזינו את פרטיו ויישלח לו לינק להגדרת סיסמה. שני ההורים יראו את אותם ילדים, משימות ואירועים.',
      },
    ],
  },
  {
    id: 'onboarding',
    icon: CheckSquare,
    title: 'תהליך קליטה ומשימות',
    color: 'text-secondary-600',
    bg: 'bg-secondary-50',
    roles: ['new_family', 'host_family'],
    faqs: [
      {
        q: 'איך עוקבים אחר התקדמות המשימות?',
        a: 'בדף "משימות" תמצאו את כל משימות הקליטה מסודרות לפי אבני דרך. לחצו על עיגול הסטטוס לצד המשימה לסימון התקדמות: ממתין → בתהליך → הושלם. ניתן לראות את ההתקדמות הכוללת בדשבורד.',
      },
      {
        q: 'סימנתי משימה כהושלמה בטעות — איך מחזירים?',
        a: 'משימה שסומנה כ"הושלם" לא ניתנת לביטול ישירות. פנו למנהל דרך "צור קשר" ובקשו לאפס את סטטוס המשימה.',
      },
      {
        q: 'מה זו משפחה מארחת?',
        a: 'משפחה מארחת היא משפחה ותיקה בשחף שמתנדבת ללוות משפחה חדשה בתהליך הקליטה. הם יכולים לעזור עם שאלות, להכיר את הקהילה ולהיות נקודת הקשר הראשונה.',
      },
      {
        q: 'איך יוצרים קשר עם המשפחה המארחת?',
        a: 'בדף "בית" תמצאו את פרטי הקשר של המשפחה המארחת. ניתן לפנות אליהם ישירות בטלפון או בוואטסאפ. בחלק מהמשימות יש כפתור "שלח וואטסאפ" ישיר.',
      },
      {
        q: 'מה קורה אחרי שמסיימים את תהליך הקליטה?',
        a: 'לאחר השלמת תהליך הקליטה, כל תכונות האפליקציה הקהילתית זמינות — דף הכיתה, הוועדות, אירועים ועוד.',
      },
    ],
  },
  {
    id: 'forms',
    icon: ClipboardList,
    title: 'טפסים',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    roles: ['new_family', 'host_family', 'community'],
    faqs: [
      {
        q: 'איפה רואים את הטפסים שצריך למלא?',
        a: 'בדף "הטפסים שלי" תמצאו את כל הטפסים הפעילים שמיועדים אליכם. טפסים שממתינים למילוי מסומנים בגבול כחול. טפסים שהוגשו — בגבול ירוק.',
      },
      {
        q: 'האם ניתן לערוך טופס אחרי שהגשתי?',
        a: 'כן. לחצו על כפתור "צפה בתשובות / ערוך" בטופס שהוגש, עדכנו את הפרטים ולחצו "הגש טופס" שוב.',
      },
      {
        q: 'הורה שני כבר מילא טופס — מה אני רואה?',
        a: 'הטופס יוצג כ"הוגש" עם שם ההורה שמילא ותאריך ההגשה. תוכלו ללחוץ "צפה ועדכן" לראות את התשובות ולערוך אותן — הגרסה החדשה תחליף את הקודמת.',
      },
      {
        q: 'הטופס לא מופיע אצלי — מדוע?',
        a: 'ייתכן שהטופס מיועד לכיתה ספציפית שילדכם אינו שייך אליה, או שהטופס עדיין לא פורסם. פנו למנהל לבירור.',
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
        a: 'אירועי בית ספר מיועדים לכלל ההורים. אירועי כיתה מיועדים לכיתה הספציפית של ילדכם.',
      },
      {
        q: 'איך יוצרים קשר עם המחנך/ת?',
        a: 'פרטי הקשר מופיעים בכרטיס "צוות הכיתה" בדף הכיתה. לחצו ישירות על מספר הטלפון להתקשרות.',
      },
      {
        q: 'מי הם מנהלי הכיתה?',
        a: 'הורים שמונו לנהל את תוכן הכיתה — הם יכולים לעדכן הודעות ואירועים ספציפיים לכיתה.',
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
        a: 'כל כיתה מזוהה בצבע ייחודי. אירועי בית הספר הכלליים מוצגים בצבע הנייבי הכחול.',
      },
      {
        q: 'איך מוסיפים אירוע ליומן Google?',
        a: 'בכרטיס האירוע לחצו "Google Calendar" — ייפתח יומן Google עם כל הפרטים. לחלופין, "יומן (.ics)" מוריד קובץ תואם לכל יומן.',
      },
      {
        q: 'למה כפתורי הוספה ליומן לא מופיעים?',
        a: 'אירועים שעברו מציגים "האירוע הסתיים" ואין אפשרות להוסיפם ליומן.',
      },
      {
        q: 'למה אני לא רואה אירוע מסוים?',
        a: 'ייתכן שהאירוע מיועד לכיתה אחרת או לקבוצת תפקידים שאינה שלכם.',
      },
      {
        q: 'איך מסמנים הגעה לאירוע?',
        a: 'לחצו על האירוע לפתיחת פרטיו, ולחצו על כפתור "אני מגיע/ה". הכפתור יהפוך לירוק ויאשר את הרישום. לחיצה נוספת תבטל את ההרשמה.',
      },
      {
        q: 'כמה אנשים רשומים לאירוע — איך רואים?',
        a: 'בפרטי האירוע מופיע מספר המשתתפים הרשומים. לחצו עליו לפתיחת רשימת המשתתפים. לחיצה על שם ברשימה תפתח את פרטי הקשר של אותו הורה.',
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
        q: 'מה נמצא בעמוד הוועדות?',
        a: 'כל הוועדות הפעילות בשחף — ועד הורים, ועדת תרבות, ועדות כיתה ועוד. כל ועדה מוצגת עם תיאור, אפשרות להצטרפות, רשימת חברים ופרטי קשר, צ׳אט חברים וסיכומי ישיבות.',
      },
      {
        q: 'איך מצטרפים לוועדה?',
        a: 'לחצו על כפתור "הצטרף" בפינה הימנית של כרטיס הוועדה. הכפתור יציג "✓ חבר" לאחר ההצטרפות. לחיצה חוזרת תבצע עזיבה.',
      },
      {
        q: 'האם כולם יכולים לקרוא את הצ׳אט של הוועדה?',
        a: 'רק חברים בוועדה יכולים לראות את הצ׳אט ולשלוח הודעות. מי שאינו חבר יכול לשלוח הודעה לוועדה דרך לשונית "שלח הודעה".',
      },
      {
        q: 'איך שולחים הודעה בצ׳אט הוועדה?',
        a: 'כנסו ללשונית "צ׳אט" בכרטיס הוועדה (מופיעה רק לחברים), הקלידו הודעה בתיבה ולחצו שלח או Enter. ההודעות מתעדכנות בזמן אמת.',
      },
      {
        q: 'מה הם סיכומי ישיבות?',
        a: 'לשונית "סיכומים" מציגה סיכומים של ישיבות הוועדה שהוזנו על ידי מנהלי המערכת. כל סיכום כולל כותרת, תאריך, תוכן הישיבה ורשימת החלטות ממוספרת.',
      },
      {
        q: 'איך יוצרים קשר עם חבר ועדה?',
        a: 'לחצו על לשונית "צוות" בכרטיס הוועדה. לחיצה על שם חבר תפתח חלון קשר עם אפשרות להתקשר, לשלוח הודעת וואטסאפ, או לשלוח מייל.',
      },
    ],
  },
  {
    id: 'community-groups',
    icon: Heart,
    title: 'קבוצות קהילה',
    color: 'text-green-600',
    bg: 'bg-green-50',
    roles: ['community', 'admin'],
    faqs: [
      {
        q: 'מה הן קבוצות קהילה?',
        a: 'קבוצות לפי תחומי עניין — ספורט, תרבות, מוזיקה, ועוד. ניתן להצטרף לקבוצות ולתקשר עם חברי הקהילה שחולקים תחומי עניין דומים.',
      },
      {
        q: 'איך מצטרפים לקבוצת קהילה?',
        a: 'לחצו על כפתור "+ הצטרף" בכרטיס הקבוצה. לאחר ההצטרפות יופיע "✓ חבר" ותיפתח אפשרות הצ׳אט.',
      },
      {
        q: 'כיצד רואים מידע ו/או קישורים של קבוצה?',
        a: 'לחצו על "מידע וקישורים" בכרטיס הקבוצה (מופיע רק אם יש מידע). תוכן טקסטואלי, קישורים, ולוחות נתונים מוצגים שם. הקישורים מוצגים כפתורים — לחצו כדי לפתוח.',
      },
      {
        q: 'איך רואים מי חברים בקבוצה?',
        a: 'לחצו על "חברים" בכרטיס הקבוצה. תוצג רשימת חברים — לחיצה על שם תפתח את פרטי הקשר.',
      },
      {
        q: 'האם הצ׳אט של הקבוצה פתוח לכולם?',
        a: 'לא. רק חברי הקבוצה יכולים לראות ולשלוח הודעות בצ׳אט. הצטרפו לקבוצה תחילה כדי לגשת ללשונית "צ׳אט".',
      },
      {
        q: 'איך מוסיפים קישור לקבוצה?',
        a: 'לחצו "מידע וקישורים" בכרטיס הקבוצה. חברים יראו כפתור "+ הוסף" ליד "קישורים מחברי הקבוצה". הזינו תיאור וכתובת URL ולחצו שמור. הקישור יופיע לכל חברי הקבוצה.',
      },
      {
        q: 'איך מעלים קובץ לקבוצה?',
        a: 'לחצו "מידע וקישורים" בכרטיס הקבוצה. חברים יראו כפתור "+ העלה" ליד "קבצים מחברי הקבוצה". בחרו קובץ מהמכשיר — הוא יועלה אוטומטית ויהיה זמין להורדה לכל חברי הקבוצה.',
      },
      {
        q: 'איך יוצרים אירוע קבוצתי?',
        a: 'לחצו על לשונית "אירועים" בכרטיס הקבוצה. חברים יראו כפתור "+ צור אירוע קבוצתי". מלאו שם, תאריך, שעה, מיקום ותיאור ולחצו שמור. האירוע יופיע לכל חברי הקבוצה.',
      },
      {
        q: 'איך מוחקים קישור, קובץ או אירוע שיצרתי?',
        a: 'רחפו (או לחצו לאורך זמן בנייד) על הפריט — יופיע אייקון פח מחיקה. ניתן למחוק רק פריטים שיצרתם אתם. מנהלי המערכת יכולים למחוק כל פריט.',
      },
    ],
  },
  {
    id: 'contact-modal',
    icon: Phone,
    title: 'פרטי קשר ואנשים',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    roles: ['all'],
    faqs: [
      {
        q: 'איך פותחים את פרטי הקשר של הורה?',
        a: 'בכל מקום שבו מוצגת רשימת אנשים (ועדות, קבוצות קהילה, משתתפי אירועים) — לחצו על שם ההורה. ייפתח חלון תחתון עם אפשרויות ליצירת קשר.',
      },
      {
        q: 'אילו אפשרויות ניתן לבצע מחלון פרטי הקשר?',
        a: 'התקשרות ישירה (לחיצה מפעילה שיחה), שליחת הודעת וואטסאפ (נפתח בוואטסאפ), ושליחת מייל. הכפתורים מוצגים רק אם ההורה הזין את הפרטים הרלוונטיים.',
      },
      {
        q: 'מה הכיתות שמופיעות מתחת לשם?',
        a: 'שמות הכיתות שאליהן שייכים ילדי ההורה — מוצגים כתגיות כחולות. הכיתות מוצגות ללא שמות הילדים, כדי לשמור על פרטיות.',
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
        <span className="text-sm font-medium text-gray-800 flex-1 dark:text-gray-100">{q}</span>
        {open
          ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
          : <ChevronDown size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="pb-4 px-1">
          <p className="text-sm text-gray-600 leading-relaxed dark:text-gray-300">{a}</p>
        </div>
      )}
    </div>
  )
}

export default function HelpPage() {
  const { user, isAdmin } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')

  const q = searchQuery.trim().toLowerCase()

  const visibleSections = SECTIONS
    .filter(s =>
      s.roles.includes('all') ||
      s.roles.includes(user?.role) ||
      (isAdmin && s.roles.includes('admin'))
    )
    .map(s => ({
      ...s,
      faqs: q
        ? s.faqs.filter(f =>
            f.q.toLowerCase().includes(q) ||
            f.a.toLowerCase().includes(q)
          )
        : s.faqs,
    }))
    .filter(s => !q || s.faqs.length > 0 || s.title.toLowerCase().includes(q))

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 dark:text-white">
          <span className="text-2xl leading-none">❓</span>
          עזרה ושאלות נפוצות
        </h1>
        <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
          כל מה שצריך לדעת על האפליקציה
        </p>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-6">
        <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="חיפוש בשאלות ותשובות..."
          className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-right placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition dark:bg-gray-800 dark:border-gray-700"
        />
      </div>

      {q && visibleSections.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Search size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-gray-500 dark:text-gray-400">לא נמצאו תוצאות</p>
          <p className="text-sm mt-1">נסו מילת חיפוש אחרת</p>
        </div>
      )}

      <div className="space-y-4">
        {visibleSections.map(section => {
          const Icon = section.icon
          return (
            <div key={section.id} className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
              <div className={clsx('flex items-center gap-3 px-5 py-4', section.bg)}>
                <div className={clsx('p-2 rounded-xl bg-white/60', section.color)}>
                  <Icon size={18} />
                </div>
                <h2 className={clsx('font-semibold text-base', section.color)}>{section.title}</h2>
              </div>
              <div className="px-5 divide-y divide-gray-50 dark:divide-gray-700">
                {section.faqs.map((faq, i) => (
                  <FAQItem key={i} q={faq.q} a={faq.a} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 bg-primary-50 rounded-2xl p-5 text-center dark:bg-primary-900/30">
        <Star size={20} className="mx-auto text-primary-400 mb-2" />
        <p className="font-semibold text-primary-800 text-sm dark:text-primary-300">לא מצאתם תשובה?</p>
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
