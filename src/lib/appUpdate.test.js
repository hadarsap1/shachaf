import { describe, it, expect, vi, afterEach } from 'vitest'
import { startUpdateWatch, UPDATE_CHECK_INTERVAL_MS, FOREGROUND_THROTTLE_MS } from './appUpdate'

afterEach(() => vi.useRealTimers())

// A minimal stand-in for document/window so this runs without a DOM.
function fakeHost() {
  const handlers = {}
  return {
    hidden: false,
    addEventListener: (ev, fn) => { (handlers[ev] ||= []).push(fn) },
    removeEventListener: (ev, fn) => { handlers[ev] = (handlers[ev] || []).filter(f => f !== fn) },
    fire: (ev) => (handlers[ev] || []).forEach(f => f()),
    count: (ev) => (handlers[ev] || []).length,
  }
}

describe('startUpdateWatch', () => {
  it('checks immediately, so a cold start never runs stale code for long', () => {
    const update = vi.fn().mockResolvedValue()
    startUpdateWatch({ update }, { doc: fakeHost(), win: fakeHost() })
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('checks again when the app returns to the foreground', () => {
    const update = vi.fn().mockResolvedValue()
    const doc = fakeHost(); const win = fakeHost()
    let t = 0
    startUpdateWatch({ update }, { doc, win, now: () => t })
    t += FOREGROUND_THROTTLE_MS + 1
    doc.fire('visibilitychange')
    expect(update).toHaveBeenCalledTimes(2)
    t += FOREGROUND_THROTTLE_MS + 1
    win.fire('focus')
    expect(update).toHaveBeenCalledTimes(3)
  })

  it('ignores a foreground event while the app is hidden', () => {
    const update = vi.fn().mockResolvedValue()
    const doc = fakeHost(); doc.hidden = true
    let t = 0
    startUpdateWatch({ update }, { doc, win: fakeHost(), now: () => t })
    t += FOREGROUND_THROTTLE_MS + 1
    doc.fire('visibilitychange')
    expect(update).toHaveBeenCalledTimes(1)   // only the initial check
  })

  it('throttles rapid tab flipping into a single check', () => {
    const update = vi.fn().mockResolvedValue()
    const doc = fakeHost()
    startUpdateWatch({ update }, { doc, win: fakeHost(), now: () => 1000 })
    doc.fire('visibilitychange'); doc.fire('visibilitychange'); doc.fire('visibilitychange')
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('keeps checking on a timer for an app left open for days', () => {
    vi.useFakeTimers()
    const update = vi.fn().mockResolvedValue()
    let t = 0
    startUpdateWatch({ update }, { doc: fakeHost(), win: fakeHost(), now: () => t })
    for (let i = 1; i <= 3; i++) {
      t += UPDATE_CHECK_INTERVAL_MS
      vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS)
    }
    expect(update).toHaveBeenCalledTimes(4)   // initial + 3 intervals
  })

  it('survives a registration whose update rejects', () => {
    const update = vi.fn().mockRejectedValue(new Error('offline'))
    expect(() => startUpdateWatch({ update }, { doc: fakeHost(), win: fakeHost() })).not.toThrow()
  })

  it('is a no-op without a registration, and stops cleanly', () => {
    expect(startUpdateWatch(null)).toBeInstanceOf(Function)
    const doc = fakeHost(); const win = fakeHost()
    const stop = startUpdateWatch({ update: vi.fn().mockResolvedValue() }, { doc, win })
    expect(doc.count('visibilitychange')).toBe(1)
    stop()
    expect(doc.count('visibilitychange')).toBe(0)
    expect(win.count('focus')).toBe(0)
  })
})
