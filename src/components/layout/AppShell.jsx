import { useState, useEffect } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { getMessages } from '../../lib/db'
import InstallBanner from '../ui/InstallBanner'
import { Menu, X, LogOut, ChevronDown, Sun, Moon } from 'lucide-react'
import clsx from 'clsx'

// ── Emoji icon map (used across nav + bottom bar) ──────────────────────────────
export const NAV_EMOJI = {
  '/dashboard':       '🏠',
  '/class':           '🎓',
  '/class-roster':    '👥',
  '/families':        '👨‍👩‍👧',
  '/tasks':           '✅',
  '/events':          '📅',
  '/committees':      '🔗',
  '/community':       '🤝',
  '/forms':           '📋',
  '/resources':       '📖',
  '/contact':         '💬',
  '/help':            '❓',
  '/settings':        '⚙️',
  '/admin':           '🏛️',
  '/admin/users':     '👥',
  '/admin/classes':   '🎓',
  '/admin/children':  '🧒',
  '/admin/committees':'🛡️',
  '/admin/community': '🤝',
  '/admin/tasks':     '✅',
  '/admin/events':    '📅',
  '/admin/forms':     '📋',
  '/admin/resources': '📖',
  '/admin/messages':  '💬',
  '/admin/activity':  '📊',
  '/admin/emergency': '🚨',
  '/admin/import':    '📥',
  '/super/admins':    '🛡️',
}

const ADMIN_NAV_LINKS = {
  admin: [
    { to: '/admin',            label: 'מסך הבית' },
    { to: '/admin/users',      label: 'משפחות' },
    { to: '/admin/classes',    label: 'כיתות' },
    { to: '/admin/children',   label: 'ילדים', sub: true },
    { to: '/admin/committees', label: 'ועדות' },
    { to: '/admin/community',  label: 'קבוצות קהילה' },
    { to: '/admin/tasks',      label: 'משימות' },
    { to: '/admin/events',     label: 'אירועים' },
    { to: '/admin/forms',      label: 'טפסים' },
    { to: '/admin/resources',  label: 'מידע שימושי' },
    { to: '/admin/messages',   label: 'הודעות', badge: true },
    { to: '/admin/activity',   label: 'פעילות' },
    { to: '/admin/emergency',  label: 'מצב חירום' },
    { to: '/help',             label: 'עזרה' },
  ],
  super_admin: [
    { to: '/admin',            label: 'מסך הבית' },
    { to: '/admin/users',      label: 'משפחות' },
    { to: '/admin/classes',    label: 'כיתות' },
    { to: '/admin/children',   label: 'ילדים', sub: true },
    { to: '/admin/committees', label: 'ועדות' },
    { to: '/admin/community',  label: 'קבוצות קהילה' },
    { to: '/admin/tasks',      label: 'משימות' },
    { to: '/admin/events',     label: 'אירועים' },
    { to: '/admin/forms',      label: 'טפסים' },
    { to: '/admin/resources',  label: 'מידע שימושי' },
    { to: '/admin/messages',   label: 'הודעות', badge: true },
    { to: '/admin/activity',   label: 'פעילות' },
    { to: '/admin/emergency',  label: 'מצב חירום' },
    { to: '/super/admins',     label: 'מנהלים' },
    { to: '/help',             label: 'עזרה' },
  ],
}

function buildMemberNav(allRoles, classIds) {
  const links = []
  const hasClass = allRoles.has('new_family') || allRoles.has('host_family') || (classIds && classIds.length > 0)

  links.push({ to: '/dashboard', label: 'בית' })
  if (hasClass) {
    links.push({ to: '/class',        label: 'הכיתה שלי' })
    links.push({ to: '/class-roster', label: 'ספריית כיתה' })
  }
  if (allRoles.has('host_family'))
    links.push({ to: '/families', label: 'המשפחות שלי' })
  if (allRoles.has('new_family') || allRoles.has('host_family'))
    links.push({ to: '/tasks', label: 'משימות' })

  links.push({ to: '/events',     label: 'אירועים' })
  links.push({ to: '/committees', label: 'ועדות' })
  links.push({ to: '/community',  label: 'קבוצות קהילה' })

  if (allRoles.has('new_family') || allRoles.has('host_family'))
    links.push({ to: '/forms', label: 'הטפסים שלי' })

  links.push({ to: '/resources', label: 'מידע שימושי' })
  links.push({ to: '/contact',   label: 'צור קשר' })
  links.push({ to: '/help',      label: 'עזרה' })
  links.push({ to: '/settings',  label: 'הגדרות' })
  return links
}

