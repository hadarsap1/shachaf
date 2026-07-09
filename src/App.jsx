import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AppShell from './components/layout/AppShell'
import ConsentModal from './components/ConsentModal'
import { needsConsent } from './lib/consent'

import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/family/DashboardPage'
import TasksPage from './pages/family/TasksPage'
import EventsPage from './pages/family/EventsPage'
import ResourcesPage from './pages/family/ResourcesPage'
import ChatPage from './pages/family/ChatPage'
import SettingsPage from './pages/family/SettingsPage'
import FamiliesPage from './pages/host/FamiliesPage'
import FormFillPage from './pages/family/FormFillPage'
import ContactPage from './pages/family/ContactPage'
import HelpPage from './pages/HelpPage'
import ClassPage from './pages/family/ClassPage'
import CommitteesPage from './pages/family/CommitteesPage'
import CommunityGroupsPage from './pages/family/CommunityGroupsPage'
import BusinessDirectoryPage from './pages/family/BusinessDirectoryPage'
import ClassRosterPage from './pages/family/ClassRosterPage'
import EmergencySchedulePage from './pages/family/EmergencySchedulePage'
import PendingApprovalPage from './pages/family/PendingApprovalPage'

// Admin/super pages are lazy-loaded — families never download this code.
const AdminDashboard        = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminUsersPage        = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminTasksPage        = lazy(() => import('./pages/admin/AdminTasksPage'))
const AdminEventsPage       = lazy(() => import('./pages/admin/AdminEventsPage'))
const AdminActivityPage     = lazy(() => import('./pages/admin/AdminActivityPage'))
const AdminFormsPage        = lazy(() => import('./pages/admin/AdminFormsPage'))
const SuperAdminPage        = lazy(() => import('./pages/superadmin/SuperAdminPage'))
const SuperAdminHealthPage  = lazy(() => import('./pages/superadmin/SuperAdminHealthPage'))
const SuperAdminFeedbackPage = lazy(() => import('./pages/super/SuperAdminFeedbackPage'))
const AdminMessagesPage     = lazy(() => import('./pages/admin/AdminMessagesPage'))
const AdminImportPage       = lazy(() => import('./pages/admin/AdminImportPage'))
const AdminClassesPage      = lazy(() => import('./pages/admin/AdminClassesPage'))
const AdminChildrenPage     = lazy(() => import('./pages/admin/AdminChildrenPage'))
const AdminCommitteesPage   = lazy(() => import('./pages/admin/AdminCommitteesPage'))
const AdminAnnouncementsPage    = lazy(() => import('./pages/admin/AdminAnnouncementsPage'))
const AdminResourcesPage        = lazy(() => import('./pages/admin/AdminResourcesPage'))
const AdminEmergencyPage        = lazy(() => import('./pages/admin/AdminEmergencyPage'))
const AdminCommunityGroupsPage  = lazy(() => import('./pages/admin/AdminCommunityGroupsPage'))
const OnboardingPage             = lazy(() => import('./pages/family/OnboardingPage'))

const Spinner = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
    <img src="/logo.png" alt="שחף" className="h-16 w-auto mb-6 opacity-80" />
    <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
  </div>
)

// Routes alumni (graduated families) may still use — business directory,
// their own settings, help, and contact. Everything else redirects.
const ALUMNI_ROUTES = ['/businesses', '/settings', '/help', '/contact']

// Blocks every signed-in view behind the informed-consent dialog until the
// user approves the current CONSENT_VERSION (new users, existing users after
// a version bump, and co-parents on their first login).
function ConsentGate({ user, children }) {
  return (
    <>
      {children}
      {needsConsent(user) && <ConsentModal />}
    </>
  )
}

