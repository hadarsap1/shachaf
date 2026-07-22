import clsx from 'clsx'

// Compact target-audience selector, shared by the committee and group event
// forms (and anywhere a non-admin creates an event from within an entity).
// targetGroups is single-select — matching the admin event panel — with a
// class multi-select shown when "כיתות מסוימות" is chosen. Audience is a
// DISPLAY filter for the main feed only; the event is still anchored to its
// committee/group via committeeId/groupId, so it always shows there too.
//
// value: { targetGroups: string[], classIds: string[] }
// onChange: (nextValue) => void
// entityLabel: when set (e.g. "הקבוצה" / "הוועדה"), a first option
//   "רק חברי <entityLabel>" (targetGroups=['members']) is offered — such events
//   stay out of the community-wide feed and show only inside the entity, to
//   members. Used by group/committee forms; omitted for class/admin events.
export const AUDIENCE_OPTIONS = [
  { value: 'all',         label: 'כל הקהילה' },
  { value: 'new_family',  label: 'משפחות חדשות' },
  { value: 'host_family', label: 'משפחות קולטות' },
  { value: 'class',       label: 'כיתות מסוימות' },
]

export default function EventAudienceFields({ value, onChange, classes = [], entityLabel = '' }) {
  const options = entityLabel
    ? [{ value: 'members', label: `רק חברי ${entityLabel}` }, ...AUDIENCE_OPTIONS]
    : AUDIENCE_OPTIONS
  const targetGroups = value?.targetGroups?.length ? value.targetGroups : ['all']
  const classIds = value?.classIds || []
  const active = targetGroups[0] || 'all'

  const pickAudience = (v) => {
    // 'class' keeps any already-selected classIds; everything else clears them
    onChange({ targetGroups: [v], classIds: v === 'class' ? classIds : [] })
  }
  const toggleClass = (id) => {
    const next = classIds.includes(id) ? classIds.filter(c => c !== id) : [...classIds, id]
    onChange({ targetGroups: ['class'], classIds: next })
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block text-right">קהל יעד</label>
      <div className="flex flex-wrap gap-1.5 justify-end">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => pickAudience(o.value)}
            className={clsx(
              'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
              active === o.value
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {active === 'class' && (
        <div className="flex flex-wrap gap-1.5 justify-end pt-1">
          {classes.length === 0 ? (
            <span className="text-xs text-gray-400">אין כיתות במערכת</span>
          ) : classes.map(c => {
            const on = classIds.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleClass(c.id)}
                className={clsx('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  on ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600')}
                style={on ? { backgroundColor: c.color || '#1B3B70' } : {}}
              >
                {c.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
