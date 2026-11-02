import {describe, it, expect} from 'vitest'
import {majorityVersionNodes} from '../../src/main/src/utils/majorityVersionNodes'

describe('majorityVersionNodes', () => {
  it('keeps the old version while most nodes still run it', () => {
    expect(majorityVersionNodes(new Map([[13, ['a', 'b']], [14, ['c']]]))).toEqual(['a', 'b'])
  })

  it('drops the stragglers once most nodes moved on', () => {
    expect(majorityVersionNodes(new Map([[13, ['a']], [14, ['b', 'c']]]))).toEqual(['b', 'c'])
  })

  it('answers no nodes for no reachable node', () => {
    expect(majorityVersionNodes(new Map())).toEqual([])
  })
})
