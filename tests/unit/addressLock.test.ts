import { describe, expect, it } from 'vitest'
import type { WalletAddressDto } from '@renderer/api/types'
import { lockedAddressSet, resolveActiveReceiveCoreAddress } from '@renderer/utils/addressLock'

function coreAddress(address: string, overrides: Partial<WalletAddressDto> = {}): WalletAddressDto {
  return {
    walletId: 'wallet-1',
    accountId: 0,
    address,
    derivationPath: "m/44'/1'/0'/0/0",
    index: 0,
    isChange: 0,
    isUsed: false,
    isLocked: false,
    balance: 0n,
    txCount: 0,
    label: null,
    usdBalance: null,
    ...overrides,
  }
}

describe('addressLock', () => {
  it('tracks locked addresses in a Set', () => {
    const locked = lockedAddressSet([
      coreAddress('yA', { isLocked: true }),
      coreAddress('yB', { isLocked: false }),
      coreAddress('yC', { isLocked: true }),
    ])
    expect(locked).toEqual(new Set(['yA', 'yC']))
  })

  it('skips locked default, derived, and claimed addresses when choosing an active Receive address', () => {
    const a1 = coreAddress('y1', { isLocked: true })
    const a2 = coreAddress('y2', { isLocked: false })
    const a3 = coreAddress('y3', { isLocked: false })

    expect(
      resolveActiveReceiveCoreAddress({
        addresses: [a1, a2, a3],
        claimed: new Set(['y2']),
        defaultAddress: 'y1',
        derivedAddress: 'y1',
      }),
    ).toBe('y3')

    expect(
      resolveActiveReceiveCoreAddress({
        addresses: [a1],
        claimed: new Set(),
        defaultAddress: 'y1',
        derivedAddress: null,
      }),
    ).toBeNull()

    expect(
      resolveActiveReceiveCoreAddress({
        addresses: [coreAddress('y1', { isLocked: true }), coreAddress('y2', { isUsed: true, txCount: 1 })],
        claimed: new Set(),
        defaultAddress: 'yFallback',
        derivedAddress: null,
      }),
    ).toBe('yFallback')
  })
})
