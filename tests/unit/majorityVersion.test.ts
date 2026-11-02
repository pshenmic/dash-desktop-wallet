import {describe, it, expect} from 'vitest'
import {majorityVersion} from '../../src/main/src/utils/majorityVersion'

describe('majorityVersion', () => {
  it('keeps the old version while most nodes still run it', () => {
    expect(majorityVersion(new Map([[13, ['a', 'b']], [14, ['c']]]))).toBe(13)
  })

  it('moves on once most nodes did', () => {
    expect(majorityVersion(new Map([[13, ['a']], [14, ['b', 'c']]]))).toBe(14)
  })

  it('answers null for no reachable node', () => {
    expect(majorityVersion(new Map())).toBeNull()
  })
})
