import { describe, it, expect } from 'vitest'
import { resolveAuthDomain, selfHostedAuthEnabled, usingSelfHostedAuth } from './authDomain'

const FIREBASE = 'sachaf-66ba1.firebaseapp.com'

describe('selfHostedAuthEnabled', () => {
  it('is off unless the flag is explicitly set', () => {
    expect(selfHostedAuthEnabled({})).toBe(false)
    expect(selfHostedAuthEnabled({ VITE_AUTH_SELF_HOSTED: '' })).toBe(false)
    expect(selfHostedAuthEnabled({ VITE_AUTH_SELF_HOSTED: '0' })).toBe(false)
    expect(selfHostedAuthEnabled({ VITE_AUTH_SELF_HOSTED: 'no' })).toBe(false)
  })

  it('accepts the two spellings a deploy env realistically carries', () => {
    expect(selfHostedAuthEnabled({ VITE_AUTH_SELF_HOSTED: '1' })).toBe(true)
    expect(selfHostedAuthEnabled({ VITE_AUTH_SELF_HOSTED: 'true' })).toBe(true)
    expect(selfHostedAuthEnabled({ VITE_AUTH_SELF_HOSTED: ' TRUE ' })).toBe(true)
  })
})

describe('resolveAuthDomain', () => {
  it('keeps the firebase handler while the switch is off', () => {
    expect(resolveAuthDomain({ hostname: 'shachaf.vercel.app', envAuthDomain: FIREBASE, selfHosted: false }))
      .toBe(FIREBASE)
  })

  it('serves the handler from our own host once the proxy is switched on', () => {
    expect(resolveAuthDomain({ hostname: 'shachaf.vercel.app', envAuthDomain: FIREBASE, selfHosted: true }))
      .toBe('shachaf.vercel.app')
  })

  it('never claims to self-host on localhost — nothing proxies there', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      expect(resolveAuthDomain({ hostname: host, envAuthDomain: FIREBASE, selfHosted: true })).toBe(FIREBASE)
    }
  })

  it('falls back to the env value when there is no hostname (SSR, tests)', () => {
    expect(resolveAuthDomain({ envAuthDomain: FIREBASE, selfHosted: true })).toBe(FIREBASE)
  })
})

describe('usingSelfHostedAuth', () => {
  it('is true only when the handler really is on this host', () => {
    expect(usingSelfHostedAuth({ hostname: 'shachaf.vercel.app', envAuthDomain: FIREBASE, selfHosted: true })).toBe(true)
    expect(usingSelfHostedAuth({ hostname: 'shachaf.vercel.app', envAuthDomain: FIREBASE, selfHosted: false })).toBe(false)
    expect(usingSelfHostedAuth({ hostname: 'localhost', envAuthDomain: FIREBASE, selfHosted: true })).toBe(false)
    expect(usingSelfHostedAuth({ envAuthDomain: FIREBASE, selfHosted: true })).toBe(false)
  })
})
