import { useEffect } from 'react'

// Close a slide-panel / modal on Escape. Pass the onClose handler; pass
// enabled=false to skip (e.g. while a save is in flight).
export function useEscapeToClose(onClose, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, enabled])
}
