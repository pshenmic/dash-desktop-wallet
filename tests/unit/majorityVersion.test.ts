import {describe, it, expect} from 'vitest'
import {majorityVersion} from '../../src/main/src/utils/majorityVersion'

describe('majorityVersion', () => {
  it('keeps the old version while most nodes still run it', () => {
    expect(majorityVersion(new Map([[13, ['a', 'b']], [14, ['c']]]))).toEqual([13, ['a', 'b']])
  })

  it('moves on once most nodes did', () => {
    expect(majorityVersion(new Map([[13, ['a']], [14, ['b', 'c']]]))).toEqual([14, ['b', 'c']])
  })

  it('keeps the first of two equal groups', () => {
    expect(majorityVersion(new Map([[13, ['a']], [14, ['b']]]))).toEqual([13, ['a']])
  })

  it('answers nothing for no reachable node', () => {
    expect(majorityVersion(new Map())).toBeUndefined()
  })
})
