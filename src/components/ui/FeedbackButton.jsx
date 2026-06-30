import { useState } from 'react'
import { MessageSquarePlus, X, Send, Loader2, Paperclip, Check } from 'lucide-react'
import { saveFeedback, uploadFeedbackScreenshot } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'

export default function FeedbackButton() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    if (!text.trim()) return
    setSending(true)
    try {
      const id = await saveFeedback({
        text: text.trim(),
        screenshotUrl: null,
        submittedBy: { uid: user.uid, name: user.name || user.email || '' },
      })
      if (file) {
        const url = await uploadFeedbackScreenshot(id, file)
        // ponytail: update screenshot URL after upload — fire-and-forget ok here
        const { updateDoc, doc } = await import('firebase/firestore')
        const { db } = await import('../../lib/firebase')
        await updateDoc(doc(db, 'feedback', id), { screenshotUrl: url })
      }
      setSent(true)
      setText('')
      setFile(null)
      setTimeout(() => { setSent(false); setOpen(false) }, 2000)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 md:bottom-6 z-30 w-11 h-11 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 flex items-center justify-center transition-all"
        title="דווח על תקלה / שלח רעיון"
        aria-label="דיווח ורעיונות"
      >
        <MessageSquarePlus size={18} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />
          <div className="fixed bottom-24 left-4 md:bottom-20 z-50 w-80 bg-white rounded-2xl shadow-2xl p-5" dir="rtl">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                <X size={16} />
              </button>
              <h3 className="font-bold text-gray-800 text-sm">דיווח / רעיון לשיפור</h3>
            </div>
            {sent ? (
              <p className="text-center text-green-600 font-semibold py-4 flex items-center justify-center gap-2">
                <Check size={18} /> תודה! קיבלנו את הפנייה
              </p>
            ) : (
              <>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={4}
                  className="input w-full text-sm resize-none"
                  placeholder="תאר את הבעיה או הרעיון..."
                />
                <div className="flex items-center gap-2 mt-3">
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer hover:text-primary-600 flex-1 truncate">
                    <Paperclip size={13} />
                    <span className="truncate">{file ? file.name : 'צירוף צילום מסך'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => setFile(e.target.files[0] || null)}
                    />
                  </label>
                  <button
                    onClick={handleSubmit}
                    disabled={sending || !text.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-primary-700 transition-colors flex-shrink-0"
                  >
                    {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    שלח
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
