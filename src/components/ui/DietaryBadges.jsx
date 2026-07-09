import { AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import { dietaryLabel } from '../../lib/dietary'

// Amber "ללא בוטנים" pills for an event's anonymous dietary restrictions.
// Renders nothing when the event has none.
export default function DietaryBadges({ event, compact = false }) {
  const tags = event.dietaryRestrictions || []
  const note = event.dietaryNote || ''
  if (!tags.length && !note) return null

  return (
    <div className={clsx(
      'rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/30',
      compact ? 'px-2.5 py-1.5' : 'px-3 py-2.5'
    )}>
      <div className="flex flex-wrap items-center gap-1.5 justify-end">
        {tags.map(t => (
          <span key={t} className={clsx(
            'rounded-full font-medium bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700',
            compact ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-0.5'
          )}>
            {`ללא ${dietaryLabel(t)}`}
          </span>
        ))}
        <AlertTriangle size={compact ? 13 : 15} className="text-amber-500 flex-shrink-0" />
      </div>
      {note && !compact && (
        <p className="text-xs text-amber-700 dark:text-amber-300 text-right mt-1.5">{note}</p>
      )}
    </div>
  )
}
