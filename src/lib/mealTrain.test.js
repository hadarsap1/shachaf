import { describe, it, expect } from 'vitest'
import {
  buildSlots, groupByDate, formatSlotDate, canSeeAddress, slotStats, SLOT_TYPES,
  isMealTrainCommittee, addDay, removeDay, toggleDayType,
  myMealTrainEvents, mealTrainInviteMessage,
  isSlotTaken, claimerUidsOf, mergeSlots, daysFromSlots, babyGreeting, BABY_TYPES,
} from './mealTrain'

describe('addDay / removeDay', () => {
  it('adds a day with both slot types open and keeps the list sorted', () => {
    let days = addDay([], '2026-08-09')
    days = addDay(days, '2026-08-05')
    expect(days.map(d => d.date)).toEqual(['2026-08-05', '2026-08-09'])
    expect(days[0].types).toEqual(['meal', 'treat'])
  })
  it('ignores a duplicate or empty date', () => {
    const days = addDay([], '2026-08-05')
    expect(addDay(days, '2026-08-05')).toBe(days)
    expect(addDay(days, '')).toBe(days)
  })
  it('caps the rota so a mis-click cannot create hundreds of days', () => {
    let days = []
    for (let i = 1; i <= 70; i++) days = addDay(days, `2026-08-${String(i).padStart(2, '0')}`)
    expect(days).toHaveLength(60)
  })
  it('removes a day', () => {
    const days = addDay(addDay([], '2026-08-05'), '2026-08-09')
    expect(removeDay(days, '2026-08-05').map(d => d.date)).toEqual(['2026-08-09'])
  })
})

describe('toggleDayType', () => {
  it('turns a slot type off and back on for that day only', () => {
    const days = addDay(addDay([], '2026-08-05'), '2026-08-09')
    const off = toggleDayType(days, '2026-08-05', 'treat')
    expect(off[0].types).toEqual(['meal'])
    expect(off[1].types).toEqual(['meal', 'treat'])
    expect(toggleDayType(off, '2026-08-05', 'treat')[0].types).toEqual(['meal', 'treat'])
  })
  it('refuses to leave a day with no slot at all', () => {
    const days = toggleDayType(addDay([], '2026-08-05'), '2026-08-05', 'treat')
    expect(toggleDayType(days, '2026-08-05', 'meal')[0].types).toEqual(['meal'])
  })
})

describe('buildSlots', () => {
  it('creates a meal slot and a treat slot per day', () => {
    const slots = buildSlots(addDay([], '2026-08-05'))
    expect(slots).toHaveLength(2)
    expect(slots.map(s => s.type)).toEqual(['meal', 'treat'])
    expect(slots[0]).toMatchObject({ id: '2026-08-05_meal', date: '2026-08-05', byUid: '', byName: '' })
  })
  it('honours a day where only one type was left open', () => {
    const days = toggleDayType(addDay([], '2026-08-05'), '2026-08-05', 'meal')
    expect(buildSlots(days).map(s => s.type)).toEqual(['treat'])
  })
  it('keeps the meal-before-treat order whatever order the types were toggled in', () => {
    expect(buildSlots([{ date: '2026-08-05', types: ['treat', 'meal'] }]).map(s => s.type))
      .toEqual(['meal', 'treat'])
  })
  it('still accepts a plain date string (trains created before day types)', () => {
    expect(buildSlots(['2026-08-05']).map(s => s.id))
      .toEqual(['2026-08-05_meal', '2026-08-05_treat'])
  })
  it('handles empty input', () => {
    expect(buildSlots([])).toEqual([])
    expect(buildSlots(undefined)).toEqual([])
  })
})

describe('groupByDate', () => {
  it('groups slots per date in ascending order with a stable type order', () => {
    const slots = [
      { id: 'b_treat', date: '2026-08-09', type: 'treat' },
      { id: 'a_treat', date: '2026-08-05', type: 'treat' },
      { id: 'a_meal',  date: '2026-08-05', type: 'meal' },
      { id: 'b_meal',  date: '2026-08-09', type: 'meal' },
    ]
    const groups = groupByDate(slots)
    expect(groups.map(g => g.date)).toEqual(['2026-08-05', '2026-08-09'])
    expect(groups[0].slots.map(s => s.type)).toEqual(['meal', 'treat'])
  })
})

