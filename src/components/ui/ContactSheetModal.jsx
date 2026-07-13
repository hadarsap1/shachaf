import { useState, useEffect, useMemo } from 'react'
import { X, Download, Share2, Plus, Trash2, Loader2, GripVertical } from 'lucide-react'
import clsx from 'clsx'
import { TEMPLATES, THEMES, buildSheetSvg, entriesFromChildren, svgToJpegBlob, loadChildPhotoMap } from '../../lib/contactSheet'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import { toast } from './Toaster'

// consentedParentsByUid — parents who approved the policy (uid → user doc);
// when provided, only their details appear on the generated sheet.
export default function ContactSheetModal({ className, children, consentedParentsByUid = null, onClose }) {
  const [template, setTemplate] = useState('cards')
  const [theme, setTheme] = useState('pink')
  const [title, setTitle] = useState(`דף קשר — כיתה ${className}`)
  const [subtitle, setSubtitle] = useState('')
  const [entries, setEntries] = useState(() => entriesFromChildren(children, consentedParentsByUid))
  const [busy, setBusy] = useState(false)
  // childName → embedded data URL, only for photos parents chose to upload.
  // Kept separate from the editable entries so photo loading never races edits.
  const [photoMap, setPhotoMap] = useState({})
  const [includePhotos, setIncludePhotos] = useState(true)

  useEffect(() => {
    let active = true
    loadChildPhotoMap(children).then(map => { if (active) setPhotoMap(map) })
    return () => { active = false }
  }, [children])

  useEscapeToClose(onClose, !busy)

  const svg = useMemo(
    () => buildSheetSvg({
      template, title, subtitle, theme,
      entries: includePhotos
        ? entries.map(e => ({ ...e, photo: photoMap[e.name] }))
        : entries,
    }),
    [template, title, subtitle, entries, theme, photoMap, includePhotos]
  )
  const previewUrl = useMemo(
    () => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    [svg]
  )

  const fileName = `דף-קשר-כיתה-${className}.jpg`

  const handleDownload = async () => {
    setBusy(true)
    try {
      const blob = await svgToJpegBlob(svg)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast('שמירת התמונה נכשלה', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleShare = async () => {
    setBusy(true)
    try {
      const blob = await svgToJpegBlob(svg)
      const file = new File([blob], fileName, { type: 'image/jpeg' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title })
      } else {
        // Desktop / unsupported: fall back to download + hint
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = fileName; a.click()
        URL.revokeObjectURL(url)
        toast('שיתוף ישיר אינו נתמך במכשיר זה — התמונה הורדה, ניתן לצרף לוואטסאפ')
      }
    } catch (e) {
      if (e?.name !== 'AbortError') toast('השיתוף נכשל', 'error')
    } finally {
      setBusy(false)
    }
  }

  const editEntry = (i, patch) => setEntries(es => es.map((e, k) => k === i ? { ...e, ...patch } : e))
  const removeEntry = (i) => setEntries(es => es.filter((_, k) => k !== i))
  const addEntry = () => setEntries(es => [...es, { name: '', lines: [''] }])

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="דף קשר"
        className="fixed inset-0 md:inset-4 md:rounded-2xl bg-white dark:bg-gray-900 z-50 flex flex-col overflow-hidden md:max-w-5xl md:mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <button onClick={onClose} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700"><X size={18} /></button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100">יצירת דף קשר</h2>
          <div className="flex gap-2">
            <button onClick={handleDownload} disabled={busy}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-800 disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} JPG
            </button>
            <button onClick={handleShare} disabled={busy}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />} שיתוף
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto md:grid md:grid-cols-2 md:gap-0 md:overflow-hidden">
          {/* Editor */}
          <div className="p-5 space-y-4 md:overflow-y-auto md:border-l md:border-gray-100 md:dark:border-gray-700">
            <div>
              <label className="label block mb-1 text-right">כותרת</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="input w-full text-right" />
            </div>
            <div>
              <label className="label block mb-1 text-right">כותרת משנה (אופציונלי)</label>
              <input value={subtitle} onChange={e => setSubtitle(e.target.value)} className="input w-full text-right" placeholder="למשל: שנת תשפ״ו" />
            </div>
            <div>
              <label className="label block mb-1 text-right">עיצוב</label>
              <div className="flex gap-2">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => setTemplate(t.id)}
                    className={clsx('flex-1 py-2 rounded-xl text-sm font-medium border transition-colors',
                      template === t.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700')}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label block mb-2 text-right">צבע</label>
              <div className="flex flex-wrap gap-2 justify-end">
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => setTheme(t.id)} title={t.label}
                    aria-label={t.label}
                    className={clsx('w-9 h-9 rounded-full border-2 transition-transform',
                      theme === t.id ? 'ring-2 ring-offset-2 ring-primary-500 scale-110 border-white' : 'border-gray-200 hover:scale-105')}
                    style={{ backgroundColor: t.swatch }} />
                ))}
              </div>
            </div>

            {Object.keys(photoMap).length > 0 ? (
              <label className="flex items-center justify-end gap-2.5 cursor-pointer bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                <span className="text-sm text-gray-700 dark:text-gray-200 text-right">
                  כלול תמונות ילדים
                  <span className="block text-xs text-gray-400">רק תמונות שהועלו ע"י ההורים ({Object.keys(photoMap).length})</span>
                </span>
                <input type="checkbox" checked={includePhotos} onChange={e => setIncludePhotos(e.target.checked)}
                  className="w-4 h-4 accent-primary-600" />
              </label>
            ) : (
              <p className="text-xs text-gray-400 text-right bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                לא נמצאו תמונות ילדים לדף זה — תמונה נכללת רק כשההורה העלה ואישר אותה בהגדרות,
                ורק לילדים שהוריהם אישרו את התקנון
              </p>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <button onClick={addEntry} className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"><Plus size={12} /> הוסף שורה</button>
                <label className="label">רשומות ({entries.filter(e => e.name).length})</label>
              </div>
              <div className="space-y-2">
                {entries.map((e, i) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-2.5 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1.5">
                      <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
                      <input value={e.name} onChange={ev => editEntry(i, { name: ev.target.value })}
                        placeholder="שם הילד/ה" className="input flex-1 text-right text-sm py-1.5" />
                      <button onClick={() => removeEntry(i)} aria-label="מחק" className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={14} /></button>
                    </div>
                    <textarea
                      value={e.lines.join('\n')}
                      onChange={ev => editEntry(i, { lines: ev.target.value.split('\n') })}
                      rows={Math.min(3, Math.max(1, e.lines.length))}
                      placeholder="הורה  טלפון (שורה לכל הורה)"
                      className="input w-full text-right text-xs py-1.5 resize-none leading-relaxed"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="p-5 bg-gray-50 dark:bg-gray-800/40 md:overflow-y-auto flex justify-center items-start">
            <img src={previewUrl} alt="תצוגה מקדימה של דף הקשר" className="w-full max-w-md rounded-xl shadow-md border border-gray-100 dark:border-gray-700" />
          </div>
        </div>
      </div>
    </>
  )
}
