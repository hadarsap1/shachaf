import { describe, it, expect } from 'vitest'
import {
  BUDGET_KEY, MAX_AUTO_RELOADS, WINDOW_MS,
  recentReloads, canAutoReload, noteAutoReload, clearAutoReloads,
} from './reloadBudget'

const fakeStorage = (initial) => {
  const map = new Map(initial ? [[BUDGET_KEY, initial]] : [])
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  }
}

describe('canAutoReload', () => {
  it('allows a real recovery and refuses a loop', () => {
    const s = fakeStorage()
    let now = 1_000_000
    for (let i = 0; i < MAX_AUTO_RELOADS; i++) {
      expect(canAutoReload(s, now)).toBe(true)
      noteAutoReload(s, now)
      now += 1500          // a loop cycles in seconds
    }
    expect(canAutoReload(s, now)).toBe(false)
  })

  it('refills once the window has passed — a deploy next week is not this loop', () => {
    const s = fakeStorage()
    let now = 1_000_000
    for (let i = 0; i < MAX_AUTO_RELOADS; i++) { noteAutoReload(s, now); now += 1000 }
    expect(canAutoReload(s, now)).toBe(false)
    expect(canAutoReload(s, now + WINDOW_MS)).toBe(true)
  })

  it('refuses without storage rather than looping blind', () => {
    expect(canAutoReload(null, 1)).toBe(false)
    const throwing = { getItem: () => { throw new Error('blocked') }, setItem: () => {}, removeItem: () => {} }
    expect(recentReloads(throwing, 1)).toEqual([])
    expect(canAutoReload(throwing, 1)).toBe(true)   // unreadable == empty, and the count is what refuses
  })

  it('survives junk in storage', () => {
    expect(recentReloads(fakeStorage('not json'), 1)).toEqual([])
    expect(recentReloads(fakeStorage('{"a":1}'), 1)).toEqual([])
    expect(recentReloads(fakeStorage('[1,"x",null]'), 5)).toEqual([1])
  })

  it('ignores timestamps from the future — a clock change must not lock the app out', () => {
    const s = fakeStorage(JSON.stringify([9_000_000, 9_000_001, 9_000_002]))
    expect(canAutoReload(s, 1_000_000)).toBe(true)
  })
})

describe('clearAutoReloads', () => {
  it('hands the budget back when a person presses something', () => {
    const s = fakeStorage()
    let now = 1_000_000
    for (let i = 0; i < MAX_AUTO_RELOADS; i++) { noteAutoReload(s, now); now += 1000 }
    expect(canAutoReload(s, now)).toBe(false)
    clearAutoReloads(s)
    expect(canAutoReload(s, now)).toBe(true)
  })

  it('does not throw on a storage that refuses to write', () => {
    const throwing = { getItem: () => null, setItem: () => {}, removeItem: () => { throw new Error('blocked') } }
    expect(() => clearAutoReloads(throwing)).not.toThrow()
    expect(() => noteAutoReload(throwing, 1)).not.toThrow()
  })
})
