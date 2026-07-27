import { describe, it, expect } from 'vitest'
import { normalizeSheetResult, dropEmptyRows } from './spreadsheet'

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
