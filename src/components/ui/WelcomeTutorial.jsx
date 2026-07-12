import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

const STORAGE_KEY = 'shachaf_tutorial_done'

const STEPS = [
  {
    emoji: '🎉',
    title: 'ברוכים הבאים לשחף!',
    body: 'הפלטפורמה הקהילתית שלנו — כאן תמצאו את כל המידע, המשימות והאירועים במקום אחד.',
  },
  {
    emoji: '🏠',
    title: 'מסך הבית',
    body: 'בדף הראשי תראו סיכום של המשימות, האירועים הקרובים, טפסים למילוי והכיתה שלכם. אפשר לסדר ולהסתיר ווידג\'טים בלחיצה על ⚙️.',
  },
  {
    emoji: '🎓',
    title: 'הכיתה שלי',
    body: 'צפו בפרטי הכיתה, הילדים ומשפחות נוספות. כאן גם תוכלו לעדכן פרטים ותמונות של הילדים.',
  },
  {
    emoji: '✅',
    title: 'משימות',
    body: 'משימות שהוקצו לכם מהצוות — סמנו כ"בוצע" ככל שתתקדמו. משימות דחופות מסומנות באדום.',
  },
  {
    emoji: '📅',
    title: 'אירועים',
    body: 'כל אירועי בית הספר והקהילה — עם אפשרות לאשר הגעה (RSVP) ולהוסיף ליומן.',
  },
  {
    emoji: '🤝',
    title: 'קהילה',
    body: 'הצטרפו לקבוצות תחביבים, ועדות, ושתפו עסקים מקומיים. זה המקום ליצור קשרים!',
  },
  {
    emoji: '💬',
    title: 'עוזר חכם וצור קשר',
    body: 'יש שאלה? נסו את העוזר החכם (AI) שיודע לענות על שאלות לגבי הקליטה, או פנו ישירות לצוות דרך "צור קשר".',
  },
  {
    emoji: '🚀',
    title: 'מוכנים? יאללה!',
    body: 'זהו! אפשר תמיד לגשת לעזרה דרך התפריט. בהצלחה בקליטה וברוכים הבאים לקהילת שחף! 💙',
  },
]

export default function WelcomeTutorial({ onDone }) {
  const [step, setStep] = useState(0)
  const [exiting, setExiting] = useState(false)

  const finish = () => {
    setExiting(true)
    localStorage.setItem(STORAGE_KEY, '1')
    setTimeout(() => onDone(), 300)
  }

  const s = STEPS[step]
  const isLast = step === STEPS.length - 1

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className={clsx(
        'fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300',
        exiting ? 'opacity-0' : 'opacity-100'
      )}
      dir="rtl"
    >
      <div className={clsx(
        'relative w-[92%] max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden transition-transform duration-300',
        exiting ? 'scale-95' : 'scale-100'
      )}>
        {/* Skip */}
        <button
          onClick={finish}
          className="absolute top-4 start-4 z-10 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors dark:text-gray-300"
          aria-label="דלג על ההדרכה"
        >
          <X size={14} />
          דלג
        </button>

        {/* Content */}
        <div className="px-8 pt-12 pb-6 text-center">
          <div className="text-6xl mb-4 animate-bounce">{s.emoji}</div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">{s.title}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed min-h-[60px]">{s.body}</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={clsx(
                'rounded-full transition-all duration-200',
                i === step ? 'w-6 h-2 bg-primary-500' : 'w-2 h-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
              )}
              aria-label={`שלב ${i + 1}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 pb-6">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className={clsx(
              'flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors',
              step === 0
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            <ChevronRight size={16} />
            הקודם
          </button>

          <button
            onClick={isLast ? finish : () => setStep(s => s + 1)}
            className="flex items-center gap-1 px-6 py-2.5 rounded-xl text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            {isLast ? 'יאללה, מתחילים!' : 'הבא'}
            {!isLast && <ChevronLeft size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}

export function shouldShowTutorial() {
  return !localStorage.getItem(STORAGE_KEY)
}
