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
import { syncUserClassIds, completeOnboarding, autoLinkChildrenByEmail } from '../lib/db'
import { MOCK_USERS } from '../lib/mockData'

const AuthContext = createContext(null)

// Set just before a redirect sign-in so the login screen knows one is in flight.
export const GOOGLE_PENDING_KEY = 'shachaf_google_pending'

const PROFILE_TIMEOUT_MS = 12000

// Firestore's channel can stall without ever rejecting — every await that gates
// the loading state needs a deadline of its own.
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'app/timeout' })), ms)),
  ])
}

// One retry: a cold connection after a long background is the common case.
async function readProfile(ref) {
  try {
    return await withTimeout(getDoc(ref), PROFILE_TIMEOUT_MS)
  } catch {
    return await withTimeout(getDoc(ref), PROFILE_TIMEOUT_MS)
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
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
      const snap = await readProfile(userRef)
      if (snap.exists()) {
        const data = snap.data()
        setAuthError(null)
        setUser({ uid: firebaseUser.uid, ...data })
        // Auto-link to imported children by email, then refresh classIds from
        // children — both fire-and-forget, never block login. Chained so the
        // class sync sees any children just linked.
        autoLinkChildrenByEmail(firebaseUser.uid, firebaseUser.email)
          .catch(() => 0)
          .then(() => syncUserClassIds(firebaseUser.uid))
          .then(classIds => setUser(prev => prev ? { ...prev, classIds } : prev))
          .catch(() => {})
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
      // Read a role the registration form may have stored just before sign-up
      let selfSelectedRole = null
      let selfSelectedRoles = []
      try {
        const stored = localStorage.getItem('shachaf_reg_role')
        if (stored) {
          const parsed = JSON.parse(stored)
          selfSelectedRole  = parsed.role  || null
          selfSelectedRoles = parsed.roles || []
          localStorage.removeItem('shachaf_reg_role')
        }
      } catch { /* ignore */ }

      const newProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || emailKey,
        name: pending?.name || firebaseUser.displayName || emailKey.split('@')[0],
        role: pending?.role || selfSelectedRole || 'community',
        roles: selfSelectedRoles,
        avatar: firebaseUser.photoURL || '',
        phone: pending?.phone || '',
        address: pending?.address || '',
        // Parents matched from an admin-imported class list need class-admin
        // approval before they can access the app; self-registered community
        // members without a match are active immediately.
        status: pending ? 'pending' : 'active',
        // imported gates access to the unlinked-children roster during
        // onboarding — rules validate it against pendingFamilies at create time
        imported: !!pending,
        createdAt: serverTimestamp(),
      }
      await withTimeout(setDoc(userRef, newProfile), PROFILE_TIMEOUT_MS)
      setAuthError(null)
      if (pending) {
        try { await deleteDoc(doc(db, 'pendingFamilies', emailKey)) } catch {}
      }
      setUser(newProfile)
      // Link to imported children by email + refresh classIds (fire-and-forget)
      autoLinkChildrenByEmail(firebaseUser.uid, firebaseUser.email)
        .catch(() => 0)
        .then(() => syncUserClassIds(firebaseUser.uid))
        .then(classIds => setUser(prev => prev ? { ...prev, classIds } : prev))
        .catch(() => {})
    } catch (err) {
      // Signed in with the provider but we could not load the profile. Do NOT
      // fail silently: without a message the user is bounced back to the login
      // screen and thinks the button did nothing.
      console.error('fetchUserProfile failed:', err)
      setAuthError(err?.code === 'app/timeout'
        ? 'ההתחברות הצליחה אך טעינת הפרופיל נתקעה. בדקו את החיבור ונסו שוב.'
        : 'ההתחברות הצליחה אך טעינת הפרופיל נכשלה. נסו שוב, ואם זה חוזר — פנו לצוות.')
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
    getRedirectResult(auth).catch(() => { /* redirect errors handled by onAuthStateChanged */ })

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

  // Google sign-in — popup first, everywhere.
  //
  // We used to send every iOS device down signInWithRedirect. That path is the
  // fragile one: browsers that partition third-party storage can drop the
  // pending redirect, and the user lands back on the login screen signed out,
  // with nothing to explain it. A popup keeps the whole exchange on this page.
  //
  // Redirect stays as the fallback for the environments that genuinely cannot
  // open one (in-app webviews, standalone PWAs). `redirected: true` tells the
  // caller the page is about to navigate away.
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      return await signInWithPopup(auth, provider)
    } catch (err) {
      const code = err?.code || ''
      const popupImpossible = [
        'auth/popup-blocked',
        'auth/operation-not-supported-in-this-environment',
        'auth/web-storage-unsupported',
        'auth/internal-error',
      ].includes(code)
      if (!popupImpossible) throw err
      try { localStorage.setItem(GOOGLE_PENDING_KEY, String(Date.now())) } catch {}
      await signInWithRedirect(auth, provider)
      return { redirected: true }
    }
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
      user, loading, authError, clearAuthError: () => setAuthError(null),
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