function ProtectedShell({ adminOnly = false, superOnly = false, hostOnly = false, classAdminOk = false }) {
  const { user, loading, isAdmin, isSuperAdmin, isHostFamily, isClassAdmin, needsOnboarding, viewAs } = useAuth()
  // Admin in "watch as parent" mode behaves like a regular parent
  const effectiveAdmin = isAdmin && !viewAs
  const effectiveClassAdmin = isClassAdmin && !viewAs
  const { pathname } = useLocation()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (needsOnboarding) return <Navigate to="/onboarding" replace />
  if (user.status === 'alumni' && !isAdmin && !ALUMNI_ROUTES.some(p => pathname.startsWith(p))) {
    return <Navigate to="/businesses" replace />
  }
  // Pending accounts (matched from an imported class list) need class-admin
  // approval before touching the app — admins/class admins still need access
  // to review and approve them, so they're exempt from this gate.
  if (user.status === 'pending' && !isAdmin && !isClassAdmin) {
    return <ConsentGate user={user}><PendingApprovalPage /></ConsentGate>
  }
  if (adminOnly && !effectiveAdmin && !(classAdminOk && effectiveClassAdmin)) return <Navigate to="/" replace />
  if (superOnly && !isSuperAdmin) return <Navigate to="/" replace />
  if (hostOnly && !isHostFamily && !effectiveAdmin) return <Navigate to="/" replace />
  return <ConsentGate user={user}><AppShell /></ConsentGate>
}

function ProtectedOnboarding() {
  const { user, loading, needsOnboarding } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (!needsOnboarding) return <Navigate to="/dashboard" replace />
  return <ConsentGate user={user}><OnboardingPage /></ConsentGate>
}

function RootRedirect() {
  const { user, loading, isAdmin, viewAs } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  // viewAs check must mirror ProtectedShell's effectiveAdmin — otherwise
  // /admin→/ and /→/admin bounce forever (blank page, throttled navigation)
  if (isAdmin && !viewAs) return <Navigate to="/admin" replace />
  return <Navigate to="/dashboard" replace />
}

function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<ProtectedOnboarding />} />
          <Route path="/" element={<RootRedirect />} />

          <Route element={<ProtectedShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/forms" element={<FormFillPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/class" element={<ClassPage />} />
            <Route path="/class-roster" element={<ClassRosterPage />} />
            <Route path="/committees" element={<CommitteesPage />} />
            <Route path="/community" element={<CommunityGroupsPage />} />
            <Route path="/businesses" element={<BusinessDirectoryPage />} />
            <Route path="/emergency" element={<EmergencySchedulePage />} />
          </Route>

          <Route element={<ProtectedShell hostOnly />}>
            <Route path="/families" element={<FamiliesPage />} />
          </Route>

          {/* Class admins can also review/approve members of their own class */}
          <Route element={<ProtectedShell adminOnly classAdminOk />}>
            <Route path="/admin/users" element={<AdminUsersPage />} />
          </Route>

          <Route element={<ProtectedShell adminOnly />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/tasks" element={<AdminTasksPage />} />
            <Route path="/admin/events" element={<AdminEventsPage />} />
            <Route path="/admin/activity" element={<AdminActivityPage />} />
            <Route path="/admin/forms" element={<AdminFormsPage />} />
            <Route path="/admin/messages" element={<AdminMessagesPage />} />
            <Route path="/admin/classes" element={<AdminClassesPage />} />
            <Route path="/admin/children" element={<AdminChildrenPage />} />
            <Route path="/admin/committees" element={<AdminCommitteesPage />} />
            <Route path="/admin/announcements" element={<AdminAnnouncementsPage />} />
            <Route path="/admin/resources" element={<AdminResourcesPage />} />
            <Route path="/admin/emergency" element={<AdminEmergencyPage />} />
            <Route path="/admin/community" element={<AdminCommunityGroupsPage />} />
          </Route>
          {/* Class admins (non-global-admin users with classAdminFor) can import families */}
          <Route element={<ProtectedShell adminOnly classAdminOk />}>
            <Route path="/admin/import" element={<AdminImportPage />} />
          </Route>

          <Route element={<ProtectedShell superOnly />}>
            <Route path="/super/admins" element={<SuperAdminPage />} />
            <Route path="/super/health" element={<SuperAdminHealthPage />} />
            <Route path="/super/feedback" element={<SuperAdminFeedbackPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
