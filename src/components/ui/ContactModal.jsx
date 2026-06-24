import { X, Phone, Mail, MessageCircle } from 'lucide-react'

export default function ContactModal({ person, onClose }) {
  if (!person) return null

  const initials = person.name
    ? person.name.split(' ').map(w => w[0]).slice(0, 2).join('')
    : '?'

  const openWhatsApp = () => {
    const digits = person.phone.replace(/\D/g, '')
    const e164 = digits.startsWith('972') ? digits : '972' + digits.replace(/^0/, '')
    window.open(`https://wa.me/${e164}`, '_blank')
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-modal flex flex-col animate-slide-up"
        dir="rtl"
        style={{ maxHeight: '70vh' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
          <h2 className="font-bold text-gray-800">פרטי קשר</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-xl font-bold text-primary-700">
              {initials}
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{person.name}</p>
              {person.title && <p className="text-sm text-gray-500 mt-0.5">{person.title}</p>}
            </div>
          </div>

          {/* Contact actions */}
          <div className="space-y-3">
            {person.phone && (
              <a
                href={`tel:${person.phone}`}
                className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-primary-50 hover:border-primary-200 transition-[background-color,border-color] duration-150"
                dir="ltr"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <Phone size={18} className="text-primary-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 text-right">טלפון</p>
                  <p className="font-semibold text-gray-800">{person.phone}</p>
                </div>
              </a>
            )}

            {person.phone && (
              <button
                onClick={openWhatsApp}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-green-50 hover:border-green-200 transition-[background-color,border-color] duration-150"
              >
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <MessageCircle size={18} className="text-green-600" />
                </div>
                <div className="flex-1 text-right">
                  <p className="text-xs text-gray-400">WhatsApp</p>
                  <p className="font-semibold text-gray-800">{person.phone}</p>
                </div>
              </button>
            )}

            {person.email && (
              <a
                href={`mailto:${person.email}`}
                className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-secondary-50 hover:border-secondary-200 transition-[background-color,border-color] duration-150"
                dir="ltr"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary-100 flex items-center justify-center flex-shrink-0">
                  <Mail size={18} className="text-secondary-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 text-right">אימייל</p>
                  <p className="font-semibold text-gray-800 text-sm">{person.email}</p>
                </div>
              </a>
            )}
          </div>

          {!person.phone && !person.email && (
            <p className="text-center text-sm text-gray-400 mt-4">אין פרטי קשר זמינים</p>
          )}
        </div>
      </div>
    </>
  )
}
