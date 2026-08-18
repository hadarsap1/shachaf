import { describe, it, expect, vi } from 'vitest'
import { withTimeout, isTimeout, PAGE_LOAD_TIMEOUT_MS } from './withTimeout'

describe('withTimeout', () => {
  it('passes a value straight through', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok')
  })

  it('passes a rejection straight through, unchanged', async () => {
    const err = Object.assign(new Error('denied'), { code: 'permission-denied' })
    await expect(withTimeout(Promise.reject(err), 50)).rejects.toBe(err)
  })

  it('rejects a promise that never settles — the actual hang', async () => {
    vi.useFakeTimers()
    const stuck = withTimeout(new Promise(() => {}), 1000)
    const assertion = expect(stuck).rejects.toMatchObject({ code: 'app/timeout' })
    await vi.advanceTimersByTimeAsync(1001)
    await assertion
    vi.useRealTimers()
  })

  it('does not fire once the promise has settled in time', async () => {
    vi.useFakeTimers()
    const settled = withTimeout(Promise.resolve('quick'), 1000)
    await expect(settled).resolves.toBe('quick')
    // If the timer had survived, this would raise an unhandled rejection
    await vi.advanceTimersByTimeAsync(5000)
    vi.useRealTimers()
  })
})

describe('isTimeout', () => {
  it('tells a stall apart from a real failure', () => {
    expect(isTimeout({ code: 'app/timeout' })).toBe(true)
    expect(isTimeout({ code: 'permission-denied' })).toBe(false)
    expect(isTimeout(null)).toBe(false)
  })
})

describe('PAGE_LOAD_TIMEOUT_MS', () => {
  it('is long enough for a slow phone, short enough to notice', () => {
    expect(PAGE_LOAD_TIMEOUT_MS).toBeGreaterThanOrEqual(10000)
    expect(PAGE_LOAD_TIMEOUT_MS).toBeLessThanOrEqual(20000)
  })
})
