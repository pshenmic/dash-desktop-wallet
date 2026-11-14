import {describe, it, expect} from 'vitest'
import {outpointKey} from '../../src/main/src/utils/outpointKey'

describe('outpointKey', () => {
  it('joins txid and vout with a colon', () => {
    expect(outpointKey('ab', 0)).toBe('ab:0')
    expect(outpointKey('ff'.repeat(32), 42)).toBe(`${'ff'.repeat(32)}:42`)
    expect(outpointKey(null, 0)).toBe('null:0')
    expect(outpointKey('ab', null)).toBe('ab:null')
  })
})