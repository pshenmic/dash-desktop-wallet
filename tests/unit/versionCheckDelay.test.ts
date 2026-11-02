import {describe, it, expect} from 'vitest'
import {versionCheckDelay} from '../../src/main/src/utils/versionCheckDelay'

const GAP = 10
const POLL = 1
const IDLE = 30
const BOUNDARY = 1000

describe('versionCheckDelay', () => {
  it('checks idly far from the boundary', () => {
    expect(versionCheckDelay(0, BOUNDARY, GAP, POLL, IDLE)).toBe(IDLE)
  })

  it('wakes up as the gap before the boundary opens', () => {
    expect(versionCheckDelay(975, BOUNDARY, GAP, POLL, IDLE)).toBe(15)
  })

  it('polls through the gap on both sides of the boundary', () => {
    expect(versionCheckDelay(990, BOUNDARY, GAP, POLL, IDLE)).toBe(POLL)
    expect(versionCheckDelay(1010, BOUNDARY, GAP, POLL, IDLE)).toBe(POLL)
  })

  it('falls back to idle checks once the gap after the boundary closes', () => {
    expect(versionCheckDelay(1011, BOUNDARY, GAP, POLL, IDLE)).toBe(IDLE)
  })
})