describe('formatSlotDate', () => {
  it('formats as weekday + day/month', () => {
    expect(formatSlotDate('2026-08-05')).toBe('רביעי 5/08')
    expect(formatSlotDate('2026-08-09')).toBe('ראשון 9/08')
  })
  it('passes through unparsable values', () => {
    expect(formatSlotDate('not-a-date')).toBe('not-a-date')
  })
})

describe('canSeeAddress', () => {
  const train = { createdBy: 'coord', claimerUids: ['helper1'] }
  it('reveals to someone who claimed a slot', () => {
    expect(canSeeAddress(train, 'helper1')).toBe(true)
  })
  it('reveals to the coordinator who opened it, and to admins', () => {
    expect(canSeeAddress(train, 'coord')).toBe(true)
    expect(canSeeAddress(train, 'someone', true)).toBe(true)
  })
  it('hides from a member who has not signed up', () => {
    expect(canSeeAddress(train, 'stranger')).toBe(false)
    expect(canSeeAddress(train, '')).toBe(false)
    expect(canSeeAddress(null, 'helper1')).toBe(false)
  })
})

describe('slotStats', () => {
  it('counts taken vs open', () => {
    expect(slotStats([{ byUid: 'a' }, { byUid: '' }, { byUid: '' }])).toEqual({ total: 3, taken: 1, open: 2 })
    expect(slotStats([])).toEqual({ total: 0, taken: 0, open: 0 })
  })
})

describe('SLOT_TYPES', () => {
  it('carries the hints the sheet spelled out', () => {
    expect(SLOT_TYPES.find(t => t.value === 'meal').hint).toContain('תבשיל')
    expect(SLOT_TYPES.find(t => t.value === 'treat').hint).toContain('עוגה')
  })
})

describe('isMealTrainCommittee', () => {
  it('accepts the community-support committee out of the box', () => {
    expect(isMealTrainCommittee({ name: 'ועדת תמיכה בקהילה' })).toBe(true)
    expect(isMealTrainCommittee({ name: 'תמיכה' })).toBe(true)
  })

  it('rejects every other committee', () => {
    expect(isMealTrainCommittee({ name: 'ועד הורים' })).toBe(false)
    expect(isMealTrainCommittee({ name: 'ועדת תרבות' })).toBe(false)
    expect(isMealTrainCommittee(null)).toBe(false)
    expect(isMealTrainCommittee({})).toBe(false)
  })

  it('accepts any committee an admin explicitly flagged', () => {
    expect(isMealTrainCommittee({ name: 'ועדת תרבות', mealTrains: true })).toBe(true)
    expect(isMealTrainCommittee({ name: 'ועדת תרבות', mealTrains: false })).toBe(false)
  })
})

const sampleTrain = {
  id: 'train1',
  familyName: 'כהן',
  babyName: 'יהלי',
  parents: 'עידן ונועה',
  preferences: 'צמחוני ובריא',
  concept: 'מכינים מכל הלב',
  delivery: 'משאירים מחוץ לדלת',
  contactName: 'עידן',
  contactPhone: '054-5923478',
  claimerUids: ['me'],
  slots: [
    { id: '2026-08-05_meal',  date: '2026-08-05', type: 'meal',  byUid: 'me',    byName: 'אני' },
    { id: '2026-08-05_treat', date: '2026-08-05', type: 'treat', byUid: '',      byName: '' },
    { id: '2026-08-09_meal',  date: '2026-08-09', type: 'meal',  byUid: 'other', byName: 'מישהו' },
  ],
}

describe('myMealTrainEvents', () => {
  it('turns the slots I claimed into calendar entries', () => {
    const events = myMealTrainEvents([sampleTrain], 'me')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ date: '2026-08-05', mealTrainId: 'train1', type: 'community' })
    expect(events[0].title).toContain('ארוחה')
    expect(events[0].title).toContain('כהן')
  })

  it('ignores slots taken by someone else, and closed trains', () => {
    expect(myMealTrainEvents([sampleTrain], 'nobody')).toEqual([])
    expect(myMealTrainEvents([{ ...sampleTrain, status: 'closed' }], 'me')).toEqual([])
    expect(myMealTrainEvents([sampleTrain], '')).toEqual([])
    expect(myMealTrainEvents(undefined, 'me')).toEqual([])
  })

  it('never carries the delivery address into an exportable calendar entry', () => {
    const [event] = myMealTrainEvents([{ ...sampleTrain, address: 'תירוש 36' }], 'me')
    expect(event.location).toBe('')
    expect(JSON.stringify(event)).not.toContain('תירוש')
  })
})

