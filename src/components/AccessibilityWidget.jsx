import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Accessibility, X, Plus, Minus, Contrast, Link2, PauseCircle, RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import { useAccessibility, FONT_SCALE_STEPS } from '../context/AccessibilityContext'

function ToggleRow({ icon: Icon, label, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={clsx(
        'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-right',
        checked
          ? 'bg-primary-50 text-primary-800 font-semibold dark:bg-primary-900/40 dark:text-primary-200'
          : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50'
      )}
    >
      <span className={clsx(
        'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
      )} aria-hidden>
        <span className={clsx(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[-16px]' : 'translate-x-[-2px]'
        )} />
      </span>
      <span className="flex items-center gap-2 flex-1 justify-end">
        {label}
        <Icon size={15} className="flex-shrink-0 text-current opacity-70" aria-hidden />
      </span>
    </button>
  )
}

// Floating accessibility menu — available on EVERY page (login, legal pages
// and the app itself), as required by the service-accessibility regulations:
// text resizing, high contrast, underlined links, animation stop, and a link
// to the accessibility statement.
export default function AccessibilityWidget() {
  const { settings, toggle, increaseFont, decreaseFont, reset, isDefault } = useAccessibility()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const buttonRef = useRef(null)
  const { pathname } = useLocation()

  // Close on route change so the panel doesn't linger over new pages
  useEffect(() => { setOpen(false) }, [pathname])

  // Escape closes and returns focus to the trigger button
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Move focus into the panel when it opens
  useEffect(() => {
    if (open) panelRef.current?.querySelector('button')?.focus()
  }, [open])

  return (
    <div dir="rtl">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? 'סגירת תפריט נגישות' : 'פתיחת תפריט נגישות'}
        className="fixed bottom-40 md:bottom-20 end-4 z-[55] w-11 h-11 rounded-full bg-[#1d4ed8] text-white shadow-lg hover:bg-blue-800 flex items-center justify-center transition-colors"
      >
        {open ? <X size={20} aria-hidden /> : <Accessibility size={22} aria-hidden />}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="תפריט נגישות"
          className="fixed bottom-52 md:bottom-32 end-4 z-[55] w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-3 space-y-1"
        >
          <div className="px-2 pt-1 pb-2 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-bold text-gray-800 dark:text-gray-100 text-sm flex items-center gap-1.5">
              <Accessibility size={15} className="text-primary-600 dark:text-primary-400" aria-hidden />
              נגישות
            </h2>
            {!isDefault && (
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
              >
                <RotateCcw size={12} aria-hidden />
                איפוס
              </button>
            )}
          </div>

          {/* Text size */}
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-1.5" role="group" aria-label="גודל טקסט">
              <button
                type="button"
                onClick={decreaseFont}
                disabled={settings.fontScale === 0}
                aria-label="הקטנת טקסט"
                className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                <Minus size={14} aria-hidden />
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-center tabular-nums" aria-live="polite">
                {FONT_SCALE_STEPS[settings.fontScale]}
              </span>
              <button
                type="button"
                onClick={increaseFont}
                disabled={settings.fontScale === FONT_SCALE_STEPS.length - 1}
                aria-label="הגדלת טקסט"
                className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                <Plus size={14} aria-hidden />
              </button>
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-200">גודל טקסט</span>
          </div>

          <ToggleRow icon={Contrast} label="ניגודיות גבוהה"
            checked={settings.highContrast} onChange={() => toggle('highContrast')} />
          <ToggleRow icon={Link2} label="הדגשת קישורים"
            checked={settings.underlineLinks} onChange={() => toggle('underlineLinks')} />
          <ToggleRow icon={PauseCircle} label="עצירת אנימציות"
            checked={settings.reduceMotion} onChange={() => toggle('reduceMotion')} />

          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <Link
              to="/legal/accessibility"
              className="block px-3 py-1.5 text-xs text-primary-600 dark:text-primary-400 underline text-right"
              onClick={() => setOpen(false)}
            >
              הצהרת נגישות מלאה
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
