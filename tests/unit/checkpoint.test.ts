import {describe, it, expect} from 'vitest'
import {checkpointAtOrBelow, nextCheckpointAbove} from '../../src/main/p2p/utils/checkpoint'
import {CF_CHECKPOINT_INTERVAL} from '../../src/main/p2p/constants'

describe('checkpoint heights', () => {
  it('lands on multiples of the interval', () => {
    expect(checkpointAtOrBelow(0)).toBe(0)
    expect(checkpointAtOrBelow(1)).toBe(0)
    expect(checkpointAtOrBelow(999)).toBe(0)
    expect(checkpointAtOrBelow(1000)).toBe(1000)
    expect(checkpointAtOrBelow(1001)).toBe(1000)
    expect(checkpointAtOrBelow(2500)).toBe(2000)
  })

  it('names the next boundary strictly above the height', () => {
    expect(nextCheckpointAbove(0)).toBe(CF_CHECKPOINT_INTERVAL)
    expect(nextCheckpointAbove(1)).toBe(CF_CHECKPOINT_INTERVAL)
    expect(nextCheckpointAbove(1000)).toBe(2000)
    expect(nextCheckpointAbove(1001)).toBe(2000)
  })

  it('brackets any height between two consecutive anchors', () => {
    for (const h of [1, 500, 1000, 1500, 123_456]) {
      const below = checkpointAtOrBelow(h)
      const above = nextCheckpointAbove(h)
      expect(below).toBeLessThanOrEqual(h)
      expect(above).toBeGreaterThan(h)
      expect(above - below).toBe(CF_CHECKPOINT_INTERVAL)
    }
  })
})
