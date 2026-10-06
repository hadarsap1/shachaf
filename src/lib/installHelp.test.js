import { describe, it, expect } from 'vitest'
import { isIOSDevice, inAppBrowserName } from './installHelp'

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.0.0 Mobile/15E148 Safari/604.1'
const INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.0'
const FACEBOOK = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/500.0.0.0]'
const BARE_WEBVIEW = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'

describe('isIOSDevice', () => {
  it('recognises an iPhone', () => {
    expect(isIOSDevice(SAFARI, 5)).toBe(true)
  })
  it('recognises an iPad that reports itself as a Mac', () => {
    expect(isIOSDevice(IPAD, 5)).toBe(true)
  })
  it('does not take a real Mac for an iPad', () => {
    expect(isIOSDevice(IPAD, 0)).toBe(false)
  })
})

describe('inAppBrowserName', () => {
  it('is null in Safari and in Chrome for iOS', () => {
    expect(inAppBrowserName(SAFARI)).toBeNull()
    expect(inAppBrowserName(CHROME_IOS)).toBeNull()
  })
  it('names the app it can recognise', () => {
    expect(inAppBrowserName(INSTAGRAM)).toBe('אינסטגרם')
    expect(inAppBrowserName(FACEBOOK)).toBe('פייסבוק')
  })
  it('flags an unnamed embedded web view', () => {
    expect(inAppBrowserName(BARE_WEBVIEW)).toBe('')
  })
})
