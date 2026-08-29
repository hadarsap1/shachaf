import { describe, it, expect, vi } from 'vitest'
import { isStaleBuildError, recoverFromStaleBuild } from './chunkRecovery'
import { BUDGET_KEY, MAX_AUTO_RELOADS, WINDOW_MS } from './reloadBudget'

const fakeStorage = () => {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  }
}

describe('isStaleBuildError', () => {
  it('recognises how each browser words a missing chunk', () => {
    // Chrome
    expect(isStaleBuildError(new Error('Failed to fetch dynamically imported module: https://x/assets/a-1.js'))).toBe(true)
    // Safari
    expect(isStaleBuildError(new Error('Importing a module script failed.'))).toBe(true)
    // Firefox
    expect(isStaleBuildError(new Error('error loading dynamically imported module'))).toBe(true)
    // webpack-era wording that still shows up in the wild
    expect(isStaleBuildError({ name: 'ChunkLoadError', message: 'Loading chunk 42 failed' })).toBe(true)
  })

  it('does not swallow ordinary application errors', () => {
    expect(isStaleBuildError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isStaleBuildError(new Error('permission-denied'))).toBe(false)
    expect(isStaleBuildError(null)).toBe(false)
  })
})

describe('recoverFromStaleBuild', () => {
  it('clears the caches and reloads — a plain refresh keeps the stale worker', async () => {
    const storage = fakeStorage()
    const clearCaches = vi.fn().mockResolvedValue()
    const reload = vi.fn()
    const took = await recoverFromStaleBuild({ storage, clearCaches, reload })
    expect(took).toBe(true)
    expect(clearCaches).toHaveBeenCalled()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads even if clearing the caches fails', async () => {
    const reload = vi.fn()
    await recoverFromStaleBuild({
      storage: fakeStorage(),
      clearCaches: () => Promise.reject(new Error('nope')),
      reload,
    })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('draws on the shared budget, so a broken build cannot become a loop', async () => {
    const storage = fakeStorage()
    const reload = vi.fn()
    let t = 1_000_000
    const now = () => (t += 1500)
    for (let i = 0; i < MAX_AUTO_RELOADS; i++) {
      expect(await recoverFromStaleBuild({ storage, now, clearCaches: vi.fn(), reload })).toBe(true)
    }
    expect(await recoverFromStaleBuild({ storage, now, clearCaches: vi.fn(), reload })).toBe(false)
    expect(reload).toHaveBeenCalledTimes(MAX_AUTO_RELOADS)
  })

  it('counts against the same budget the boot rescue and the worker takeover use', async () => {
    const storage = fakeStorage()
    // rescue.js writes this key directly — it runs before the bundle exists.
    storage.setItem(BUDGET_KEY, JSON.stringify(
      Array.from({ length: MAX_AUTO_RELOADS }, (_, i) => 1_000_000 + i)))
    const reload = vi.fn()
    expect(await recoverFromStaleBuild({ storage, now: () => 1_000_100, clearCaches: vi.fn(), reload })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
    // …and it recovers on its own once the window has passed.
    expect(await recoverFromStaleBuild({
      storage, now: () => 1_000_000 + WINDOW_MS + 1, clearCaches: vi.fn(), reload,
    })).toBe(true)
  })

  it('does nothing when storage is unavailable, rather than looping blind', async () => {
    const reload = vi.fn()
    expect(await recoverFromStaleBuild({ storage: null, clearCaches: vi.fn(), reload })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
