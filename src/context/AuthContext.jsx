import { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { MOCK_USERS } from '../lib/mockData'

const AuthContext = createContext(null)

// Demo login — bypasses Firebase, used for testing/onboarding
const DEMO_PREFIX = '__demo__'

async function fetchUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { uid, ...snap.data() } : null
}

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for demo session first
    const demo = localStorage.getItem('shachaf_mock_user')
    if (demo) {
      try { setUser(JSON.parse(demo)) } catch { localStorage.removeItem('shachaf_mock_user') }
      setLoading(false)
      return
    }

    // Firebase auth state
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await fetchUserProfile(firebaseUser.uid)
        if (profile) {
          setUser(profile)
        } else {
          // New user — create a basic profile with new_family role
          const newProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            role: 'new_family',
            avatar: '',
            phone: '',
            createdAt: serverTimestamp(),
          }
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile)
          setUser(newProfile)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
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

  // Real Firebase register
  const registerWithEmail = async (email, password, name) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const profile = {
      uid: cred.user.uid,
      email,
      name,
      role: 'new_family',
      avatar: '',
      phone: '',
      createdAt: serverTimestamp(),
    }
    await setDoc(doc(db, 'users', cred.user.uid), profile)
    setUser(profile)
    return cred
  }

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    const cred = await signInWithPopup(auth, provider)
    const existing = await fetchUserProfile(cred.user.uid)
    if (!existing) {
      const profile = {
        uid: cred.user.uid,
        email: cred.user.email,
        name: cred.user.displayName || cred.user.email.split('@')[0],
        role: 'new_family',
        avatar: cred.user.photoURL || '',
        phone: '',
        createdAt: serverTimestamp(),
      }
      await setDoc(doc(db, 'users', cred.user.uid), profile)
      setUser(profile)
    }
    return cred
  }

  const resetPassword = (email) => sendPasswordResetEmail(auth, email)

  const logout = async () => {
    const isDemo = !!localStorage.getItem('shachaf_mock_user')
    localStorage.removeItem('shachaf_mock_user')
    if (!isDemo) await signOut(auth)
    setUser(null)
  }

  const isAdmin      = user?.role === 'admin' || user?.role === 'super_admin'
  const isSuperAdmin = user?.role === 'super_admin'
  const isHostFamily = user?.role === 'host_family'
  const isNewFamily  = user?.role === 'new_family'

  return (
    <AuthContext.Provider value={{
      user, loading,
      loginDemo, loginWithEmail, loginWithGoogle, registerWithEmail, resetPassword, logout,
      isAdmin, isSuperAdmin, isHostFamily, isNewFamily,
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
