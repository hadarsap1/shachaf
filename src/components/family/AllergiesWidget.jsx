import { useState } from 'react'
import { ChevronDown, ChevronUp, Check, X } from 'lucide-react'
import clsx from 'clsx'

// ponytail: static content, summarized from the community chat (last staff update: Sept 2026).
// Move to Firestore if admins need to edit it without a deploy.
const ALLERGENS = ['בוטנים', 'שומשום', 'קשיו', 'פיסטוק', 'פקאן']

const MODES = {
  personal: {
    label: 'קופסה אישית',
    hint: 'אוכל שהילד אוכל לבד',
    rules: [
      { ok: false, text: 'מכיל אחד מהאלרגנים' },
      { ok: true, text: '"עלול להכיל": מותר' },
    ],
  },
  shared: {
    label: 'מזון משותף',
    hint: 'כיבוד לכיתה, יום הולדת, יריד, שולחן קהילתי',
    rules: [
      { ok: false, text: 'מכיל אחד מהאלרגנים' },
      { ok: false, text: '"עלול להכיל" שומשום או אגוזים: גם אסור' },
      { ok: true, text: '"עלול להכיל בוטנים": מותר' },
    ],
  },
}

const FAQS = [
  {
    q: 'אילו אלרגנים אסור להכניס לבית הספר?',
    a: 'בוטנים, שומשום, ואגוזים מסוג קשיו, פיסטוק ופקאן. ההנחיה חלה על כל בית הספר, כולל הגנים.',
  },
  {
    q: 'מה ההבדל בין "מכיל" ל"עלול להכיל"?',
    a: '"מכיל": האלרגן הוא רכיב במוצר, ולכן אסור בכל מצב. "עלול להכיל": המוצר יוצר בסביבה שיש בה את האלרגן. בקופסה האישית זה מותר; במזון שמגישים לכולם זה אסור, כי גם הילד האלרגי עלול לקחת ממנו. חוץ מ"עלול להכיל בוטנים", שמותר גם במזון משותף.',
  },
  {
    q: 'מותר להביא "עלול להכיל" לאירוע או לשולחן משותף?',
    a: 'רק "עלול להכיל בוטנים". כל מה שמוגש לכולם (כיבוד לכיתה, ימי הולדת, ירידים ואירועי קהילה) צריך להיות נקי מ"עלול להכיל" שומשום, קשיו, פיסטוק ופקאן.',
  },
  {
    q: 'טחינה, חלווה, חומוס קנוי?',
    a: 'אסור: כולם מכילים שומשום. חומוס קנוי מכיל כמעט תמיד טחינה. כך גם לגבי בייגלה, בורקס או לחמניות עם שומשום.',
  },
  {
    q: 'במבה?',
    a: 'במבה רגילה מכילה בוטנים ולכן אסורה. מוצרים שמסומנים רק "עלול להכיל בוטנים", כמו במבה אדומה או צ\'יטוס איקסים ועיגולים, מותרים.',
  },
  {
    q: 'לחמניות ומאפים מהמאפייה?',
    a: 'רוב מוצרי המאפייה "עלולים להכיל" שומשום גם כשאין עליהם שומשום. בקופסה האישית זה בסדר. לשולחן משותף עדיף מוצר ארוז עם סימון ברור.',
  },
  {
    q: 'אוכל ביתי לשולחן משותף?',
    a: 'שימו לב: אם במטבח יש שומשום, קשיו, פיסטוק או פקאן, גם מאכל ביתי נחשב "עלול להכיל". במקרה של ספק, עדיף להביא משהו אחר.',
  },
  {
    q: 'שקדים, אגוזי לוז, נוטלה?',
    a: 'אינם ברשימת האלרגנים ולכן מותרים, כל עוד המוצר לא מכיל גם בוטנים, שומשום, קשיו, פיסטוק או פקאן.',
  },
  {
    q: 'סויה ואדממה?',
    a: 'סויה אינה ברשימת האלרגנים ולכן מותרת.',
  },
  {
    q: 'יש הגבלות נוספות באירועים מיוחדים?',
    a: 'לפעמים. למשל בחגיגות עם הגנים נוספו חומוס ופול לרשימה. בנוסף, באירועים קהילתיים חשוב להביא גם אפשרויות ללא גלוטן. עקבו אחרי ההודעה של כל אירוע.',
  },
  {
    q: 'מה לגבי הצהרון והקייטנה?',
    a: 'אם הפעילות מתקיימת במבנה בית הספר, שומרים על אותן הנחיות, כדי שהמרחב יישאר נקי מאלרגנים. לבירור פנו לאחראית הצהרון.',
  },
  {
    q: 'למי פונים כשיש ספק?',
    a: 'לצוות בית הספר, שהוא הגורם המוסמך. הכלל הפשוט: אם לא בטוחים, לא מביאים.',
  },
]

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-3 py-3 px-4 text-right"
      >
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100 flex-1">{q}</span>
        {open
          ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
          : <ChevronDown size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />}
      </button>
      {open && (
        <p className="pb-3 px-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{a}</p>
      )}
    </div>
  )
}

export default function AllergiesWidget() {
  const [mode, setMode] = useState('personal')
  const current = MODES[mode]

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="section-title flex items-center gap-2">
          <span className="text-xl leading-none">🥜</span>
          הנחיות אלרגיות
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/40">
          <div className="text-xs font-semibold text-red-700 dark:text-red-300 mb-2">לא נכנסים לבית הספר:</div>
          <div className="flex flex-wrap gap-1.5">
            {ALLERGENS.map(a => (
              <span key={a} className="text-xs font-medium px-2.5 py-1 rounded-full bg-white dark:bg-gray-800 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                {a}
              </span>
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">מה אני מביא?</div>
          <div role="tablist" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-700/60 mb-3">
            {Object.entries(MODES).map(([id, m]) => (
              <button
                key={id}
                role="tab"
                aria-selected={mode === id}
                onClick={() => setMode(id)}
                className={clsx(
                  'text-sm font-medium py-1.5 rounded-lg transition-colors',
                  mode === id
                    ? 'bg-white dark:bg-gray-800 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-400 mb-2">{current.hint}</div>
          <ul className="space-y-1.5">
            {current.rules.map(r => (
              <li key={r.text} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <span className={clsx(
                  'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                  r.ok ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                       : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                )}>
                  {r.ok ? <Check size={12} /> : <X size={12} />}
                </span>
                {r.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-700">
          <div className="px-4 pt-3 text-xs font-semibold text-gray-500 dark:text-gray-400">שאלות נפוצות</div>
          {FAQS.map(f => <FAQItem key={f.q} {...f} />)}
        </div>
      </div>
    </section>
  )
}
