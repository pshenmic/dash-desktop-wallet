import {describe, it, expect} from 'vitest'
import {headerFields} from '../../src/main/p2p/utils/pow'
import {HEADER_SIZE} from '../../src/main/p2p/constants'

const headerWith = (time: number, nBits: number): Uint8Array => {
  const raw = new Uint8Array(HEADER_SIZE)
  const view = new DataView(raw.buffer)
  view.setUint32(68, time, true)
  view.setUint32(72, nBits, true)
  return raw
}

describe('headerFields', () => {
  it('reads time and nBits in wire byte order', () => {
    expect(headerFields(headerWith(1_700_000_000, 0x1e0ffff0))).toEqual({time: 1_700_000_000, nBits: 0x1e0ffff0})
  })

  it('reads from a view offset into a larger buffer', () => {
    const backing = new Uint8Array(HEADER_SIZE + 10)
    const view = new DataView(backing.buffer)
    view.setUint32(5 + 68, 42, true)
    view.setUint32(5 + 72, 0x1d00ffff, true)
    const raw = backing.subarray(5, 5 + HEADER_SIZE)

    expect(headerFields(raw)).toEqual({time: 42, nBits: 0x1d00ffff})
  })

  it('rejects anything shorter than a header', () => {
    expect(headerFields(new Uint8Array(0))).toBeNull()
    expect(headerFields(new Uint8Array(HEADER_SIZE - 1))).toBeNull()
  })
})