function getMemberBottomNav(allRoles, classIds) {
  const hasClass = allRoles.has('new_family') || allRoles.has('host_family') || (classIds && classIds.length > 0)
  const hasForms = allRoles.has('new_family') || allRoles.has('host_family')
  if (hasClass && hasForms) return ['/dashboard', '/class', '/events', '/forms']
  if (hasClass)             return ['/dashboard', '/class', '/events', '/resources']
  return ['/dashboard', '/events', '/resources', '/contact']
}

const ADMIN_BOTTOM_NAV = ['/admin', '/admin/users', '/admin/tasks', '/admin/messages']

// ── NavLink ────────────────────────────────────────────────────────────────────
function NavLink({ to, label, onClick, unread = 0, sub = false }) {
  const { pathname } = useLocation()
  const active = pathname === to || (to !== '/dashboard' && to !== '/admin' && pathname.startsWith(to))
  const emoji = NAV_EMOJI[to] || '•'

  return (
    <Link
      to={to}
      onClick={onClick}
      className={clsx(
        'flex items-center gap-3 rounded-2xl font-medium transition-all duration-150 select-none',
        sub ? 'px-3 py-2 text-sm me-3' : 'px-4 py-3 text-base',
        active
          ? 'bg-white/15 text-white'
          : 'text-white/70 hover:bg-white/8 hover:text-white'
      )}
    >
      <span className={clsx('flex-shrink-0 leading-none', sub ? 'text-base' : 'text-xl')} aria-hidden>
        {emoji}
      </span>
      <span className="flex-1">{label}</span>
      {unread > 0 && (
        <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
          {unread}
        </span>
      )}
    </Link>
  )
}

// ── UserMenu ───────────────────────────────────────────────────────────────────
function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false)
  const isUrl = (s) => typeof s === 'string' && s.startsWith('http')
  const roleLabel = {
    new_family:  'משפחה חדשה',
    host_family: 'משפחה מארחת',
    community:   'חבר קהילה',
    admin:       'מנהל',
    super_admin: 'מנהל ראשי',
  }[user?.role] || 'חבר קהילה'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-2xl hover:bg-white/10 transition-colors w-full"
      >
        {isUrl(user?.avatar)
          ? <img src={user.avatar} alt="" className="w-8 h-8 rounded-full flex-shrink-0 object-cover ring-2 ring-white/20" />
          : <div className="avatar w-8 h-8 text-sm bg-white/20 text-white flex-shrink-0">{user?.name?.[0] || '?'}</div>
        }
        <div className="text-right flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{user?.name}</div>
          <div className="text-xs text-white/50">{roleLabel}</div>
        </div>
        <ChevronDown size={14} className={clsx('text-white/40 transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 rounded-2xl shadow-modal border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{user?.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</div>
          </div>
          <button
            onClick={() => { setOpen(false); logout() }}
            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={16} />
            התנתקות
          </button>
        </div>
      )}
    </div>
  )
}

// ── ThemeToggle ────────────────────────────────────────────────────────────────
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
      aria-label={theme === 'dark' ? 'עבור למצב בהיר' : 'עבור למצב כהה'}
    >
      {theme === 'dark'
        ? <Sun size={18} className="flex-shrink-0" />
        : <Moon size={18} className="flex-shrink-0" />
      }
      {theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
    </button>
  )
}

