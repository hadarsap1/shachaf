import { MOCK_RESOURCES } from '../../lib/mockData'
import { BookOpen, ExternalLink } from 'lucide-react'

export default function ResourcesPage() {
  const categories = [...new Set(MOCK_RESOURCES.map(r => r.category))]

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2">
          <BookOpen size={22} />
          מידע שימושי
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">קישורים וכלים חשובים לקהילה</p>
      </div>

      {categories.map(cat => (
        <section key={cat} className="mb-6">
          <h2 className="font-bold text-gray-600 text-xs uppercase tracking-wide mb-3 px-1">{cat}</h2>
          <div className="space-y-2">
            {MOCK_RESOURCES.filter(r => r.category === cat).map(resource => (
              <a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card p-4 flex items-center gap-3 hover:shadow-card-hover transition-all duration-200 group"
              >
                <div className="p-2 bg-primary-50 rounded-xl group-hover:bg-primary-100 transition-colors">
                  <ExternalLink size={16} className="text-primary-600" />
                </div>
                <div className="flex-1 text-right">
                  <div className="font-semibold text-gray-800 text-sm">{resource.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{resource.description}</div>
                </div>
                <ExternalLink size={14} className="text-gray-300 group-hover:text-primary-400 transition-colors flex-shrink-0" />
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
