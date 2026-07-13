import { createContext, useContext, useEffect, useState } from 'react'

// Accessibility preferences — the service-accessibility regulations (תקנות
// שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), תשע"ג-2013, תקנה 35)
// require conformance with ת"י 5568 (WCAG 2.0 AA). These user-adjustable
// settings implement the adjustable presentation part: text scaling, high
// contrast, underlined links and reduced motion. Persisted per device and
// applied as classes / font-size on <html> so they affect EVERY page,
// including login and the legal pages.

const STORAGE_KEY = 'shachaf_a11y'

// Root font-size per text-size step. Tailwind spacing/typography is rem-based,
// so scaling the root scales the whole layout proportionally (WCAG 1.4.4 —
// resize up to 200% without loss of content).
export const FONT_SCALE_STEPS = ['100%', '112.5%', '125%', '150%']

const DEFAULTS = {
  fontScale: 0,          // index into FONT_SCALE_STEPS
  highContrast: false,   // stronger text colors (WCAG 1.4.3/1.4.6)
  underlineLinks: false, // links distinguishable without color alone (1.4.1)
  reduceMotion: false,   // stop animations/transitions (2.2.2, 2.3.3)
}

const AccessibilityContext = createContext(null)

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      return { ...DEFAULTS, ...stored }
    } catch {
      return DEFAULTS
    }
  })

  useEffect(() => {
    const root = document.documentElement
    const scale = FONT_SCALE_STEPS[settings.fontScale] || FONT_SCALE_STEPS[0]
    root.style.fontSize = settings.fontScale > 0 ? scale : ''
    root.classList.toggle('a11y-contrast', settings.highContrast)
    root.classList.toggle('a11y-links', settings.underlineLinks)
    root.classList.toggle('a11y-no-motion', settings.reduceMotion)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch {}
  }, [settings])

  const set = (key, value) => setSettings(s => ({ ...s, [key]: value }))
  const toggle = (key) => setSettings(s => ({ ...s, [key]: !s[key] }))
  const increaseFont = () => set('fontScale', Math.min(settings.fontScale + 1, FONT_SCALE_STEPS.length - 1))
  const decreaseFont = () => set('fontScale', Math.max(settings.fontScale - 1, 0))
  const reset = () => setSettings(DEFAULTS)
  const isDefault = JSON.stringify(settings) === JSON.stringify(DEFAULTS)

  return (
    <AccessibilityContext.Provider value={{
      settings, toggle, increaseFont, decreaseFont, reset, isDefault,
    }}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext)
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider')
  return ctx
}
