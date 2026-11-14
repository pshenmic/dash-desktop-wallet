import {describe, it, expect} from 'vitest'
import {isSafeExternalUrl} from '../../src/main/src/utils/safeExternalUrl'

describe('isSafeExternalUrl', () => {
  it('allows http and https', () => {
    expect(isSafeExternalUrl('https://example.com')).toBe(true)
    expect(isSafeExternalUrl('http://example.com/path')).toBe(true)
  })

  it('rejects file, javascript, custom schemes and malformed urls', () => {
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false)
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeExternalUrl('dash:payment')).toBe(false)
    expect(isSafeExternalUrl('not a url')).toBe(false)
    expect(isSafeExternalUrl('')).toBe(false)
  })
})