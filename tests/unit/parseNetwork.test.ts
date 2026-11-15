import {describe, it, expect} from 'vitest'
import {parseNetwork, parsePeerMode} from '../../src/main/src/utils/parseNetwork'

describe('parseNetwork', () => {
  it('returns a valid network', () => {
    expect(parseNetwork('getBalance', 'mainnet')).toBe('mainnet')
    expect(parseNetwork('getBalance', 'testnet')).toBe('testnet')
  })

  it('throws the channel-prefixed message for invalid input', () => {
    expect(() => parseNetwork('getBalance', 'regtest'))
      .toThrow(`getBalance: expected 'mainnet' or 'testnet', got "regtest"`)
    expect(() => parseNetwork('getBalance', undefined))
      .toThrow(`getBalance: expected 'mainnet' or 'testnet', got undefined`)
  })
})

describe('parsePeerMode', () => {
  it('returns a valid mode', () => {
    expect(parsePeerMode('setPeerMode', 'dynamic')).toBe('dynamic')
    expect(parsePeerMode('setPeerMode', 'static')).toBe('static')
  })

  it('throws the channel-prefixed message for invalid input', () => {
    expect(() => parsePeerMode('setPeerMode', 'both'))
      .toThrow(`setPeerMode: expected 'dynamic' or 'static', got "both"`)
  })
})