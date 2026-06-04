import { useState, useEffect } from 'react'
import { getEvents } from '../../lib/db'
import EventCard from '../../components/ui/EventCard'
import { Calendar, Loader2 } from 'lucide-react'

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEvents().then(data => { setEvents(data); setLoading(false) })
  }, [])

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2">
          <Calendar size={22} />
          אירועים קרובים
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{events.length} אירועים מתוכננים</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-primary-400" size={32} />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {events.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {events.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">אין אירועים קרובים</p>
        </div>
      )}
    </div>
  )
}
