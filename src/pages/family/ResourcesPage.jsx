import { useState, useEffect } from 'react'
import { getResources } from '../../lib/db'
import { BookOpen, ExternalLink, Loader2, FileText, Map, Phone, Calendar, Video, Link } from 'lucide-react'

const ICON_MAP = {
  link:     { icon: Link,         bg: 'bg-primary-50',   color: 'text-primary-600' },
  doc:      { icon: FileText,     bg: 'bg-blue-50',      color: 'text-blue-600' },
  calendar: { icon: Calendar,     bg: 'bg-accent-50',    color: 'text-accent-600' },
  map:      { icon: Map,          bg: 'bg-green-50',     color: 'text-green-600' },
  phone:    { icon: Phone,        bg: 'bg-teal-50',      color: 'text-teal-600' },
  video:    { icon: Video,        bg: 'bg-purple-50',    color: 'text-purple-600' },
  external: { icon: ExternalLink, bg: 'bg-gray-50',      color: 'text-gray-500' },
}

export default function ResourcesPage() {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getResources()
      .then(r => { setResources(r); setLoading(false) })
      .catch(err => { console.error('ResourcesPage load failed', err); setLoading(false) })
  }, [])

  const categories = [...new Set(resources.map(r => r.category).filter(Boolean))]

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 size={32} className="animate-spin text-primary-400" />
      </div>
    )
  }

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2">
          <BookOpen size={22} />
          מידע שימושי
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">קישורים וכלים חשובים לקהילה</p>
      </div>

      {resources.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <BookOpen size={44} className="mx-auto mb-4 opacity-25" />
          <p className="font-semibold text-gray-500">אין מידע עדיין</p>
          <p className="text-sm mt-1">הצוות יוסיף קישורים שימושיים בקרוב</p>
        </div>
      )}

      {categories.map(cat => (
        <section key={cat} className="mb-6">
          <h2 className="font-bold text-gray-500 text-xs uppercase tracking-wide mb-3 px-1">{cat}</h2>
          <div className="space-y-2">
            {resources.filter(r => r.category === cat).map(resource => {
              const { icon: Icon, bg, color } = ICON_MAP[resource.iconType] || ICON_MAP.link
              return (
                <a
                  key={resource.id}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card p-4 flex items-center gap-3 hover:shadow-card-hover transition-[box-shadow] duration-200 group"
                >
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${bg} group-hover:opacity-80 transition-opacity`}>
                    <Icon size={16} className={color} />
                  </div>
                  <div className="flex-1 text-right min-w-0">
                    <div className="font-semibold text-gray-800 text-sm">{resource.title}</div>
                    {resource.description && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{resource.description}</div>
                    )}
                  </div>
                  <ExternalLink size={14} className="text-gray-300 group-hover:text-primary-400 transition-colors flex-shrink-0" />
                </a>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
