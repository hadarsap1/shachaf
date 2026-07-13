import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getChildrenByParent, getMyConsentLog } from '../../lib/db'
import {
  CONSENT_VERSION, CONSENT_PURPOSES, CONSENT_EXPOSURE, CONSENT_DATA_LOCATION,
} from '../../lib/consent'
import {
  ShieldCheck, Server, ScrollText, UserCheck, Database,
  FileText, Accessibility, ExternalLink, Loader2, CheckCircle2,
} from 'lucide-react'

function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Card({ icon: Icon, title, children }) {
  return (
    <section className="card p-5">
      <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2 justify-end dark:text-gray-200">
        {title}
        <Icon size={16} className="text-primary-600 dark:text-primary-400" />
      </h2>
      {children}
    </section>
  )
}

// Human-readable labels for consentLog entry types
const CONSENT_TYPE_LABELS = {
  initial_consent: 'אישור תקנון ומדיניות פרטיות',
  child_photo:     'אישור הצגת תמונת ילד/ה',
  join_committee:  'אישור הצטרפות לוועדה',
  join_group:      'אישור הצטרפות לקבוצה',
  event_publish:   'אישור פרסום אירוע',
}

export default function MyPrivacyPage() {
  const { user } = useAuth()
  const [children, setChildren] = useState([])
  const [log, setLog] = useState(null)

  useEffect(() => {
    if (!user?.uid) return
    getChildrenByParent(user.uid).then(setChildren).catch(() => {})
    getMyConsentLog(user.uid).then(setLog).catch(() => setLog([]))
  }, [user?.uid])

  const storedFields = [
    { label: 'שם מלא', value: user?.name },
    { label: 'אימייל', value: user?.email },
    { label: 'טלפון', value: user?.phone },
    { label: 'כתובת', value: user?.address },
    { label: 'תמונת פרופיל', value: user?.avatar ? 'הועלתה' : '' },
  ].filter(f => f.value)

  return (
    <div className="page-container rtl space-y-4" dir="rtl">
      <div className="mb-2">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 dark:text-primary-300">
          <span className="text-2xl leading-none">🔒</span>
          הפרטיות שלי
        </h1>
        <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">
          כל המידע על הנתונים שלך, ההסכמות שנתת והזכויות שלך — במקום אחד
        </p>
      </div>

      {/* Consent status */}
      <Card icon={ShieldCheck} title="סטטוס הסכמה">
        <div className="flex items-center gap-2 justify-end text-sm text-green-700 dark:text-green-400">
          אישרת את התקנון (גרסה {user?.consentVersion || CONSENT_VERSION})
          {user?.consentAt && <span className="text-gray-400 text-xs">· {formatDate(user.consentAt)}</span>}
          <CheckCircle2 size={16} className="flex-shrink-0" />
        </div>
        <p className="text-xs text-gray-500 mt-3 text-right dark:text-gray-400">המידע שמסרת משמש אך ורק למטרות הבאות:</p>
        <ul className="mt-1.5 space-y-1">
          {CONSENT_PURPOSES.map((p, i) => (
            <li key={i} className="text-sm text-gray-700 dark:text-gray-200 text-right">{i + 1}. {p}</li>
          ))}
        </ul>
        <div className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-0.5 text-right">מי חשוף למידע שלך</p>
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed text-right">{CONSENT_EXPOSURE}</p>
        </div>
      </Card>

      {/* What we store */}
      <Card icon={Database} title="המידע השמור עליך">
        {storedFields.length === 0 ? (
          <p className="text-sm text-gray-400 text-right">לא נשמרו פרטים מעבר לחשבון עצמו</p>
        ) : (
          <ul className="space-y-1.5">
            {storedFields.map(f => (
              <li key={f.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-700 dark:text-gray-200 truncate" dir="auto">{f.value}</span>
                <span className="text-gray-400 text-xs flex-shrink-0">{f.label}</span>
              </li>
            ))}
          </ul>
        )}
        {children.length > 0 && (
          <>
            <p className="text-xs text-gray-500 mt-3 mb-1.5 text-right dark:text-gray-400">ילדים המקושרים לחשבונך:</p>
            <ul className="space-y-1.5">
              {children.map(c => (
                <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-400 text-xs flex-shrink-0">
                    {c.photoUrl ? 'כולל תמונה' : 'ללא תמונה'}
                  </span>
                  <span className="text-gray-700 dark:text-gray-200">{c.name}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-xs text-gray-400 mt-3 text-right">
          ניתן לעדכן או למחוק פרטים בכל עת מתוך{' '}
          <Link to="/settings" className="underline text-primary-600 dark:text-primary-400">הגדרות</Link>
        </p>
      </Card>

      {/* Where the data is stored */}
      <Card icon={Server} title="איפה המידע נשמר">
        <p className="text-sm text-gray-700 leading-relaxed text-right dark:text-gray-200">{CONSENT_DATA_LOCATION}</p>
      </Card>

      {/* Consent history */}
      <Card icon={ScrollText} title="היסטוריית ההסכמות שלי">
        {log === null ? (
          <div className="flex justify-center py-3"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
        ) : log.length === 0 ? (
          <p className="text-sm text-gray-400 text-right">
            אין רישומי הסכמה עדיין — הסכמות חדשות (אישור תקנון, תמונות, הצטרפויות) יתועדו כאן
          </p>
        ) : (
          <ul className="divide-y divide-gray-50 dark:divide-gray-700">
            {log.map(entry => (
              <li key={entry.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-400 text-xs flex-shrink-0">{formatDate(entry.createdAt)}</span>
                <span className="text-gray-700 dark:text-gray-200 text-right">
                  {entry.label || CONSENT_TYPE_LABELS[entry.type] || entry.type}
                  {entry.context && <span className="text-gray-400 text-xs"> · {entry.context}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Rights */}
      <Card icon={UserCheck} title="הזכויות שלך">
        <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-200 text-right">
          <li><strong>עיון</strong> — לקבל עותק של המידע השמור עליך (עמוד זה ועמוד ההגדרות)</li>
          <li><strong>תיקון</strong> — לעדכן כל פרט מתוך "הגדרות"</li>
          <li><strong>מחיקה</strong> — לבקש מחיקת פרטים או את מחיקת החשבון כולו</li>
          <li><strong>חזרה מהסכמה</strong> — ניתן לחזור בך מהסכמה בכל עת בפנייה לצוות הניהול</li>
        </ul>
        <Link to="/contact" className="mt-3 inline-flex btn-primary text-sm py-2 px-4">
          פנייה לצוות בנושא פרטיות
        </Link>
      </Card>

      {/* Legal links */}
      <Card icon={FileText} title="מסמכים">
        <div className="space-y-2">
          <Link to="/legal/privacy" target="_blank" className="flex items-center justify-between text-sm text-primary-600 dark:text-primary-400 hover:underline">
            <ExternalLink size={13} className="flex-shrink-0" />
            מדיניות הפרטיות המלאה
          </Link>
          <Link to="/legal/terms" target="_blank" className="flex items-center justify-between text-sm text-primary-600 dark:text-primary-400 hover:underline">
            <ExternalLink size={13} className="flex-shrink-0" />
            תנאי השימוש
          </Link>
          <Link to="/legal/accessibility" target="_blank" className="flex items-center justify-between text-sm text-primary-600 dark:text-primary-400 hover:underline">
            <Accessibility size={13} className="flex-shrink-0" />
            הצהרת נגישות
          </Link>
        </div>
      </Card>
    </div>
  )
}
