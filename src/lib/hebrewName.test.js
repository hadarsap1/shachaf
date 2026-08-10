import { describe, it, expect } from 'vitest'
import { isHebrewName, hebrewNameError, normalizeName, HEBREW_NAME_ERROR } from './hebrewName'

describe('isHebrewName', () => {
  it('accepts ordinary Hebrew names', () => {
    for (const name of ['דוד', 'דוד כהן', 'שרה לוי-מזרחי', 'אבי בן גוריון']) {
      expect(isHebrewName(name), name).toBe(true)
    }
  })

  it('accepts the punctuation real names contain', () => {
    for (const name of ["ג'ורג' לוי", 'בן-ציון', 'שרה׳לה', 'חיים בן־דוד']) {
      expect(isHebrewName(name), name).toBe(true)
    }
  })

  it('accepts both hyphens a Hebrew keyboard produces', () => {
    expect(isHebrewName('בן-גוריון')).toBe(true)   // ASCII hyphen
    expect(isHebrewName('בן־גוריון')).toBe(true)   // maqaf U+05BE
  })

  it('accepts final letters', () => {
    expect(isHebrewName('יוסף כץ')).toBe(true)
    expect(isHebrewName('נחום ברקן')).toBe(true)
  })

  it('rejects Latin names — the case this rule exists for', () => {
    for (const name of ['David Cohen', 'david', 'Sarah']) {
      expect(isHebrewName(name), name).toBe(false)
    }
  })

  it('rejects a mix of Hebrew and Latin', () => {
    expect(isHebrewName('דוד Cohen')).toBe(false)
    expect(isHebrewName('David כהן')).toBe(false)
  })

  it('rejects digits and emoji', () => {
    expect(isHebrewName('דוד 2')).toBe(false)
    expect(isHebrewName('דוד 😀')).toBe(false)
  })

  it('rejects a name that is only punctuation', () => {
    expect(isHebrewName('---')).toBe(false)
    expect(isHebrewName("'")).toBe(false)
  })

  it('rejects empty and whitespace-only input', () => {
    expect(isHebrewName('')).toBe(false)
    expect(isHebrewName('   ')).toBe(false)
    expect(isHebrewName(null)).toBe(false)
    expect(isHebrewName(undefined)).toBe(false)
  })

  it('rejects a name past the length cap', () => {
    expect(isHebrewName('א'.repeat(100))).toBe(true)
    expect(isHebrewName('א'.repeat(101))).toBe(false)
  })

  it('ignores surrounding and repeated whitespace', () => {
    expect(isHebrewName('  דוד   כהן  ')).toBe(true)
  })
})

describe('normalizeName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeName('  דוד   כהן  ')).toBe('דוד כהן')
  })

  it('survives null and undefined', () => {
    expect(normalizeName(null)).toBe('')
    expect(normalizeName(undefined)).toBe('')
  })
})

describe('hebrewNameError', () => {
  it('is null for a valid name', () => {
    expect(hebrewNameError('דוד כהן')).toBeNull()
  })

  it('asks for a name when the field is empty', () => {
    expect(hebrewNameError('  ')).toBe('נא להזין שם')
  })

  it('explains the Hebrew requirement for a Latin name', () => {
    expect(hebrewNameError('David')).toBe(HEBREW_NAME_ERROR)
  })

  it('calls out an over-long name separately', () => {
    expect(hebrewNameError('א'.repeat(101))).toMatch(/ארוך מדי/)
  })
})
