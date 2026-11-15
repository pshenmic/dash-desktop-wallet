import {describe, it, expect} from 'vitest'
import {BoundedSet} from '../../src/main/p2p/utils/boundedSet'

describe('BoundedSet', () => {
  it('behaves as a set below the cap', () => {
    const set = new BoundedSet<string>(3)
    set.add('a')
    set.add('b')
    set.add('a')

    expect(set.size).toBe(2)
    expect(set.has('a')).toBe(true)
    expect(set.has('c')).toBe(false)
  })

  it('forgets wholesale when the cap is reached', () => {
    const set = new BoundedSet<number>(2)
    set.add(1)
    set.add(2)
    set.add(3)

    expect(set.has(1)).toBe(false)
    expect(set.has(2)).toBe(false)
    expect(set.has(3)).toBe(true)
    expect(set.size).toBe(1)
  })

  it('deletes and clears', () => {
    const set = new BoundedSet<number>(10)
    set.add(1)
    set.add(2)

    expect(set.delete(1)).toBe(true)
    expect(set.delete(1)).toBe(false)
    set.clear()
    expect(set.size).toBe(0)
  })
})
