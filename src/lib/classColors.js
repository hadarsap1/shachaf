export const CLASS_COLORS = [
  '#1B3B70', '#2BA888', '#F09530', '#D94E1F',
  '#9C27B0', '#E91E63', '#00ACC1', '#7CB342',
  '#FF5722', '#607D8B', '#795548', '#F06292',
]

export const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי']

export const blankCenterHours = () =>
  DAYS_HE.map(day => ({ day, start: '08:00', end: '14:00', active: false }))

export const COMMITTEE_ICONS = [
  'Users', 'Heart', 'Star', 'Music', 'Book', 'Globe',
  'Zap', 'Gift', 'Coffee', 'Briefcase', 'Camera', 'Sun',
  'Leaf', 'Palette', 'Flag', 'Shield',
]