// ── Sidebar content (shared desktop + mobile) ──────────────────────────────────
function SidebarContent({ links, unreadMessages, isAdmin, viewAs, activateViewAs, user, logout, onClose }) {
  return (
    <>
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="bg-white/95 rounded-2xl px-4 py-2.5">
          <img src="/logo.png" alt="שחף" className="h-10 w-auto mx-auto" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {links.map(link => (
          <NavLink key={link.to} {...link} unread={link.badge ? unreadMessages : 0} sub={!!link.sub} onClick={onClose} />
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-2 border-t border-white/10 pt-3">
        {isAdmin && !viewAs && (
          <button
            onClick={() => { activateViewAs('new_family'); onClose?.() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <span className="text-lg" aria-hidden>👤</span>
            כניסה כהורה
          </button>
        )}
        <ThemeToggle />
        <UserMenu user={user} logout={logout} />
      </div>
    </>
  )
}

// ── AppShell ───────────────────────────────────────────────────────────────────
export default function AppShell() {
  const { user, logout, isAdmin, isClassAdmin, viewAs, effectiveRole, allRoles, activateViewAs, deactivateViewAs } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)

  const showAdminNav = isAdmin && !viewAs
  let baseLinks, bottomNavPaths
  if (showAdminNav) {
    baseLinks = ADMIN_NAV_LINKS[effectiveRole] || ADMIN_NAV_LINKS.admin
    bottomNavPaths = ADMIN_BOTTOM_NAV
  } else {
    baseLinks = buildMemberNav(allRoles, user?.classIds)
    bottomNavPaths = getMemberBottomNav(allRoles, user?.classIds)
  }

  const links = isClassAdmin && !isAdmin
    ? [...baseLinks, { to: '/admin/import', label: 'ייבוא משפחות' }]
    : baseLinks

  const bottomLinks = links.filter(l => bottomNavPaths.includes(l.to))

  const activeLink = links.find(l =>
    pathname === l.to || (l.to !== '/dashboard' && l.to !== '/admin' && pathname.startsWith(l.to))
  )
  const pageTitle = activeLink?.label || ''

  useEffect(() => {
    if (!isAdmin) return
    getMessages().then(msgs => setUnreadMessages(msgs.filter(m => !m.read).length))
  }, [isAdmin])

  const sidebarBg = 'bg-[#0d1b35]'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Desktop sidebar */}
      <aside className={clsx('hidden md:flex flex-col w-64 flex-shrink-0', sidebarBg)} dir="rtl">
        <SidebarContent
          links={links}
          unreadMessages={unreadMessages}
          isAdmin={isAdmin}
          viewAs={viewAs}
          activateViewAs={activateViewAs}
          user={user}
          logout={logout}
        />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className={clsx('absolute top-0 right-0 h-full w-72 flex flex-col animate-slide-up', sidebarBg)} dir="rtl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="סגור תפריט"
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
              >
                <X size={20} />
              </button>
              <div className="bg-white/95 rounded-xl px-3 py-1.5">
                <img src="/logo.png" alt="שחף" className="h-8 w-auto" />
              </div>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {links.map(link => (
                <NavLink key={link.to} {...link} unread={link.badge ? unreadMessages : 0} sub={!!link.sub} onClick={() => setSidebarOpen(false)} />
              ))}
            </nav>
            <div className="px-3 pb-4 space-y-2 border-t border-white/10 pt-3">
              {isAdmin && !viewAs && (
                <button
                  onClick={() => { activateViewAs('new_family'); setSidebarOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <span className="text-lg" aria-hidden>👤</span>
                  כניסה כהורה
                </button>
              )}
              <ThemeToggle />
              <UserMenu user={user} logout={logout} />
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* View-as banner */}
        {viewAs && (
          <div className="flex items-center justify-between bg-[#0d1b35] text-white px-4 py-2 text-sm font-medium flex-shrink-0" dir="rtl">
            <button onClick={deactivateViewAs} className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-1 rounded-lg text-xs transition-colors">
              ← חזור לממשק מנהל
            </button>
            <span className="flex items-center gap-1.5 text-xs text-white/70">
              <span>👤</span> ממשק הורה
            </span>
          </div>
        )}

        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm" dir="rtl">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="פתח תפריט"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            <Menu size={20} />
          </button>
          {pageTitle ? (
            <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">{pageTitle}</span>
          ) : (
            <img src="/logo.png" alt="שחף" className="h-8 w-auto" />
          )}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            aria-label={theme === 'dark' ? 'עבור למצב בהיר' : 'עבור למצב כהה'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <main key={pathname} className="flex-1 overflow-y-auto pb-16 md:pb-0 animate-fade-in">
          <Outlet />
        </main>

        <InstallBanner />

        {/* Mobile bottom nav */}
        {bottomLinks.length > 0 && (
          <nav className="md:hidden flex items-center justify-around border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 pb-[env(safe-area-inset-bottom)] flex-shrink-0">
            {bottomLinks.map(link => {
              const active = pathname === link.to || (link.to !== '/dashboard' && link.to !== '/admin' && pathname.startsWith(link.to))
              const emoji = NAV_EMOJI[link.to] || '•'
              return (
                <Link key={link.to} to={link.to}
                  className={clsx(
                    'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 relative',
                    active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                  )}>
                  <span className={clsx('text-2xl leading-none', active ? 'scale-110' : '')} style={{ filter: active ? 'none' : 'grayscale(0.3)' }}>
                    {emoji}
                  </span>
                  <span className="text-[11px] font-medium mt-0.5">{link.label}</span>
                  {link.badge && unreadMessages > 0 && (
                    <span className="absolute top-0.5 right-2 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </Link>
              )
            })}
          </nav>
        )}
      </div>
    </div>
  )
}
