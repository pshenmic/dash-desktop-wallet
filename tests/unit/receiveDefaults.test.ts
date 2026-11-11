import { describe, it, expect } from 'vitest'
import {
  addressLabelsByAddress,
  claimedReceiveAddresses,
  defaultReceiveCoreAddress,
  defaultReceiveShieldedAddress,
  defaultReceivePlatformAddress,
  isUnusedPlatformAddress,
  nextReceiveCoreAddress,
  nextReceivePlatformAddress,
  nextReceiveShieldedAddress,
  receiveCoreAddresses,
  receivePlatformAddresses,
  receiveShieldedAddresses,
} from '../../src/renderer/src/utils/receiveDefaults'
import type { WalletAddressDto } from '../../src/renderer/src/api/types'

const addr = (address: string, balance: bigint, isUsed = false, txCount = 0): WalletAddressDto =>
  ({ walletId: 'wallet', accountId: 0, address, derivationPath: '', index: 0, isChange: 0, isUsed, balance, txCount, label: null, usdBalance: null })

const platformAddr = (platformAddress: string, balanceCredits: bigint, nonce: number) =>
  ({ platformAddress, balanceCredits, nonce })

describe('isUnusedPlatformAddress', () => {
  it('is true for zero balance and zero nonce', () => {
    expect(isUnusedPlatformAddress(platformAddr('a', 0n, 0))).toBe(true)
  })

  it('is false when funded', () => {
    expect(isUnusedPlatformAddress(platformAddr('a', 100n, 0))).toBe(false)
  })

  it('is false when the nonce advanced even with zero balance', () => {
    expect(isUnusedPlatformAddress(platformAddr('a', 0n, 3))).toBe(false)
  })
})

describe('defaultReceivePlatformAddress', () => {
  it('picks the first unused address', () => {
    const list = [platformAddr('a', 500n, 2), platformAddr('b', 0n, 1), platformAddr('c', 0n, 0), platformAddr('d', 0n, 0)]
    expect(defaultReceivePlatformAddress(list)?.platformAddress).toBe('c')
  })

  it('does not return a zero-balance address with an advanced nonce', () => {
    const list = [platformAddr('a', 500n, 2), platformAddr('b', 0n, 3), platformAddr('c', 10n, 0)]
    expect(defaultReceivePlatformAddress(list)).toBeUndefined()
  })

  it('returns undefined when all addresses are funded', () => {
    const list = [platformAddr('a', 500n, 2), platformAddr('b', 10n, 0)]
    expect(defaultReceivePlatformAddress(list)).toBeUndefined()
  })

  it('returns undefined for an empty list', () => {
    expect(defaultReceivePlatformAddress([])).toBeUndefined()
  })
})

describe('receivePlatformAddresses', () => {
  it('excludes funded addresses and addresses with an advanced nonce', () => {
    const list = [platformAddr('a', 0n, 0), platformAddr('b', 10n, 0), platformAddr('c', 0n, 1)]
    expect(receivePlatformAddresses(list).map(address => address.platformAddress)).toEqual(['a'])
  })
})

describe('receiveCoreAddresses', () => {
  it('only includes fresh addresses, preserving their order', () => {
    const list = [
      addr('fresh', 0n),
      addr('funded', 100n),
      addr('used', 0n, true),
      addr('spent', 0n, false, 2),
      addr('next', 0n),
    ]
    expect(receiveCoreAddresses(list).map(address => address.address)).toEqual(['fresh', 'next'])
  })

  it('returns an empty list when no fresh addresses remain', () => {
    expect(receiveCoreAddresses([addr('funded', 100n), addr('used', 0n, true)])).toEqual([])
    expect(receiveCoreAddresses([])).toEqual([])
  })
})

describe('defaultReceiveCoreAddress', () => {
  it('picks the preferred address when it is fresh', () => {
    const list = [addr('a', 0n), addr('b', 0n)]
    expect(defaultReceiveCoreAddress(list, 'b')?.address).toBe('b')
  })

  it('ignores the preferred address when it is funded', () => {
    const list = [addr('a', 100n), addr('b', 0n)]
    expect(defaultReceiveCoreAddress(list, 'a')?.address).toBe('b')
  })

  it('picks the first fresh address without a preferred one', () => {
    const list = [addr('a', 100n), addr('spent', 0n, true, 2), addr('b', 0n), addr('c', 0n)]
    expect(defaultReceiveCoreAddress(list)?.address).toBe('b')
  })

  it('ignores a used preferred address even when its balance is zero', () => {
    const list = [addr('a', 0n, true), addr('b', 0n)]
    expect(defaultReceiveCoreAddress(list, 'a')?.address).toBe('b')
  })

  it('ignores a preferred address with transaction history even before its used flag is updated', () => {
    const list = [addr('a', 0n, false, 2), addr('b', 0n)]
    expect(defaultReceiveCoreAddress(list, 'a')?.address).toBe('b')
  })

  it('returns undefined when all addresses are funded', () => {
    const list = [addr('a', 100n), addr('b', 50n)]
    expect(defaultReceiveCoreAddress(list, 'x')).toBeUndefined()
  })

  it('returns undefined when all addresses have been used and emptied', () => {
    expect(defaultReceiveCoreAddress([addr('a', 0n, true), addr('b', 0n, false, 2)])).toBeUndefined()
  })

  it('falls back to the first fresh address when the preferred one is absent', () => {
    expect(defaultReceiveCoreAddress([addr('a', 0n), addr('b', 0n)], 'missing')?.address).toBe('a')
  })

  it('returns undefined for an empty list', () => {
    expect(defaultReceiveCoreAddress([])).toBeUndefined()
  })
})