describe('mealTrainInviteMessage', () => {
  const msg = mealTrainInviteMessage(sampleTrain, 'https://shachaf.vercel.app/meal-trains?train=train1')

  it('opens with the family and the baby', () => {
    expect(msg).toContain('סיר לידה למשפחת כהן')
    expect(msg).toContain('יהלי')
    expect(msg).toContain('עידן ונועה')
  })

  it('lists the dates and how many slots are still open', () => {
    expect(msg).toContain('רביעי 5/08')
    expect(msg).toContain('ראשון 9/08')
    expect(msg).toContain('נותרה משבצת אחת פנויה מתוך 3')
  })

  it('carries the signup link', () => {
    expect(msg).toContain('https://shachaf.vercel.app/meal-trains?train=train1')
  })

  it('never leaks the private address or entry code — the message gets forwarded', () => {
    const withPrivate = { ...sampleTrain, address: 'תירוש 36, דירה 6', buildingCode: '1974' }
    const out = mealTrainInviteMessage(withPrivate, 'https://x/y')
    expect(out).not.toContain('תירוש')
    expect(out).not.toContain('1974')
  })

  it('pluralises the open-slot count properly', () => {
    const twoOpen = { ...sampleTrain, slots: sampleTrain.slots.map(s => (
      s.byUid === 'me' ? s : { ...s, byUid: '', byName: '' })) }
    expect(mealTrainInviteMessage(twoOpen, '')).toContain('נותרו 2 משבצות פנויות מתוך 3')
  })

  it('celebrates a full pot instead of begging', () => {
    const full = { ...sampleTrain, slots: sampleTrain.slots.map(s => ({ ...s, byUid: 'someone', byName: 'מישהו' })) }
    expect(mealTrainInviteMessage(full, 'https://x/y')).toContain('כל המשבצות שוריינו')
  })

  it('survives a bare train with no optional fields', () => {
    expect(mealTrainInviteMessage({ familyName: 'לוי', slots: [] }, '')).toContain('משפחת לוי')
    expect(mealTrainInviteMessage(null, '')).toBe('')
  })
})

describe('isSlotTaken', () => {
  it('counts an app signup and a hand-written volunteer alike', () => {
    expect(isSlotTaken({ byUid: 'u1', byName: 'דנה' })).toBe(true)
    expect(isSlotTaken({ byUid: '', byName: 'שכנה מהבניין' })).toBe(true)
    expect(isSlotTaken({ byUid: '', byName: '' })).toBe(false)
    expect(isSlotTaken(null)).toBe(false)
  })

  it('makes slotStats count manual volunteers too', () => {
    const slots = [{ byUid: 'u1' }, { byUid: '', byName: 'סבתא' }, { byUid: '', byName: '' }]
    expect(slotStats(slots)).toEqual({ total: 3, taken: 2, open: 1 })
  })
})

describe('claimerUidsOf', () => {
  it('lists exactly the uids still holding a slot', () => {
    expect(claimerUidsOf([
      { byUid: 'u1' }, { byUid: 'u2' }, { byUid: 'u1' }, { byUid: '', byName: 'שכן' }, { byUid: '' },
    ])).toEqual(['u1', 'u2'])
  })
  it('drops everyone when nothing is claimed — address access goes with it', () => {
    expect(claimerUidsOf([{ byUid: '', byName: '' }])).toEqual([])
    expect(claimerUidsOf(undefined)).toEqual([])
  })
})

describe('mergeSlots', () => {
  const old = [
    { id: '2026-08-05_meal', date: '2026-08-05', type: 'meal', byUid: 'u1', byName: 'דנה' },
    { id: '2026-08-05_treat', date: '2026-08-05', type: 'treat', byUid: '', byName: 'סבתא' },
  ]

  it('keeps existing signups when the pot is edited', () => {
    const merged = mergeSlots(buildSlots([{ date: '2026-08-05', types: ['meal', 'treat'] }]), old)
    expect(merged[0]).toMatchObject({ byUid: 'u1', byName: 'דנה' })
    expect(merged[1]).toMatchObject({ byUid: '', byName: 'סבתא' })
  })

  it('leaves a newly added day empty', () => {
    const merged = mergeSlots(buildSlots(addDay(daysFromSlots(old), '2026-08-09')), old)
    const fresh = merged.filter(s => s.date === '2026-08-09')
    expect(fresh).toHaveLength(2)
    expect(fresh.every(s => !s.byUid && !s.byName)).toBe(true)
  })

  it('drops a signup together with the day it was on', () => {
    expect(mergeSlots(buildSlots([{ date: '2026-08-09', types: ['meal'] }]), old))
      .toEqual([{ id: '2026-08-09_meal', date: '2026-08-09', type: 'meal', byUid: '', byName: '' }])
  })
})

