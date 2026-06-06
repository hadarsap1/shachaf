import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppShell from './components/layout/AppShell'

import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/family/DashboardPage'
import TasksPage from './pages/family/TasksPage'
import EventsPage from './pages/family/EventsPage'
import ResourcesPage from './pages/family/ResourcesPage'
import ChatPage from './pages/family/ChatPage'
import SettingsPage from './pages/family/SettingsPage'
import FamiliesPage from './pages/host/FamiliesPage'

import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminTasksPage from './pages/admin/AdminTasksPage'
import AdminEventsPage from './pages/admin/AdminEventsPage'
import AdminActivityPage from './pages/admin/AdminActivityPage'
import AdminFormsPage from './pages/admin/AdminFormsPage'
import FormFillPage from './pages/family/FormFillPage'
import ContactPage from './pages/family/ContactPage'
import SuperAdminPage from './pages/superadmin/SuperAdminPage'
import AdminMessagesPage from './pages/admin/AdminMessagesPage'
import AdminImportPage from './pages/admin/AdminImportPage'
import AdminCalendarPage from './pages/admin/AdminCalendarPage'

function ProtectedShell({ adminOnly = false, superOnly = false, hostOnly = false }) {
  const { user, loading, isAdmin, isSuperAdmin, isHostFamily } = useAuth()
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <img src="/logo.png" alt="שחף" className="h-16 w-auto mb-6 opacity-80" />
      <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  if (superOnly && !isSuperAdmin) return <Navigate to="/" replace />
  if (hostOnly && !isHostFamily && !isAdmin) return <Navigate to="/" replace />
  return <AppShell />
}

function RootRedirect() {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (isAdmin) return <Navigate to="/admin" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
          </Route>

          <Route element={<ProtectedShell hostOnly />}>
            <Route path="/families" element={<FamiliesPage />} />
          </Route>

          <Route element={<ProtectedShell adminOnly />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/tasks" element={<AdminTasksPage />} />
            <Route path="/admin/events" element={<AdminEventsPage />} />
            <Route path="/admin/activity" element={<AdminActivityPage />} />
            <Route path="/admin/forms" element={<AdminFormsPage />} />
            <Route path="/admin/messages" element={<AdminMessagesPage />} />
            <Route path="/admin/import" element={<AdminImportPage />} />
            <Route path="/admin/calendar" element={<AdminCalendarPage />} />
          </Route>

          <Route element={<ProtectedShell superOnly />}>
            <Route path="/super/admins" element={<SuperAdminPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
