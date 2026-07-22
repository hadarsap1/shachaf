import { describe, it, expect } from 'vitest'
import { GRADES, GRADE_SEP, gradeList, isKindergarten, classLabel } from './grades'

describe('gradeList', () => {
  it('splits a multi-grade string back to its parts', () => {
    expect(gradeList('גן חובה' + GRADE_SEP + 'גן ט״ח')).toEqual(['גן חובה', 'גן ט״ח'])
  })
  it('handles a single grade and empty values', () => {
    expect(gradeList('א')).toEqual(['א'])
    expect(gradeList('')).toEqual([])
    expect(gradeList(undefined)).toEqual([])
  })
  it('round-trips a selection joined in GRADES order', () => {
    const picked = ['גן ט״ח', 'גן חובה']
    const stored = GRADES.filter(g => picked.includes(g)).join(GRADE_SEP)
    expect(stored).toBe('גן ט״ח / גן חובה')
    expect(gradeList(stored)).toEqual(['גן ט״ח', 'גן חובה'])
  })
})

describe('classLabel', () => {
  it('prefixes regular classes with כיתה', () => {
    expect(classLabel('א1')).toBe('כיתה א1')
    expect(classLabel('ג')).toBe('כיתה ג')
  })
  it('leaves kindergartens without the כיתה prefix', () => {
    expect(classLabel('גן שחף')).toBe('גן שחף')
    expect(classLabel('גן חובה / גן ט״ח')).toBe('גן חובה / גן ט״ח')
  })
  it('labels a class with a garden GRADE as גן even when the name lacks it', () => {
    expect(classLabel('חופית', 'גן חובה')).toBe('גן חופית')
    expect(classLabel('חופית', 'גן חובה / גן ט״ח')).toBe('גן חופית')
    expect(classLabel('א1', 'א')).toBe('כיתה א1')
    expect(classLabel('גן שחף', 'גן חובה')).toBe('גן שחף')
  })
  it('returns empty string for missing input', () => {
    expect(classLabel('')).toBe('')
    expect(classLabel(undefined)).toBe('')
  })
  it('isKindergarten detects גן values only', () => {
    expect(isKindergarten('גן חובה')).toBe(true)
    expect(isKindergarten('א')).toBe(false)
  })
})
