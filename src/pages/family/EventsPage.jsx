import { MOCK_EVENTS } from '../../lib/mockData'
import EventCard from '../../components/ui/EventCard'
import { Calendar } from 'lucide-react'

export default function EventsPage() {
  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2">
          <Calendar size={22} />
          אירועים קרובים
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{MOCK_EVENTS.length} אירועים מתוכננים</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {MOCK_EVENTS.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {MOCK_EVENTS.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">אין אירועים קרובים</p>
        </div>
      )}
    </div>
  )
}
