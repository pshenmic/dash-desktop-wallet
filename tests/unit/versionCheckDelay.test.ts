import {describe, it, expect} from 'vitest'
import {inEpochStartWindow, versionCheckDelay} from '../../src/main/src/utils/versionCheckDelay'

const LAG = 10
const POLL = 1
const IDLE = 30
const START = 1000

describe('inEpochStartWindow', () => {
  it('opens at the scheduled start, never before it', () => {
    expect(inEpochStartWindow(999, START, LAG)).toBe(false)
    expect(inEpochStartWindow(1000, START, LAG)).toBe(true)
  })

  it('closes once the first block of the epoch is overdue', () => {
    expect(inEpochStartWindow(1010, START, LAG)).toBe(true)
    expect(inEpochStartWindow(1011, START, LAG)).toBe(false)
  })
})

describe('versionCheckDelay', () => {
  it('checks idly far from the epoch start', () => {
    expect(versionCheckDelay(0, START, LAG, POLL, IDLE)).toBe(IDLE)
  })

  it('wakes up at the scheduled start', () => {
    expect(versionCheckDelay(985, START, LAG, POLL, IDLE)).toBe(15)
  })

  it('polls while the first block of the epoch may still come', () => {
    expect(versionCheckDelay(1000, START, LAG, POLL, IDLE)).toBe(POLL)
    expect(versionCheckDelay(1010, START, LAG, POLL, IDLE)).toBe(POLL)
  })

  it('falls back to idle checks once that block is overdue', () => {
    expect(versionCheckDelay(1011, START, LAG, POLL, IDLE)).toBe(IDLE)
  })
})
