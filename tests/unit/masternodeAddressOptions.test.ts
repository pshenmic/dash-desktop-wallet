import { describe, expect, it } from 'vitest'
import type { WalletAddressDto } from '@renderer/api/types'
import {
  MASTERNODE_CHANGE_ADDRESS_DESCRIPTION,
  MASTERNODE_RECEIVING_ADDRESS_DESCRIPTION,
} from '@renderer/constants/masternodeAddresses'
import { masternodeWalletAddressOptions } from '@renderer/utils/masternodeAddressOptions'
import { matchingOptionsByLabel, walletAddressLabels } from '@renderer/utils/ownRecipients'

function makeAddress(overrides: Partial<WalletAddressDto> = {}): WalletAddressDto {
  return {
    walletId: 'w1',
    accountId: 0,
    address: 'yDefaultAddr',
    derivationPath: "m/44'/1'/0'/0/0",
    index: 0,
    balance: 100_000_000n,
    isChange: 0,
    txCount: 0,
    isUsed: false,
    isLocked: false,
    label: null,
    usdBalance: null,
    ...overrides,
  }
}

describe('masternodeWalletAddressOptions', () => {
  it('matches Send page own Core address suggestions without exposing derivation paths', () => {
    const receiving: WalletAddressDto[] = [
      makeAddress({ address: 'yUsedLabeled', isUsed: true, txCount: 4, balance: 500_000_000n, label: 'Fallback label' }),
      makeAddress({ address: 'yUsedUnlabeled', isUsed: true, txCount: 2, balance: 0n, derivationPath: "m/44'/1'/0'/0/1" }),
      makeAddress({ address: 'yUnusedUnlabeled', balance: 0n, derivationPath: "m/44'/1'/0'/0/2" }),
      makeAddress({ address: 'yUnusedWithAddressLabel', label: 'Operator pool', derivationPath: "m/44'/1'/0'/0/3" }),
    ]
    const change: WalletAddressDto[] = [
      makeAddress({ address: 'yChangeLabeled', isChange: 1, label: 'Change Vault' }),
      makeAddress({ address: 'yChangeUnlabeledEmpty', isChange: 1, balance: 0n }),
      makeAddress({ address: 'yChangeUsedUnlabeled', isChange: 1, isUsed: true, txCount: 1, balance: 0n }),
    ]
    const requests = [
      { address: 'yUsedLabeled', label: 'Primary payout', kind: 'core' as const },
      { address: 'yRequestOnlyCore', label: 'Cold storage payout', kind: 'core' as const },
      { address: '0xPlatformAddr', label: 'Ignore platform', kind: 'platform' as const },
    ]

    const labels = walletAddressLabels(requests, receiving, change)
    const options = masternodeWalletAddressOptions(receiving, change, requests, labels)

    expect(options).toEqual([
      {
        value: 'yUsedLabeled',
        label: 'yUsedLabeled',
        badge: 'Primary payout',
        description: MASTERNODE_RECEIVING_ADDRESS_DESCRIPTION,
        metadata: ['5 Dash', 'Tx count: 4'],
      },
      {
        value: 'yUnusedUnlabeled',
        label: 'yUnusedUnlabeled',
        description: MASTERNODE_RECEIVING_ADDRESS_DESCRIPTION,
        metadata: ['0 Dash', 'Tx count: 0'],
      },
      {
        value: 'yUnusedWithAddressLabel',
        label: 'yUnusedWithAddressLabel',
        badge: 'Operator pool',
        description: MASTERNODE_RECEIVING_ADDRESS_DESCRIPTION,
        metadata: ['1 Dash', 'Tx count: 0'],
      },
      {
        value: 'yChangeLabeled',
        label: 'yChangeLabeled',
        badge: 'Change Vault',
        description: MASTERNODE_CHANGE_ADDRESS_DESCRIPTION,
        metadata: ['1 Dash', 'Tx count: 0'],
      },
      {
        value: 'yChangeUnlabeledEmpty',
        label: 'yChangeUnlabeledEmpty',
        description: MASTERNODE_CHANGE_ADDRESS_DESCRIPTION,
        metadata: ['0 Dash', 'Tx count: 0'],
      },
      {
        value: 'yRequestOnlyCore',
        label: 'yRequestOnlyCore',
        badge: 'Cold storage payout',
        description: MASTERNODE_RECEIVING_ADDRESS_DESCRIPTION,
      },
    ])

    expect(options.some(option => option.description?.includes("m/44'"))).toBe(false)
    expect(matchingOptionsByLabel(options, 'primary').map(opt => opt.value)).toEqual(['yUsedLabeled'])
    expect(matchingOptionsByLabel(options, 'vault').map(opt => opt.value)).toEqual(['yChangeLabeled'])
    expect(matchingOptionsByLabel(options, 'cold').map(opt => opt.value)).toEqual(['yRequestOnlyCore'])
  })

  it('deduplicates duplicate addresses while preserving first occurrence', () => {
    const receiving = [
      makeAddress({ address: 'yDup', balance: 0n, txCount: 0 }),
      makeAddress({ address: 'yDup', label: 'Duplicate label', txCount: 3 }),
    ]
    const labels = walletAddressLabels([], receiving, [])
    const options = masternodeWalletAddressOptions(receiving, [], [], labels)
    expect(options).toHaveLength(1)
    expect(options[0]?.description).toBe(MASTERNODE_RECEIVING_ADDRESS_DESCRIPTION)
    expect(options[0]?.metadata).toEqual(['0 Dash', 'Tx count: 0'])
  })
})
