import { describe, it, expect, vi } from 'vitest'
import { clearAppCaches } from './hardReload'

const swWith = (regs) => ({ serviceWorker: { getRegistrations: () => Promise.resolve(regs) } })

describe('clearAppCaches', () => {
  it('unregisters every service worker and deletes every cache', async () => {
    const unregister = vi.fn().mockResolvedValue(true)
    const del = vi.fn().mockResolvedValue(true)
    const res = await clearAppCaches(swWith([{ unregister }, { unregister }]), {
      keys: () => Promise.resolve(['a', 'b', 'c']), delete: del,
    })
    expect(unregister).toHaveBeenCalledTimes(2)
    expect(del.mock.calls.map(c => c[0])).toEqual(['a', 'b', 'c'])
    expect(res).toEqual({ serviceWorkers: 2, caches: 3 })
  })

  // Whatever breaks, the caller still has to be able to reload — this must
  // never throw, or the escape hatch itself becomes a dead end.
  it('survives a browser with no service worker or cache support', async () => {
    await expect(clearAppCaches({}, null)).resolves.toEqual({ serviceWorkers: 0, caches: 0 })
  })

  it('survives an unregister that rejects', async () => {
    const res = await clearAppCaches(
      swWith([{ unregister: () => Promise.reject(new Error('nope')) }]),
      { keys: () => Promise.resolve(['x']), delete: vi.fn().mockResolvedValue(true) },
    )
    expect(res.caches).toBe(1)
  })

  it('survives a cache store that rejects', async () => {
    const res = await clearAppCaches(swWith([]), { keys: () => Promise.reject(new Error('nope')) })
    expect(res).toEqual({ serviceWorkers: 0, caches: 0 })
  })
})
