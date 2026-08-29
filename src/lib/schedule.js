// Weekly schedule grid — shared by the family class page and the admin editor.
// Times are the school's standard bell schedule; stored start-first and
// rendered dir="ltr" so they read correctly inside the RTL table.
export const SCHEDULE_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳']

export const SCHEDULE_PERIODS = [
  { id: 'morning', label: 'מפגש בוקר',  time: '08:00-08:30' },
  { id: '1',       label: '1',           time: '08:30-09:10' },
  { id: '2',       label: '2',           time: '09:10-09:50' },
  { id: 'break1',  label: 'הפסקת עשר',   time: '09:50-10:30', isBreak: true },
  { id: '3',       label: '3',           time: '10:30-11:15' },
  { id: '4',       label: '4',           time: '11:15-12:00' },
  { id: 'break2',  label: 'הפסקה קטנה',  time: '12:00-12:20', isBreak: true },
  { id: '5',       label: '5',           time: '12:20-13:00' },
  { id: '6',       label: '6',           time: '13:00-13:40' },
]
