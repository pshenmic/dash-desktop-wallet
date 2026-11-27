import { describe, expect, it } from 'vitest'
import { DestinationKind } from '../../src/renderer/src/enums/DestinationKind'
import type { OwnRecipientInventory } from '../../src/renderer/src/types/SendRecipients'
import {
  availableOwnRecipientOptions,
  matchingOwnOptions,
  ownRecipientOptions,
  recipientAddressBadge,
  walletAddressLabels,
} from '../../src/renderer/src/utils/ownRecipients'

function inventory(): OwnRecipientInventory {
  const address = {walletId: 'wallet', accountId: 0, derivationPath: '', index: 0, isUsed: false, isLocked: false, balance: 0n, txCount: 0, label: null, usdBalance: null}
  return {
    receiving: [
      { ...address, address: 'receive-empty', isChange: 0, label: 'Savings' },
      { ...address, address: 'receive-funded', isChange: 0, balance: 10n, txCount: 3 },
      { ...address, address: 'receive-spent', isChange: 0, txCount: 4 },
      { ...address, address: 'receive-used', isChange: 0, isUsed: true },
      { ...address, address: 'receive-funded-no-history', isChange: 0, balance: 1n },
    ],
    change: [{ ...address, address: 'change-empty', isChange: 1 }],
    platformAddresses: [
      { platformAddress: 'platform-empty', balanceCredits: 0n, nonce: 0 },
      { platformAddress: 'platform-funded', balanceCredits: 20n, nonce: 1 },
      { platformAddress: 'platform-spent', balanceCredits: 0n, nonce: 2 },
      { platformAddress: 'platform-funded-no-nonce', balanceCredits: 1n, nonce: 0 },
    ],
    shieldedAddresses: ['shielded-saved'],
    shieldedNotes: [],
    identities: [{ identityIndex: 0, identifier: 'identity-empty', usernames: ['Personal'], keys: [], balance: { amount: 0n, usdAmount: '0' }, derivationPath: '', assetLockTxid: null }],
  }
}

