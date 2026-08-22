import { describe, it, expect, vi } from 'vitest'
import {
  isStaleBuildError, canRecover, markRecovered, recoverFromStaleBuild, RECOVERY_KEY,
} from './chunkRecovery'

const fakeStorage = () => {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
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

  it('refuses a second time in the same session — a loop hides a real break', async () => {
    const storage = fakeStorage()
    const reload = vi.fn()
    await recoverFromStaleBuild({ storage, clearCaches: vi.fn(), reload })
    const second = await recoverFromStaleBuild({ storage, clearCaches: vi.fn(), reload })
    expect(second).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does nothing when storage is unavailable, rather than looping blind', async () => {
    const reload = vi.fn()
    expect(await recoverFromStaleBuild({ storage: null, clearCaches: vi.fn(), reload })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('canRecover / markRecovered', () => {
  it('flips after the first recovery', () => {
    const storage = fakeStorage()
    expect(canRecover(storage)).toBe(true)
    markRecovered(storage)
    expect(canRecover(storage)).toBe(false)
    expect(storage.getItem(RECOVERY_KEY)).toBeTruthy()
  })

  it('survives a storage that throws (private mode)', () => {
    const throwing = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(canRecover(throwing)).toBe(false)
    expect(() => markRecovered(throwing)).not.toThrow()
  })
})
