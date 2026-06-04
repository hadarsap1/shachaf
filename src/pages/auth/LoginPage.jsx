import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Users, Shield, Home } from 'lucide-react'

const DEMO_ROLES = [
  {
    key: 'newFamily',
    label: 'משפחה חדשה',
    sub: 'צפייה במשימות, אירועים ועזר',
    icon: Home,
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
  },
  {
    key: 'hostFamily',
    label: 'משפחה מארחת',
    sub: 'ניהול משפחות מוקצות',
    icon: Users,
    iconBg: 'bg-secondary-100',
    iconColor: 'text-secondary-600',
  },
  {
    key: 'admin',
    label: 'מנהל / ועד',
    sub: 'ניהול משימות, טפסים ואירועים',
    icon: Shield,
    iconBg: 'bg-accent-100',
    iconColor: 'text-accent-600',
  },
  {
    key: 'superAdmin',
    label: 'מנהל ראשי',
    sub: 'הרשאות מלאות כולל ניהול מנהלים',
    icon: Shield,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    subtle: true,
  },
]

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(null)

  const handleLogin = async (roleKey) => {
    setLoading(roleKey)
    await new Promise(r => setTimeout(r, 400)) // simulate async
    login(roleKey)
    const roleToPath = {
      newFamily:  '/dashboard',
      hostFamily: '/dashboard',
      admin:      '/admin',
      superAdmin: '/admin',
    }
    navigate(roleToPath[roleKey] || '/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-700 via-primary-600 to-secondary-500 flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-white/5" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="bg-white rounded-3xl shadow-modal px-8 py-5 inline-block mb-4">
            <img src="/logo.png" alt="שחף" className="h-20 w-auto mx-auto" />
          </div>
          <p className="text-primary-100 text-sm">פלטפורמת קליטה של הקהילה</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-modal p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-1 text-center">כניסה לחשבון</h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            בחר את תפקידך כדי להתחיל
          </p>

          {/* Demo role cards */}
          <div className="space-y-3 mb-6">
            {DEMO_ROLES.map((role) => {
              const Icon = role.icon
              return (
                <button
                  key={role.key}
                  onClick={() => handleLogin(role.key)}
                  disabled={loading !== null}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200 group active:scale-98
                    ${role.subtle
                      ? 'border-dashed border-gray-200 hover:border-red-200 hover:bg-red-50/30'
                      : 'border-gray-100 hover:border-primary-200 hover:bg-primary-50/50'
                    }`}
                >
                  <div className={`p-2.5 rounded-xl ${role.iconBg} group-hover:scale-105 transition-transform`}>
                    <Icon size={20} className={role.iconColor} />
                  </div>
                  <div className="text-right flex-1">
                    <div className={`font-semibold text-sm ${role.subtle ? 'text-gray-600' : 'text-gray-800'}`}>{role.label}</div>
                    <div className="text-xs text-gray-500">{role.sub}</div>
                  </div>
                  {loading === role.key && (
                    <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
              🔐 בגרסה זו: כניסה ישירה לדמו. חיבור Supabase יתבצע בשלב הבא.
            </p>
          </div>
        </div>

        <p className="text-center text-primary-200 text-xs mt-4">
          בית הספר שחף © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
