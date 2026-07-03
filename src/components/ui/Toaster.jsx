import { useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import clsx from 'clsx'

// Tiny toast system — no dependency, no context. Call toast('...') or
// toast.error('...') from anywhere; <Toaster /> (mounted once in AppShell)
// listens and renders.
let emit = () => {}

export function toast(message, type = 'success') { emit({ message, type }) }
toast.error = (message) => emit({ message, type: 'error' })

export default function Toaster() {
  const [items, setItems] = useState([])

  useEffect(() => {
    emit = (t) => {
      const id = Date.now() + Math.random()
      setItems(prev => [...prev, { ...t, id }])
      setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 4000)
    }
    return () => { emit = () => {} }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 inset-x-0 z-[90] flex flex-col items-center gap-2 px-4 pointer-events-none" dir="rtl">
      {items.map(t => (
        <div
          key={t.id}
          className={clsx(
            'pointer-events-auto flex items-center gap-2 max-w-sm w-full sm:w-auto px-4 py-3 rounded-2xl shadow-modal text-sm font-medium animate-fade-in',
            t.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-gray-900 text-white dark:bg-gray-700'
          )}
        >
          {t.type === 'error'
            ? <AlertCircle size={16} className="flex-shrink-0" />
            : <CheckCircle2 size={16} className="flex-shrink-0 text-green-400" />}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => setItems(prev => prev.filter(i => i.id !== t.id))}
            aria-label="סגור הודעה"
            className="text-white/60 hover:text-white flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