describe('defaultReceiveShieldedAddress', () => {
  it('picks the first address without a balance', () => {
    const balances = new Map<string, bigint>([['a', 10n], ['b', 5n]])
    expect(defaultReceiveShieldedAddress(['a', 'b', 'c'], balances)).toBe('c')
  })

  it('treats a zero entry in the balance map as unfunded', () => {
    const balances = new Map<string, bigint>([['a', 10n], ['b', 0n]])
    expect(defaultReceiveShieldedAddress(['a', 'b'], balances)).toBe('b')
  })

  it('returns undefined when all addresses are funded', () => {
    const balances = new Map<string, bigint>([['a', 10n], ['b', 5n]])
    expect(defaultReceiveShieldedAddress(['a', 'b'], balances)).toBeUndefined()
  })

  it('picks the first address when the balance map is empty', () => {
    expect(defaultReceiveShieldedAddress(['a', 'b'], new Map())).toBe('a')
  })

  it('returns undefined for an empty list', () => {
    expect(defaultReceiveShieldedAddress([], new Map())).toBeUndefined()
  })
})

describe('receiveShieldedAddresses', () => {
  it('excludes addresses with a positive current balance', () => {
    const balances = new Map<string, bigint>([['a', 10n], ['b', 0n]])
    expect(receiveShieldedAddresses(['a', 'b', 'c'], balances)).toEqual(['b', 'c'])
  })
})

describe('nextReceiveCoreAddress', () => {
  it('picks the first unused core address that has not been claimed', () => {
    const list = [addr('a', 0n), addr('b', 0n), addr('c', 0n)]
    expect(nextReceiveCoreAddress(list, new Set(['a']))?.address).toBe('b')
  })

  it('honours the preferred address when it is unused and unclaimed', () => {
    const list = [addr('a', 0n), addr('b', 0n)]
    expect(nextReceiveCoreAddress(list, new Set(), 'b')?.address).toBe('b')
  })

  it('skips the preferred address when it is already claimed', () => {
    const list = [addr('a', 0n), addr('b', 0n)]
    expect(nextReceiveCoreAddress(list, new Set(['a']), 'a')?.address).toBe('b')
  })

  it('returns undefined when all unused core addresses are claimed', () => {
    const list = [addr('a', 0n), addr('b', 100n)]
    expect(nextReceiveCoreAddress(list, new Set(['a']))).toBeUndefined()
  })
})

describe('nextReceivePlatformAddress', () => {
  it('picks the first unused platform address that has not been claimed', () => {
    const list = [platformAddr('p1', 0n, 0), platformAddr('p2', 0n, 0)]
    expect(nextReceivePlatformAddress(list, new Set(['p1']))?.platformAddress).toBe('p2')
  })

  it('returns undefined when all unused platform addresses are claimed', () => {
    const list = [platformAddr('p1', 0n, 0), platformAddr('p2', 50n, 1)]
    expect(nextReceivePlatformAddress(list, new Set(['p1']))).toBeUndefined()
  })
})

describe('nextReceiveShieldedAddress', () => {
  it('picks the first unfunded shielded address that has not been claimed', () => {
    const balances = new Map<string, bigint>([['s1', 10n]])
    expect(nextReceiveShieldedAddress(['s1', 's2', 's3'], balances, new Set(['s2']))).toBe('s3')
  })

  it('returns undefined when all unfunded shielded addresses are claimed', () => {
    expect(nextReceiveShieldedAddress(['s1'], new Map(), new Set(['s1']))).toBeUndefined()
  })
})

describe('claimedReceiveAddresses and addressLabelsByAddress', () => {
  it('collects claimed addresses and keeps the first non-empty label per address', () => {
    const requests = [
      { address: 'addr-1', label: 'Latest Label' },
      { address: 'addr-1', label: 'Older Label' },
      { address: 'addr-2', label: '   ' },
      { address: 'addr-3', label: null },
      { address: 'addr-4', label: ' Payroll ' },
    ]
    expect([...claimedReceiveAddresses(requests)]).toEqual(['addr-1', 'addr-2', 'addr-3', 'addr-4'])
    const labels = addressLabelsByAddress(requests)
    expect(labels.get('addr-1')).toBe('Latest Label')
    expect(labels.has('addr-2')).toBe(false)
    expect(labels.has('addr-3')).toBe(false)
    expect(labels.get('addr-4')).toBe('Payroll')
  })
})
