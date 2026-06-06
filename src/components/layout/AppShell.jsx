import { useState, useEffect } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getMessages } from '../../lib/db'
import InstallBanner from '../ui/InstallBanner'
import {
  Home, CheckSquare, Calendar, CalendarDays, Users,
  LayoutDashboard, BookOpen, MessageCircle, Menu, X,
  LogOut, ChevronDown, Activity, FileText, SlidersHorizontal,
  ClipboardList, Shield, MessageSquare, Upload,
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
    { to: '/contact', label: 'צור קשר', icon: MessageSquare },
    { to: '/settings', label: 'הגדרות', icon: SlidersHorizontal },
  ],
  host_family: [
    { to: '/dashboard', label: 'בית', icon: Home },
    { to: '/families', label: 'המשפחות שלי', icon: Users },
    { to: '/events', label: 'אירועים', icon: Calendar },
    { to: '/forms', label: 'הטפסים שלי', icon: ClipboardList },
    { to: '/resources', label: 'מידע שימושי', icon: BookOpen },
    { to: '/chat', label: 'עוזר חכם', icon: MessageCircle },
    { to: '/contact', label: 'צור קשר', icon: MessageSquare },
    { to: '/settings', label: 'הגדרות', icon: SlidersHorizontal },
  ],
  admin: [
    { to: '/admin', label: 'לוח בקרה', icon: LayoutDashboard },
    { to: '/admin/users', label: 'משפחות', icon: Users },
    { to: '/admin/import', label: 'ייבוא משפחות', icon: Upload, sub: true },
    { to: '/admin/tasks', label: 'משימות', icon: CheckSquare },
    { to: '/admin/events', label: 'אירועים', icon: Calendar },
    { to: '/admin/calendar', label: 'לוח שנה', icon: CalendarDays },
    { to: '/admin/forms', label: 'טפסים', icon: ClipboardList },
    { to: '/admin/messages', label: 'הודעות', icon: MessageSquare, badge: true },
    { to: '/admin/activity', label: 'פעילות', icon: Activity },
  ],
  super_admin: [
    { to: '/admin', label: 'לוח בקרה', icon: LayoutDashboard },
    { to: '/admin/users', label: 'משפחות', icon: Users },
    { to: '/admin/import', label: 'ייבוא משפחות', icon: Upload, sub: true },
    { to: '/admin/tasks', label: 'משימות', icon: CheckSquare },
    { to: '/admin/events', label: 'אירועים', icon: Calendar },
    { to: '/admin/calendar', label: 'לוח שנה', icon: CalendarDays },
    { to: '/admin/forms', label: 'טפסים', icon: ClipboardList },
    { to: '/admin/messages', label: 'הודעות', icon: MessageSquare, badge: true },
    { to: '/admin/activity', label: 'פעילות', icon: Activity },
    { to: '/super/admins', label: 'מנהלים', icon: Shield },
  ],
}

const BOTTOM_NAV = {
  new_family:  ['/dashboard', '/tasks', '/events', '/contact'],
  host_family: ['/dashboard', '/families', '/events', '/contact'],
  admin:       ['/admin', '/admin/users', '/admin/tasks', '/admin/messages'],
  super_admin: ['/admin', '/admin/users', '/admin/tasks', '/admin/messages'],
}

function NavLink({ to, label, icon: Icon, onClick, unread = 0, sub = false }) {
  const { pathname } = useLocation()
  const active = pathname === to || (to !== '/dashboard' && to !== '/admin' && pathname.startsWith(to))

  return (
    <Link
      to={to}
      onClick={onClick}
      className={clsx(
        'flex items-center gap-3 rounded-xl font-medium transition-all duration-150',
        sub
          ? 'px-3 py-2 text-xs me-4'
          : 'px-3 py-2.5 text-sm',
        active
          ? sub ? 'bg-primary-500/60 text-white' : 'bg-primary-600 text-white shadow-sm'
          : sub ? 'text-primary-200 hover:bg-primary-600/40 hover:text-white' : 'text-primary-100 hover:bg-primary-600/50 hover:text-white'
      )}
    >
      <Icon size={sub ? 14 : 18} className="flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {unread > 0 && (
        <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
          {unread}
        </span>
      )}
    </Link>
  )
}

function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false)
  const isUrl = (s) => typeof s === 'string' && s.startsWith('http')
  const roleLabel = {
    new_family:  'משפחה חדשה',
    host_family: 'משפחה מארחת',
    admin:       'מנהל',
    super_admin: 'מנהל ראשי',
  }[user?.role] || ''

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-primary-600/50 transition-colors w-full"
      >
        {isUrl(user?.avatar)
          ? <img src={user.avatar} alt="" className="w-8 h-8 rounded-full flex-shrink-0 object-cover" />
          : <div className="avatar w-8 h-8 text-sm bg-accent-400 flex-shrink-0">{user?.name?.[0] || '?'}</div>
        }
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
  const { user, logout, isAdmin } = useAuth()
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const links = NAV_LINKS[user?.role] || []

  const bottomNavPaths = BOTTOM_NAV[user?.role] || []
  const bottomLinks = links.filter(l => bottomNavPaths.includes(l.to))

  useEffect(() => {
    if (!isAdmin) return
    getMessages().then(msgs => setUnreadMessages(msgs.filter(m => !m.read).length))
  }, [isAdmin])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-primary-700 text-white flex-shrink-0" dir="rtl">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-primary-600 bg-white">
          <img src="/logo.png" alt="שחף" className="h-12 w-auto mx-auto" />
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map(link => (
            <NavLink key={link.to} {...link} unread={link.badge ? unreadMessages : 0} sub={!!link.sub} />
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
          <aside className="absolute top-0 right-0 h-full w-72 bg-primary-700 flex flex-col animate-slide-up" dir="rtl">
            {/* In RTL, justify-between puts the first child on the visual RIGHT and the second on the LEFT.
                The sidebar slides in from the right, so the close button should be on the visual right (first child). */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-primary-600 bg-white">
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="סגור תפריט"
                className="text-primary-400 hover:text-primary-700 p-1"
              >
                <X size={20} />
              </button>
              <img src="/logo.png" alt="שחף" className="h-10 w-auto" />
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {links.map(link => (
                <NavLink key={link.to} {...link} unread={link.badge ? unreadMessages : 0} sub={!!link.sub} onClick={() => setSidebarOpen(false)} />
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
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="פתח תפריט"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <Menu size={20} />
          </button>
          <img src="/logo.png" alt="שחף" className="h-9 w-auto" />
        </header>

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </main>

        <InstallBanner />

        {/* Mobile bottom nav */}
        {bottomLinks.length > 0 && (
          <nav className="md:hidden flex items-center justify-around border-t border-gray-100 bg-white px-2 py-1 pb-[env(safe-area-inset-bottom)] flex-shrink-0">
            {bottomLinks.map(link => {
              const Icon = link.icon
              const active = pathname === link.to || (link.to !== '/dashboard' && link.to !== '/admin' && pathname.startsWith(link.to))
              return (
                <Link key={link.to} to={link.to}
                  className={clsx('flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-medium transition-all relative',
                    active ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600')}>
                  <div className="relative">
                    <Icon size={22} />
                    {link.badge && unreadMessages > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {unreadMessages}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px]">{link.label}</span>
                </Link>
              )
            })}
          </nav>
        )}
      </div>
    </div>
  )
}
