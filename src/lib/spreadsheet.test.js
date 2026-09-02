import { describe, it, expect } from 'vitest'
import {
  normalizeSheetResult, dropEmptyRows, stripBom, personKey, splitNewChildren,
} from './spreadsheet'

describe('normalizeSheetResult', () => {
  it('extracts rows from the read-excel-file v9 sheet-array shape', () => {
    // This is the shape that caused "rawRows[0].map is not a function"
    const v9 = [{ sheet: 'Sheet1', data: [['שם', 'כיתה'], ['דנה', 'א1']] }]
    expect(normalizeSheetResult(v9)).toEqual([['שם', 'כיתה'], ['דנה', 'א1']])
  })
  it('passes through the legacy rows-array shape unchanged', () => {
    const legacy = [['שם', 'כיתה'], ['דנה', 'א1']]
    expect(normalizeSheetResult(legacy)).toEqual(legacy)
  })
  it('picks the first NON-EMPTY sheet in a multi-sheet workbook', () => {
    const wb = [
      { sheet: 'ריק', data: [] },
      { sheet: 'נתונים', data: [['שם'], ['יובל']] },
    ]
    expect(normalizeSheetResult(wb)).toEqual([['שם'], ['יובל']])
  })
  it('returns [] for empty / non-array input', () => {
    expect(normalizeSheetResult([])).toEqual([])
    expect(normalizeSheetResult(null)).toEqual([])
    expect(normalizeSheetResult(undefined)).toEqual([])
    expect(normalizeSheetResult({ data: [['x']] })).toEqual([])
  })
  it('returns [] when a sheet object carries no rows at all', () => {
    expect(normalizeSheetResult([{ sheet: 'ריק', data: [] }])).toEqual([])
  })
})

describe('dropEmptyRows', () => {
  it('removes rows that are entirely blank or whitespace', () => {
    const rows = [['שם', 'כיתה'], ['', ''], ['דנה', 'א1'], [null, undefined], ['  ', '']]
    expect(dropEmptyRows(rows)).toEqual([['שם', 'כיתה'], ['דנה', 'א1']])
  })
  it('keeps rows with a value in any column', () => {
    expect(dropEmptyRows([['', 'א1']])).toEqual([['', 'א1']])
  })
  it('drops non-array entries defensively', () => {
    expect(dropEmptyRows([['ok'], 'junk', null])).toEqual([['ok']])
  })
})

describe('personKey', () => {
  it('folds hyphen spacing and geresh so the phone book matches the app', () => {
    expect(personKey('בר - און  אייזן')).toBe(personKey('בר-און אייזן'))
    expect(personKey("ג'וליה")).toBe(personKey('גוליה'))
  })
})

describe('splitNewChildren', () => {
  const rows = [
    { name: 'עומר ספיר ורדי', classId: 'a' },
    { name: 'דן בר - און', classId: 'e' },
    { name: 'שי ביטון', classId: 'a' },
  ]

  it('imports only the children not already on file', () => {
    const { toImport, duplicates } = splitNewChildren(rows, [{ id: '1', name: 'דן בר-און' }])
    expect(toImport.map(r => r.name)).toEqual(['עומר ספיר ורדי', 'שי ביטון'])
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0].existing.id).toBe('1')
  })

  it('collapses a name repeated inside the file itself', () => {
    const { toImport } = splitNewChildren([...rows, { name: 'שי ביטון', classId: 'a' }], [])
    expect(toImport).toHaveLength(3)
  })

  it('re-importing the same file adds nobody', () => {
    const existing = rows.map((r, i) => ({ id: String(i), name: r.name }))
    expect(splitNewChildren(rows, existing).toImport).toEqual([])
  })
})

describe('stripBom', () => {
  it('removes the BOM Excel prepends, so the first header still matches', () => {
    expect(stripBom('﻿כיתה,שם פרטי')).toBe('כיתה,שם פרטי')
    expect(stripBom('כיתה,שם פרטי')).toBe('כיתה,שם פרטי')
  })
})
