import { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { syncUserClassIds, completeOnboarding } from '../lib/db'
import { MOCK_USERS } from '../lib/mockData'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewAs, setViewAsState] = useState(() => {
    try { return localStorage.getItem('shachaf_view_as') || null } catch { return null }
  })

  const activateViewAs = (role) => {
    localStorage.setItem('shachaf_view_as', role)
    setViewAsState(role)
  }
  const deactivateViewAs = () => {
    localStorage.removeItem('shachaf_view_as')
    setViewAsState(null)
  }

  const fetchUserProfile = async (firebaseUser) => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid)
      const snap = await getDoc(userRef)
      if (snap.exists()) {
        const data = snap.data()
        setUser({ uid: firebaseUser.uid, ...data })
        // Backfill classIds for users created before class-scoped read rules.
        // Runs once (only when the field is absent); keeps the class roster working.
        if (data.classIds === undefined) {
          try {
            const classIds = await syncUserClassIds(firebaseUser.uid)
            setUser(prev => prev ? { ...prev, classIds } : prev)
          } catch { /* non-critical — rule still grants parent + admin reads */ }
        }
        return
      }
      // New user — check for a pending imported record first
      const emailKey = (firebaseUser.email || '').toLowerCase()
      let pending = null
      if (emailKey) {
        try {
          const ps = await getDoc(doc(db, 'pendingFamilies', emailKey))
          if (ps.exists()) pending = ps.data()
        } catch { /* no pending record or permission denied — fine */ }
      }
      const newProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || emailKey,
        name: pending?.name || firebaseUser.displayName || emailKey.split('@')[0],
        role: pending?.role || 'new_family',
        avatar: firebaseUser.photoURL || '',
        phone: pending?.phone || '',
        address: pending?.address || '',
        createdAt: serverTimestamp(),
      }
      await setDoc(userRef, newProfile)
      if (pending) {
        try { await deleteDoc(doc(db, 'pendingFamilies', emailKey)) } catch {}
      }
      setUser(newProfile)
    } catch (err) {
      console.error('fetchUserProfile failed:', err)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (import.meta.env.DEV) {
      const demo = localStorage.getItem('shachaf_mock_user')
      if (demo) {
        try { setUser(JSON.parse(demo)) } catch { localStorage.removeItem('shachaf_mock_user') }
        setLoading(false)
        return
      }
    }

    // Handle iOS redirect result on page load
    getRedirectResult(auth).catch(err => {
      if (err?.code !== 'auth/null-user') console.error('redirect result error:', err)
    })

    // Firebase auth state — set loading=true on every change so ProtectedShell
    // shows a spinner instead of flashing back to /login during profile fetch
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true)
      if (firebaseUser) {
        await fetchUserProfile(firebaseUser)
      } else {
        setUser(null)
        setLoading(false)
      }
    })
    return unsub
  }, [])

  // Demo login — dev only
  const loginDemo = (roleKey) => {
    if (!import.meta.env.DEV) return
    const mockUser = MOCK_USERS[roleKey]
    if (!mockUser) return
    setUser(mockUser)
    localStorage.setItem('shachaf_mock_user', JSON.stringify(mockUser))
  }

  // Real Firebase login
  const loginWithEmail = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  // Real Firebase register — set displayName so fetchUserProfile can use it
  const registerWithEmail = async (email, password, name) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (name) await updateProfile(cred.user, { displayName: name })
    // onAuthStateChanged → fetchUserProfile handles profile creation
    return cred
  }

  // Google sign-in
  // • iOS (any context): use redirect — popup is blocked or fails in WebView/standalone.
  //   The redirect completes in Safari which writes auth to the shared IndexedDB.
  //   LoginPage handles the return via visibilitychange + page reload.
  // • Everything else: popup works fine.
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isIOS) {
      await signInWithRedirect(auth, provider)
      return
    }
    return signInWithPopup(auth, provider)
  }

  const resetPassword = (email) => sendPasswordResetEmail(auth, email)

  const logout = async () => {
    const isDemo = !!localStorage.getItem('shachaf_mock_user')
    localStorage.removeItem('shachaf_mock_user')
    if (!isDemo) await signOut(auth)
    setUser(null)
  }

  const updateUserState = (updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : prev)
  }

  const markOnboardingComplete = async () => {
    await completeOnboarding(user.uid)
    setUser(prev => prev ? { ...prev, onboardingComplete: true } : prev)
  }

  const isAdmin        = user?.role === 'admin' || user?.role === 'super_admin'
  const isSuperAdmin   = user?.role === 'super_admin'

  // allRoles = union of primary role + extra roles array. 'community' is always included.
  const allRoles = new Set([
    'community',
    user?.role,
    ...(user?.roles || []),
  ].filter(Boolean))

  const isHostFamily   = allRoles.has('host_family')
  const isNewFamily    = allRoles.has('new_family')
  const isCommunity    = true  // everyone is always a community member
  const isClassAdmin   = !isAdmin && (user?.classAdminFor || []).length > 0
  const effectiveRole  = viewAs || user?.role
  const needsOnboarding = isNewFamily && !user?.onboardingComplete && !isAdmin

  return (
    <AuthContext.Provider value={{
      user, loading,
      loginDemo, loginWithEmail, loginWithGoogle, registerWithEmail, resetPassword, logout,
      isAdmin, isSuperAdmin, isHostFamily, isNewFamily, isCommunity, isClassAdmin,
      allRoles,
      viewAs, effectiveRole, activateViewAs, deactivateViewAs,
      needsOnboarding, markOnboardingComplete, updateUserState,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
