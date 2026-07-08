import { useState } from 'react'
import { MessageSquarePlus, X, Loader2, Check, Image as ImageIcon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { saveFeedback, uploadFeedbackScreenshot, updateFeedbackScreenshot } from '../../lib/db'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'

export default function FeedbackButton() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const [error, setError] = useState('')

  const close = () => { setOpen(false); setText(''); setFile(null); setDone(false); setImgFailed(false); setError('') }

  useEscapeToClose(close, open && !saving)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    setError('')
    try {
      const submittedBy = { uid: user?.uid, name: user?.name, email: user?.email }
      const id = await saveFeedback({ text: text.trim(), submittedBy })
      // The text report is already saved; an image failure (e.g. HEIC that
      // won't decode/upload) must not discard the whole report.
      if (file) {
        try {
          const url = await uploadFeedbackScreenshot(id, file)
          await updateFeedbackScreenshot(id, url)
        } catch (imgErr) {
          console.error('feedback screenshot failed (report still saved)', imgErr)
          setImgFailed(true)
        }
      }
      setDone(true)
      setTimeout(close, 2200)
    } catch (err) {
      console.error('feedback submit failed', err)
      setError('שליחת הדיווח נכשלה, נסו שוב')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 md:bottom-6 end-4 z-30 flex items-center gap-2 px-4 py-3 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 transition-colors text-sm font-semibold"
        aria-label="דווח על באג או הצע רעיון"
      >
        <MessageSquarePlus size={18} />
        <span className="hidden sm:inline">משוב</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={close} />
          <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-gray-800 z-50 flex flex-col animate-slide-from-right" dir="rtl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <button onClick={close} aria-label="סגור" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"><X size={18} /></button>
              <h2 className="font-bold text-gray-800 dark:text-gray-100">דיווח על באג / רעיון לשיפור</h2>
            </div>

            {done ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Check size={26} className="text-green-600 dark:text-green-400" />
                </div>
                <p className="font-bold text-gray-800 dark:text-gray-100">תודה! הדיווח נשלח</p>
                {imgFailed && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">התמונה לא נטענה, אך הדיווח נשמר</p>}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1 text-right">מה קרה? מה תרצו שנשפר?</label>
                  <textarea value={text} onChange={e => setText(e.target.value)} required
                    rows={6} className="input w-full text-right text-sm resize-none leading-relaxed" placeholder="תארו את הבעיה או הרעיון..." />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300 cursor-pointer">
                    <ImageIcon size={14} />
                    {file ? file.name : 'צרף צילום מסך (אופציונלי)'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400 text-right bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">{error}</p>}

                <button type="submit" disabled={saving || !text.trim()}
                  className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <MessageSquarePlus size={16} />}
                  {saving ? 'שולח...' : 'שליחה'}
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </>
  )
}
