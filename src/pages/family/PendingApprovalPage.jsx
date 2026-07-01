import { Clock3, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function PendingApprovalPage() {
  const { logout } = useAuth()
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 px-6 text-center" dir="rtl">
      <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
        <Clock3 size={28} className="text-amber-600 dark:text-amber-400" />
      </div>
      <h1 className="text-xl font-black text-gray-800 dark:text-gray-100 mb-2">החשבון שלך ממתין לאישור</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
        מנהל הכיתה שלכם צריך לאשר את הצטרפותכם לפני שתוכלו לגשת לאפליקציה. תקבלו הודעה כשהחשבון יאושר.
      </p>
      <button
        onClick={logout}
        className="mt-6 flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <LogOut size={15} />
        התנתקות
      </button>
    </div>
  )
}
