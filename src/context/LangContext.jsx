import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { translations } from '../lib/i18n'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const LangContext = createContext({ lang: 'he', t: () => '', isRTL: true })

export function LangProvider({ children }) {
  const { user, updateUserState } = useAuth()
  const [lang, setLangState] = useState(
    () => localStorage.getItem('shachaf_lang') || 'he'
  )

  // Sync language from user Firestore profile when they log in
  useEffect(() => {
    if (user?.lang && user.lang !== lang) {
      setLangState(user.lang)
      localStorage.setItem('shachaf_lang', user.lang)
    }
  }, [user?.uid, user?.lang])

  // Update document lang attribute (not dir — keeping RTL layout for the community)
  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'he'
  }, [lang])

  const setLang = async (newLang) => {
    setLangState(newLang)
    localStorage.setItem('shachaf_lang', newLang)
    if (user?.uid) {
      updateUserState({ lang: newLang })
      try {
        await updateDoc(doc(db, 'users', user.uid), { lang: newLang })
      } catch {}
    }
  }

  const t = (section, key) =>
    translations[lang]?.[section]?.[key] ??
    translations.he?.[section]?.[key] ??
    key

  return (
    <LangContext.Provider value={{ lang, setLang, t, isRTL: lang === 'he' }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
