// Mock data to simulate the app before Supabase is connected
// Phase 1 placeholder — replaced in Phase 5

export const MOCK_USERS = {
  newFamily: {
    id: 'new-1',
    name: 'משפחת לוי',
    email: 'levi@example.com',
    role: 'new_family',
    avatar: 'ל',
    hostFamilyId: 'host-1',
    joinedAt: '2024-01-15',
    phone: '050-1234567',
    onboardingComplete: true,
  },
  hostFamily: {
    id: 'host-1',
    name: 'משפחת כהן',
    email: 'cohen@example.com',
    role: 'host_family',
    avatar: 'כ',
    assignedNewFamilies: ['new-1'],
    phone: '052-9876543',
    onboardingComplete: true,
  },
  admin: {
    id: 'admin-1',
    name: 'ועד ההורים',
    email: 'admin@shahaf.edu',
    role: 'admin',
    avatar: 'ו',
    onboardingComplete: true,
  },
  superAdmin: {
    id: 'super-1',
    name: 'מנהל ראשי',
    email: 'super@shahaf.edu',
    role: 'super_admin',
    avatar: 'מ',
    onboardingComplete: true,
  },
}

export const MOCK_FORMS = [
  {
    id: 'form-1',
    title: 'טופס פרטי משפחה חדשה',
    description: 'נא למלא את כל הפרטים הנדרשים לקליטה בקהילה',
    targetRole: 'new_family',
    status: 'published',
    createdAt: '2024-01-10',
    fields: [
      { id: 'f1',  type: 'text',     label: 'שם משפחה',          placeholder: 'לוי',                 required: true },
      { id: 'f2',  type: 'text',     label: 'שם הורה ראשון',      placeholder: 'ישראל',               required: true },
      { id: 'f3',  type: 'text',     label: 'שם הורה שני',        placeholder: 'שרה',                 required: false },
      { id: 'f4',  type: 'tel',      label: 'טלפון נייד',         placeholder: '050-0000000',          required: true },
      { id: 'f5',  type: 'email',    label: 'אימייל',              placeholder: 'email@example.com',   required: true },
      { id: 'f6',  type: 'text',     label: 'כתובת מגורים',       placeholder: 'רחוב, מספר, עיר',     required: true },
      { id: 'f7',  type: 'text',     label: 'שם הילד/ה',          placeholder: 'שם פרטי',             required: true },
      { id: 'f8',  type: 'select',   label: 'כיתה',               placeholder: '',                    required: true, options: ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳'] },
      // NOTE: no medical/allergy field here — identified medical info raises
      // the DB classification (see docs/security-compliance-plan-2026-07.md §5.2).
      // Allergy restrictions are managed anonymously at the event level.
      { id: 'f10', type: 'textarea', label: 'הערות נוספות',        placeholder: '',                    required: false },
    ],
  },
  {
    id: 'form-2',
    title: 'טופס פרטי משפחה קולטת',
    description: 'פרטי קשר ומידע על המשפחה הקולטת',
    targetRole: 'host_family',
    status: 'published',
    createdAt: '2024-01-10',
    fields: [
      { id: 'f1', type: 'text',     label: 'שם משפחה',              placeholder: 'כהן',               required: true },
      { id: 'f2', type: 'tel',      label: 'טלפון',                  placeholder: '052-0000000',        required: true },
      { id: 'f3', type: 'email',    label: 'אימייל',                  placeholder: 'email@example.com', required: true },
      { id: 'f4', type: 'text',     label: 'כתובת',                  placeholder: 'רחוב, מספר, עיר',   required: true },
      { id: 'f5', type: 'text',     label: 'שנות ותק בבית הספר',   placeholder: 'לדוגמה: 5',          required: false },
      { id: 'f6', type: 'textarea', label: 'ספרו קצת על המשפחה',    placeholder: '',                   required: false },
    ],
  },
]

export const MOCK_FORM_SUBMISSIONS = [
  {
    id: 'sub-1',
    formId: 'form-1',
    userId: 'new-1',
    userName: 'משפחת לוי',
    submittedAt: '2024-01-16T10:00:00',
    data: {
      f1: 'לוי', f2: 'ישראל', f3: 'שרה', f4: '050-1234567',
      f5: 'levi@example.com', f6: 'רחוב הגפן 12, תל אביב',
      f7: 'דוד', f8: 'ב׳', f9: '', f10: '',
    },
  },
]

export const MOCK_TASKS = [
  {
    id: 't1',
    title: 'הגשת טפסי רישום',
    description: 'יש להגיש את כל הטפסים הנדרשים למזכירות בית הספר.',
    milestone: 'רישום ראשוני',
    milestoneOrder: 1,
    status: 'done',
    dueDate: '2024-01-20',
    priority: 'high',
    assignedTo: 'new-1',
    completedAt: '2024-01-18',
    resourceUrl: null,
    whatsappPhone: null,
  },
  {
    id: 't2',
    title: 'פגישת היכרות עם המשפחה הקולטת',
    description: 'תאמו פגישת היכרות ראשונה עם המשפחה הקולטת שלכם.',
    milestone: 'היכרות עם הקהילה',
    milestoneOrder: 2,
    status: 'in_progress',
    dueDate: '2024-01-28',
    priority: 'high',
    assignedTo: 'new-1',
    completedAt: null,
    resourceUrl: null,
    whatsappPhone: '0529876543',
  },
  {
    id: 't3',
    title: 'הצטרפות לקבוצת ה-WhatsApp של הכיתה',
    description: 'הצטרפו לקבוצת הוואטסאפ הכיתתית של ילדכם לעדכונים שוטפים.',
    milestone: 'היכרות עם הקהילה',
    milestoneOrder: 2,
    status: 'in_progress',
    dueDate: '2024-01-30',
    priority: 'medium',
    assignedTo: 'new-1',
    completedAt: null,
    resourceUrl: null,
    whatsappPhone: '0521111111',
  },
  {
    id: 't4',
    title: 'ביקור ראשון בבית הספר',
    description: 'בקרו את בית הספר בשעות הלימודים להכרת הסביבה.',
    milestone: 'היכרות עם הקהילה',
    milestoneOrder: 2,
    status: 'pending',
    dueDate: '2024-02-05',
    priority: 'medium',
    assignedTo: 'new-1',
    completedAt: null,
    resourceUrl: 'https://www.shahaf-school.org',
    whatsappPhone: null,
  },
  {
    id: 't5',
    title: 'הכרת הרבנים ומנהיגי הקהילה',
    description: 'קבלו מידע על מנהיגי הקהילה המקומית וצרו קשר.',
    milestone: 'שילוב בקהילה',
    milestoneOrder: 3,
    status: 'pending',
    dueDate: '2024-02-15',
    priority: 'low',
    assignedTo: 'new-1',
    completedAt: null,
    resourceUrl: null,
    whatsappPhone: null,
  },
  {
    id: 't6',
    title: 'השתתפות בערב הורים ראשון',
    description: 'הגיעו לערב הורים הראשון של שנת הלימודים.',
    milestone: 'שילוב בקהילה',
    milestoneOrder: 3,
    status: 'pending',
    dueDate: '2024-02-20',
    priority: 'high',
    assignedTo: 'new-1',
    completedAt: null,
    resourceUrl: null,
    whatsappPhone: null,
  },
]

export const MOCK_EVENTS = [
  {
    id: 'e1',
    title: 'ערב קבלת פנים למשפחות חדשות',
    description: 'ערב חגיגי לקבלת פנים לכל המשפחות החדשות שהצטרפו השנה לקהילה.',
    date: '2024-02-01',
    time: '19:00',
    location: 'בית הספר שחף — אולם האירועים',
    type: 'social',
    isRequired: true,
    calendarData: {
      title: 'ערב קבלת פנים — שחף',
      start: '2024-02-01T19:00:00',
      end: '2024-02-01T21:30:00',
      location: 'רחוב הדוגמה 1, תל אביב',
    },
  },
  {
    id: 'e2',
    title: 'ערב הורים — כיתה א',
    description: 'פגישה עם המורה ותיאום ציפיות לשנה הקרובה.',
    date: '2024-02-08',
    time: '18:30',
    location: 'כיתת הלימוד',
    type: 'school',
    isRequired: true,
    calendarData: {
      title: 'ערב הורים כיתה א — שחף',
      start: '2024-02-08T18:30:00',
      end: '2024-02-08T20:00:00',
      location: 'רחוב הדוגמה 1, תל אביב',
    },
  },
  {
    id: 'e3',
    title: 'שיעור היכרות — חינוך גופני',
    description: 'שיעור ספורט משותף להיכרות הילדים החדשים.',
    date: '2024-02-12',
    time: '08:00',
    location: 'מגרש בית הספר',
    type: 'school',
    isRequired: false,
    calendarData: {
      title: 'שיעור ספורט — שחף',
      start: '2024-02-12T08:00:00',
      end: '2024-02-12T09:00:00',
      location: 'רחוב הדוגמה 1, תל אביב',
    },
  },
]

export const MOCK_MILESTONES = [
  { id: 'm1', title: 'רישום ראשוני', order: 1, icon: '📋' },
  { id: 'm2', title: 'היכרות עם הקהילה', order: 2, icon: '🤝' },
  { id: 'm3', title: 'שילוב בקהילה', order: 3, icon: '🌟' },
]

export const MOCK_NEW_FAMILIES = [
  { id: 'new-1',  name: 'משפחת לוי',     avatar: 'ל', hostFamilyId: 'host-1', tasksTotal: 6, tasksDone: 1, joinedAt: '2024-01-15', phone: '050-1234567' },
  { id: 'new-2',  name: 'משפחת גולדברג', avatar: 'ג', hostFamilyId: 'host-1', tasksTotal: 6, tasksDone: 4, joinedAt: '2024-01-16', phone: '054-2345678' },
  { id: 'new-3',  name: 'משפחת אברהם',   avatar: 'א', hostFamilyId: 'host-2', tasksTotal: 6, tasksDone: 6, joinedAt: '2024-01-10', phone: '052-3456789' },
  { id: 'new-4',  name: 'משפחת מזרחי',   avatar: 'מ', hostFamilyId: 'host-2', tasksTotal: 6, tasksDone: 2, joinedAt: '2024-01-18', phone: '058-4567890' },
  { id: 'new-5',  name: 'משפחת שפירא',   avatar: 'ש', hostFamilyId: 'host-3', tasksTotal: 6, tasksDone: 5, joinedAt: '2024-01-12', phone: '050-5678901' },
  { id: 'new-6',  name: 'משפחת פרידמן',  avatar: 'פ', hostFamilyId: 'host-3', tasksTotal: 6, tasksDone: 3, joinedAt: '2024-01-20', phone: '054-6789012' },
  { id: 'new-7',  name: 'משפחת כץ',      avatar: 'כ', hostFamilyId: 'host-4', tasksTotal: 6, tasksDone: 0, joinedAt: '2024-01-22', phone: '052-7890123' },
  { id: 'new-8',  name: 'משפחת הרצוג',   avatar: 'ה', hostFamilyId: 'host-4', tasksTotal: 6, tasksDone: 2, joinedAt: '2024-01-19', phone: '058-8901234' },
  { id: 'new-9',  name: 'משפחת ברקוביץ', avatar: 'ב', hostFamilyId: 'host-5', tasksTotal: 6, tasksDone: 4, joinedAt: '2024-01-14', phone: '050-9012345' },
  { id: 'new-10', name: 'משפחת נחמיאס',  avatar: 'נ', hostFamilyId: 'host-5', tasksTotal: 6, tasksDone: 1, joinedAt: '2024-01-21', phone: '054-0123456' },
  { id: 'new-11', name: 'משפחת טל',      avatar: 'ט', hostFamilyId: 'host-6', tasksTotal: 6, tasksDone: 3, joinedAt: '2024-01-17', phone: '052-1234567' },
  { id: 'new-12', name: 'משפחת ורדי',    avatar: 'ו', hostFamilyId: 'host-6', tasksTotal: 6, tasksDone: 5, joinedAt: '2024-01-13', phone: '058-2345678' },
]

export const MOCK_HOST_FAMILIES = [
  { id: 'host-1', name: 'משפחת כהן',      avatar: 'כ', assignedIds: ['new-1', 'new-2'],   phone: '052-9876543' },
  { id: 'host-2', name: 'משפחת ישראלי',   avatar: 'י', assignedIds: ['new-3', 'new-4'],   phone: '050-8765432' },
  { id: 'host-3', name: 'משפחת רוזנברג',  avatar: 'ר', assignedIds: ['new-5', 'new-6'],   phone: '054-7654321' },
  { id: 'host-4', name: 'משפחת בן-דוד',   avatar: 'ב', assignedIds: ['new-7', 'new-8'],   phone: '058-6543210' },
  { id: 'host-5', name: 'משפחת אלקיים',   avatar: 'א', assignedIds: ['new-9', 'new-10'],  phone: '050-5432109' },
  { id: 'host-6', name: 'משפחת שטרן',     avatar: 'ש', assignedIds: ['new-11', 'new-12'], phone: '054-4321098' },
  { id: 'host-7', name: 'משפחת דרור',     avatar: 'ד', assignedIds: [],                   phone: '052-3210987' },
  { id: 'host-8', name: 'משפחת מנדלסון',  avatar: 'מ', assignedIds: [],                   phone: '058-2109876' },
]

export const MOCK_STATS = {
  totalNewFamilies: 12,
  totalHostFamilies: 8,
  avgTaskCompletion: 67,
  pendingTasks: 34,
  upcomingEvents: 3,
  recentActivity: 5,
}

export const MOCK_ACTIVITY_LOGS = [
  { id: 'a1', userId: 'new-1', userName: 'משפחת לוי', action: 'completed_task', detail: 'השלים: הגשת טפסי רישום', createdAt: '2024-01-18T14:30:00' },
  { id: 'a2', userId: 'host-1', userName: 'משפחת כהן', action: 'sent_message', detail: 'שלח הודעת עידוד למשפחת לוי', createdAt: '2024-01-17T10:15:00' },
  { id: 'a3', userId: 'new-1', userName: 'משפחת לוי', action: 'chatbot_query', detail: 'שאל על הרשמה לפעילויות', createdAt: '2024-01-17T09:00:00' },
  { id: 'a4', userId: 'admin-1', userName: 'מנהל', action: 'published_event', detail: 'פרסם: ערב קבלת פנים למשפחות חדשות', createdAt: '2024-01-16T16:00:00' },
]

export const MOCK_RESOURCES = [
  { id: 'r1', category: 'בית הספר', title: 'אתר בית הספר שחף', url: 'https://www.shahaf-school.org', description: 'מידע כללי, לוח שנה ועדכונים' },
  { id: 'r2', category: 'בית הספר', title: 'לוח שנה שנתי', url: '#', description: 'כל חגים, ימי עיון וטיולים' },
  { id: 'r3', category: 'קהילה', title: 'מרכז קהילתי', url: '#', description: 'פעילויות ואירועים בשכונה' },
  { id: 'r4', category: 'שאלות נפוצות', title: 'מדריך לקראת השנה', url: '#', description: 'כל מה שצריך לדעת' },
]
