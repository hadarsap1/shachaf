// Event-level dietary/allergy restrictions — deliberately anonymous.
// Restrictions live on the EVENT (or class) only, never on a child document
// or an identified form submission: linking medical info to an identified
// person raises the database's classification under the Israeli data
// security regulations (see docs/security-compliance-plan-2026-07.md §5.2).

export const DIETARY_OPTIONS = [
  { value: 'peanuts', label: 'בוטנים' },
  { value: 'nuts',    label: 'אגוזים' },
  { value: 'gluten',  label: 'גלוטן' },
  { value: 'dairy',   label: 'מוצרי חלב' },
  { value: 'eggs',    label: 'ביצים' },
  { value: 'sesame',  label: 'שומשום' },
]

export const DIETARY_NOTE_MAX = 100

export function dietaryLabel(value) {
  return DIETARY_OPTIONS.find(o => o.value === value)?.label || value
}
