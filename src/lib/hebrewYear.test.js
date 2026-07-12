import { describe, it, expect } from 'vitest'
import { hebrewYearLabel, currentSchoolYearLabel } from './hebrewYear'

describe('hebrewYearLabel', () => {
  it('converts common years', () => {
    expect(hebrewYearLabel(5785)).toBe('תשפ״ה')
    expect(hebrewYearLabel(5787)).toBe('תשפ״ז')
    expect(hebrewYearLabel(5790)).toBe('תש״צ')
    expect(hebrewYearLabel(5800)).toBe('ת״ת')
  })

  it('handles the 15/16 special cases', () => {
    expect(hebrewYearLabel(5715)).toBe('תשט״ו')
    expect(hebrewYearLabel(5716)).toBe('תשט״ז')
  })
})

describe('currentSchoolYearLabel', () => {
  it('points at the upcoming year from July onward', () => {
    expect(currentSchoolYearLabel(new Date('2026-07-12'))).toBe('תשפ״ז')
    expect(currentSchoolYearLabel(new Date('2026-09-01'))).toBe('תשפ״ז')
  })

  it('keeps the running year during January–June', () => {
    expect(currentSchoolYearLabel(new Date('2027-03-01'))).toBe('תשפ״ז')
    expect(currentSchoolYearLabel(new Date('2026-05-01'))).toBe('תשפ״ו')
  })
})
