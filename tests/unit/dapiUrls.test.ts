import {describe, it, expect} from 'vitest'
import {resolveDapiUrls} from '../../src/main/src/utils/dapiUrls'

describe('resolveDapiUrls', () => {
  it('uses own urls in static mode when present', () => {
    expect(resolveDapiUrls('static', ['a'], null)).toEqual(['a'])
    expect(resolveDapiUrls('static', ['a'], ['p'])).toEqual(['a'])
  })

  it('falls through to pinned when static has no own urls', () => {
    expect(resolveDapiUrls('static', [], null)).toBeNull()
    expect(resolveDapiUrls('static', [], undefined)).toEqual([])
    expect(resolveDapiUrls('static', [], ['p'])).toEqual(['p'])
  })

  it('ignores own urls in dynamic mode', () => {
    expect(resolveDapiUrls('dynamic', ['a'], null)).toBeNull()
    expect(resolveDapiUrls('dynamic', ['a'], ['p'])).toEqual(['p'])
    expect(resolveDapiUrls('dynamic', [], undefined)).toEqual([])
  })
})