describe('daysFromSlots', () => {
  it('rebuilds the editor day list from stored slots', () => {
    expect(daysFromSlots([
      { id: 'b_treat', date: '2026-08-09', type: 'treat' },
      { id: 'a_treat', date: '2026-08-05', type: 'treat' },
      { id: 'a_meal',  date: '2026-08-05', type: 'meal' },
    ])).toEqual([
      { date: '2026-08-05', types: ['meal', 'treat'] },
      { date: '2026-08-09', types: ['treat'] },
    ])
  })
  it('round-trips through buildSlots', () => {
    const days = addDay(addDay([], '2026-08-05'), '2026-08-09')
    expect(daysFromSlots(buildSlots(days))).toEqual(days)
  })
})

describe('babyGreeting', () => {
  it('greets a boy, a girl and twins in the right form', () => {
    expect(babyGreeting({ babyName: 'יהלי', babyGender: 'boy' })).toBe('ברוך הבא יהלי')
    expect(babyGreeting({ babyName: 'נעמה', babyGender: 'girl' })).toBe('ברוכה הבאה נעמה')
    expect(babyGreeting({ babyName: 'עידו ורוני', babyGender: 'twins' })).toBe('ברוכים הבאים עידו ורוני')
    expect(babyGreeting({ babyName: 'שירה ומאיה', babyGender: 'twin_girls' })).toBe('ברוכות הבאות שירה ומאיה')
  })

  it('stays neutral when nobody said', () => {
    expect(babyGreeting({ babyName: 'יהלי' })).toBe('ברוך/ה הבא/ה יהלי')
    expect(babyGreeting({ babyGender: 'girl' })).toBe('ברוכה הבאה')
    expect(babyGreeting(null)).toBe('ברוך/ה הבא/ה')
  })

  it('covers every option offered in the UI', () => {
    for (const b of BABY_TYPES) {
      expect(babyGreeting({ babyName: 'x', babyGender: b.value })).toBe(`${b.greeting} x`)
    }
  })
})

describe('mealTrainInviteMessage — greeting', () => {
  it('uses the gendered greeting in the shared message', () => {
    const msg = mealTrainInviteMessage({ ...sampleTrain, babyGender: 'girl', babyName: 'נעמה' }, '')
    expect(msg).toContain('ברוכה הבאה נעמה 👶')
    expect(msg).not.toContain('ברוך הבא נעמה')
  })

  it('greets twins in the plural', () => {
    expect(mealTrainInviteMessage({ ...sampleTrain, babyGender: 'twins', babyName: 'עידו ורוני' }, ''))
      .toContain('ברוכים הבאים עידו ורוני 👶')
  })

  it('falls back to the neutral greeting for older pots with no gender', () => {
    expect(mealTrainInviteMessage(sampleTrain, '')).toContain('ברוך/ה הבא/ה יהלי 👶')
  })
})

describe('myMealTrainEvents — details for the exported calendar entry', () => {
  const priv = { address: 'תירוש 36, קומה 1 דירה 6', city: 'רעננה', buildingCode: '1974' }

  it('puts the delivery address in the entry location, not buried in the text', () => {
    const [ev] = myMealTrainEvents([sampleTrain], 'me', { train1: priv })
    expect(ev.location).toBe('תירוש 36, קומה 1 דירה 6, רעננה')
  })

  it('carries the entry code, preferences, delivery note and contact', () => {
    const [ev] = myMealTrainEvents([sampleTrain], 'me', { train1: priv })
    expect(ev.description).toContain('קוד לבניין: 1974')
    expect(ev.description).toContain('צמחוני ובריא')
    expect(ev.description).toContain('משאירים מחוץ לדלת')
    expect(ev.description).toContain('054-5923478')
  })

  it('says where to find the address when it could not be fetched', () => {
    const [ev] = myMealTrainEvents([sampleTrain], 'me')
    expect(ev.location).toBe('')
    expect(ev.description).toContain('סירי לידה')
  })

  it('does not leak one pot\'s address into another pot\'s entry', () => {
    const [ev] = myMealTrainEvents([sampleTrain], 'me', { otherTrain: priv })
    expect(ev.location).toBe('')
  })
})
