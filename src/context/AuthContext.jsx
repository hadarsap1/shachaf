import { createContext, useContext, useState, useEffect } from 'react'
import { MOCK_USERS } from '../lib/mockData'

// In Phase 3 this will be replaced with real Supabase auth
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check localStorage for mock session
    const saved = localStorage.getItem('shachaf_mock_user')
    if (saved) {
      try {
        setUser(JSON.parse(saved))
      } catch {
        localStorage.removeItem('shachaf_mock_user')
      }
    }
    setLoading(false)
  }, [])

  const login = (role) => {
    const mockUser = MOCK_USERS[role]
    if (!mockUser) return
    setUser(mockUser)
    localStorage.setItem('shachaf_mock_user', JSON.stringify(mockUser))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('shachaf_mock_user')
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const isSuperAdmin = user?.role === 'super_admin'
  const isHostFamily = user?.role === 'host_family'
  const isNewFamily = user?.role === 'new_family'

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isSuperAdmin, isHostFamily, isNewFamily }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
