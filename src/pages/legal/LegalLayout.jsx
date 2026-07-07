import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

function Section({ title, children }) {
  return (
    <div>
      <h2 className="font-semibold text-gray-900 text-base mb-2 dark:text-gray-100">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function P({ children }) {
  return <p className="text-gray-700 leading-relaxed dark:text-gray-200">{children}</p>
}

function Ul({ items }) {
  return (
    <ul className="list-disc list-inside space-y-1 text-gray-700 leading-relaxed marker:text-gray-400 dark:text-gray-200">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}

export { Section, P, Ul }

export default function LegalLayout({ title, children }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 dark:text-gray-400"
        >
          <ChevronRight size={16} />
          חזרה
        </button>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1 dark:text-gray-100">{title}</h1>
          <p className="text-xs text-gray-400 mb-6 pb-6 border-b border-gray-100">
            עודכן לאחרונה: יוני 2026
          </p>
          <div className="space-y-7 text-sm">
            {children}
          </div>
        </div>

        <div className="flex justify-center gap-4 mt-6 text-xs text-gray-400">
          <Link to="/terms" className="hover:text-gray-600 dark:text-gray-300">תנאי שימוש</Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-gray-600 dark:text-gray-300">מדיניות פרטיות</Link>
          <span>·</span>
          <Link to="/accessibility" className="hover:text-gray-600 dark:text-gray-300">נגישות</Link>
        </div>
        <p className="text-center text-gray-400 text-xs mt-2">
          קהילת שחף © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