describe('own recipient options', () => {
  it('only includes unused empty receiving and change addresses unless labeled, and attaches label badges', () => {
    expect(ownRecipientOptions(DestinationKind.CoreAddress, inventory())).toEqual([
      { value: 'receive-empty', label: 'receive-empty', badge: 'Savings', description: 'Your receiving address', metadata: ['0 Dash', 'Tx count: 0'] },
      { value: 'change-empty', label: 'change-empty', description: 'Your change address', metadata: ['0 Dash', 'Tx count: 0'] },
    ])
  })

  it('includes Core, Platform, and Shielded Receive addresses saved with a label even when marked used or before shielded sync', () => {
    const recipients = inventory()
    recipients.labelsByAddress = new Map([
      ['receive-used', 'Salary'],
      ['platform-funded', 'Treasury'],
      ['shielded-request-only', 'Vault'],
    ])
    recipients.receiveRequests = [
      { address: 'receive-used', label: 'Salary', kind: 'core' },
      { address: 'platform-funded', label: 'Treasury', kind: 'platform' },
      { address: 'shielded-request-only', label: 'Vault', kind: 'shielded' },
    ]

    const coreOptions = ownRecipientOptions(DestinationKind.CoreAddress, recipients)
    expect(coreOptions).toContainEqual({
      value: 'receive-used',
      label: 'receive-used',
      badge: 'Salary',
      description: 'Your receiving address',
      metadata: ['0 Dash', 'Tx count: 0'],
    })

    const platformOptions = ownRecipientOptions(DestinationKind.PlatformAddress, recipients)
    expect(platformOptions).toEqual([
      { value: 'platform-empty', label: 'platform-empty', metadata: ['0 Dash', 'Nonce: 0'] },
      { value: 'platform-funded', label: 'platform-funded', badge: 'Treasury', metadata: ['0.0000000002 Dash', 'Nonce: 1'] },
    ])

    recipients.shieldedNotes = null
    expect(ownRecipientOptions(DestinationKind.Shielded, recipients)).toEqual([
      { value: 'shielded-request-only', label: 'shielded-request-only', badge: 'Vault' },
    ])
  })

  it('only includes empty Platform addresses with zero nonce when unlabeled', () => {
    expect(ownRecipientOptions(DestinationKind.PlatformAddress, inventory())).toEqual([
      { value: 'platform-empty', label: 'platform-empty', metadata: ['0 Dash', 'Nonce: 0'] },
    ])
  })

  it('keeps identity usernames, searchable terms, and balances without inventing a transaction count or nonce', () => {
    const recipients = inventory()
    recipients.identities[0].balance.amount = 100_000_000_001n
    expect(ownRecipientOptions(DestinationKind.Identity, recipients)).toEqual([
      {
        value: 'identity-empty',
        label: 'identity-empty',
        description: 'Personal',
        searchTerms: ['Personal'],
        metadata: ['1.00000000001 Dash'],
      },
    ])
  })

  it('only includes unlabeled Shielded addresses without any received notes, including spent notes', () => {
    const recipients = inventory()
    recipients.shieldedAddresses.push('shielded-funded', 'shielded-spent')
    recipients.shieldedNotes = [
      { index: 0, address: 'shielded-funded', amount: 50n, spent: false },
      { index: 1, address: 'shielded-spent', amount: 50n, spent: true },
    ]
    expect(ownRecipientOptions(DestinationKind.Shielded, recipients).map(option => option.value)).toEqual(['shielded-saved'])
    expect(ownRecipientOptions(DestinationKind.Shielded, recipients)[0].metadata).toEqual(['0 Dash'])
    recipients.shieldedNotes = null
    expect(ownRecipientOptions(DestinationKind.Shielded, recipients)).toEqual([])
  })

  it.each([
    [DestinationKind.PlatformAddress, ['platform-empty']],
    [DestinationKind.Shielded, ['shielded-saved']],
    [DestinationKind.Identity, ['identity-empty']],
    [DestinationKind.NewIdentity, []],
  ])('only offers the selected destination type %s, including zero balances', (kind, values) => {
    expect(ownRecipientOptions(kind, inventory()).map(option => option.value)).toEqual(values)
  })

  it('deduplicates persisted addresses and handles wallets without any revealed addresses', () => {
    const addresses = inventory()
    addresses.shieldedAddresses.push('shielded-saved')
    expect(ownRecipientOptions(DestinationKind.Shielded, addresses)).toHaveLength(1)
    addresses.shieldedAddresses = []
    expect(ownRecipientOptions(DestinationKind.Shielded, addresses)).toEqual([])
  })

  it('excludes own addresses already selected in other recipient rows while keeping the current row selection', () => {
    const options = [
      { value: 'addr-1', label: 'addr-1' },
      { value: 'addr-2', label: 'addr-2' },
      { value: 'addr-3', label: 'addr-3' },
    ]
    const recipients = [
      { id: 'r1', address: ' addr-1 ', amount: '1' },
      { id: 'r2', address: '', amount: '2' },
    ]
    expect(availableOwnRecipientOptions(options, recipients, 'r1')?.map(option => option.value)).toEqual(['addr-1', 'addr-2', 'addr-3'])
    expect(availableOwnRecipientOptions(options, recipients, 'r2')?.map(option => option.value)).toEqual(['addr-2', 'addr-3'])
    expect(availableOwnRecipientOptions(undefined, recipients, 'r1')).toBeUndefined()
  })

  it('combines Receive request labels with Core address labels and matches options by label, address, or search terms from 3 characters', () => {
    const data = inventory()
    const labels = walletAddressLabels(
      [{ address: 'receive-used', label: '  Main Savings  ' }],
      data.receiving,
      data.change,
    )
    expect(labels.get('receive-used')).toBe('Main Savings')
    expect(labels.get('receive-empty')).toBe('Savings')

    const options = [
      { value: 'yAddr111', label: 'yAddr111', badge: 'Main Savings', description: 'Your receiving address' },
      { value: 'yAddr222', label: 'yAddr222', badge: 'Payroll', description: 'Your change address' },
      { value: 'id-alice', label: 'id-alice', description: 'alice.dash', searchTerms: ['alice.dash'] },
    ]
    expect(matchingOwnOptions(options, 'sa')).toEqual([])
    expect(matchingOwnOptions(options, 'sav').map(o => o.value)).toEqual(['yAddr111'])
    expect(matchingOwnOptions(options, 'PAY').map(o => o.value)).toEqual(['yAddr222'])
    expect(matchingOwnOptions(options, 'ddr222').map(o => o.value)).toEqual(['yAddr222'])
    expect(matchingOwnOptions(options, 'alice').map(o => o.value)).toEqual(['id-alice'])
    expect(matchingOwnOptions(options, 'receiving')).toEqual([])
    expect(matchingOwnOptions(options, 'yAddr111')).toEqual([])
    expect(matchingOwnOptions(options, '   ')).toEqual([])
  })

  it('prefers wallet address labels over contact labels for recipient badges', () => {
    const walletLabels = new Map([['yBoth', 'Wallet Label']])
    const contacts = [
      { address: 'yBoth', label: 'Contact Alias' },
      { address: 'yContactOnly', label: 'Bob' },
    ]
    expect(recipientAddressBadge(' yBoth ', walletLabels, contacts)).toBe('Wallet Label')
    expect(recipientAddressBadge('yContactOnly', walletLabels, contacts)).toBe('Bob')
    expect(recipientAddressBadge('yUnknown', walletLabels, contacts)).toBeUndefined()
    expect(recipientAddressBadge('  ', walletLabels, contacts)).toBeUndefined()
  })
})
