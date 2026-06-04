import { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Home, CheckSquare, Calendar, Users,
  LayoutDashboard, BookOpen, MessageCircle, Menu, X,
  LogOut, ChevronDown, Activity, FileText, SlidersHorizontal,
  ClipboardList, Shield,
} from 'lucide-react'
import clsx from 'clsx'

const NAV_LINKS = {
  new_family: [
    { to: '/dashboard', label: 'בית', icon: Home },
    { to: '/tasks', label: 'משימות', icon: CheckSquare },
    { to: '/events', label: 'אירועים', icon: Calendar },
    { to: '/forms', label: 'הטפסים שלי', icon: ClipboardList },
    { to: '/resources', label: 'מידע שימושי', icon: BookOpen },
    { to: '/chat', label: 'עוזר חכם', icon: MessageCircle },
    { to: '/settings', label: 'הגדרות', icon: SlidersHorizontal },
  ],
  host_family: [
    { to: '/dashboard', label: 'בית', icon: Home },
    { to: '/families', label: 'המשפחות שלי', icon: Users },
    { to: '/events', label: 'אירועים', icon: Calendar },
    { to: '/forms', label: 'הטפסים שלי', icon: ClipboardList },
    { to: '/resources', label: 'מידע שימושי', icon: BookOpen },
    { to: '/chat', label: 'עוזר חכם', icon: MessageCircle },
    { to: '/settings', label: 'הגדרות', icon: SlidersHorizontal },
  ],
  admin: [
    { to: '/admin', label: 'לוח בקרה', icon: LayoutDashboard },
    { to: '/admin/users', label: 'משפחות', icon: Users },
    { to: '/admin/tasks', label: 'משימות', icon: CheckSquare },
    { to: '/admin/events', label: 'אירועים', icon: Calendar },
    { to: '/admin/forms', label: 'טפסים', icon: ClipboardList },
    { to: '/admin/activity', label: 'פעילות', icon: Activity },
  ],
  super_admin: [
    { to: '/admin', label: 'לוח בקרה', icon: LayoutDashboard },
    { to: '/admin/users', label: 'משפחות', icon: Users },
    { to: '/admin/tasks', label: 'משימות', icon: CheckSquare },
    { to: '/admin/events', label: 'אירועים', icon: Calendar },
    { to: '/admin/forms', label: 'טפסים', icon: ClipboardList },
    { to: '/admin/activity', label: 'פעילות', icon: Activity },
    { to: '/super/admins', label: 'מנהלים', icon: Shield },
  ],
}

function NavLink({ to, label, icon: Icon, onClick }) {
  const { pathname } = useLocation()
  const active = pathname === to || (to !== '/dashboard' && to !== '/admin' && pathname.startsWith(to))

  return (
    <Link
      to={to}
      onClick={onClick}
      className={clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
        active
          ? 'bg-primary-600 text-white shadow-sm'
          : 'text-primary-100 hover:bg-primary-600/50 hover:text-white'
      )}
    >
      <Icon size={18} className="flex-shrink-0" />
      <span>{label}</span>
    </Link>
  )
}

function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false)
  const initials = user?.avatar || user?.name?.[0] || '?'
  const roleLabel = {
    new_family: 'משפחה חדשה',
    host_family: 'משפחה מארחת',
    admin: 'מנהל',
  }[user?.role] || ''

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-primary-600/50 transition-colors w-full"
      >
        <div className="avatar w-8 h-8 text-sm bg-accent-400 flex-shrink-0">
          {initials}
        </div>
        <div className="text-right flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{user?.name}</div>
          <div className="text-xs text-primary-200">{roleLabel}</div>
        </div>
        <ChevronDown size={14} className={clsx('text-primary-200 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl shadow-modal border border-gray-100 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-sm font-semibold text-gray-800">{user?.name}</div>
            <div className="text-xs text-gray-500">{user?.email}</div>
          </div>
          <button
            onClick={() => { setOpen(false); logout() }}
            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={16} />
            התנתקות
          </button>
        </div>
      )}
    </div>
  )
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const links = NAV_LINKS[user?.role] || []

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-primary-700 text-white flex-shrink-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-primary-600 bg-white">
          <img src="/logo.png" alt="שחף" className="h-12 w-auto mx-auto" />
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map(link => (
            <NavLink key={link.to} {...link} />
          ))}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-primary-600">
          <UserMenu user={user} logout={logout} />
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute top-0 right-0 h-full w-72 bg-primary-700 flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-4 py-4 border-b border-primary-600 bg-white">
              <button onClick={() => setSidebarOpen(false)} className="text-primary-400 hover:text-primary-700 p-1">
                <X size={20} />
              </button>
              <img src="/logo.png" alt="שחף" className="h-10 w-auto" />
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {links.map(link => (
                <NavLink key={link.to} {...link} onClick={() => setSidebarOpen(false)} />
              ))}
            </nav>
            <div className="px-3 py-4 border-t border-primary-600">
              <UserMenu user={user} logout={logout} />
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
          <img src="/logo.png" alt="שחף" className="h-9 w-auto" />
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <Menu size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
