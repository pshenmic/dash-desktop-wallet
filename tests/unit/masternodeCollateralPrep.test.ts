import { describe, expect, it } from 'vitest'
import type { WalletAddressDto } from '@renderer/api/types'
import type { FeeSelectableUtxo } from '@renderer/types/MasternodeRegistrationWizard'
import {
  autoSelectCollateralPrepUtxos,
  collateralTargetAddressOptions,
  defaultCollateralLabel,
  fallbackCollateralTargetAddress,
  nextCollateralLabelOnAddressChange,
  pickFreshCollateralTargetAddress,
  planCollateralInvoiceSync,
  prepOutpointKey,
  requiredCollateralDuffs,
  resolveCreatedCollateralOutpoint,
  spendablePrepTotal,
  spendablePrepUtxos,
  summarizeCollateralPrepSelection,
} from '@renderer/utils/masternodeCollateralPrep'

function addr(address: string, overrides: Partial<WalletAddressDto> = {}): WalletAddressDto {
  return {
    walletId: 'w1',
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

function coin(
  txid: string,
  vout: number,
  satoshis: bigint,
  overrides: Partial<FeeSelectableUtxo> = {},
): FeeSelectableUtxo {
  return {
    txid,
    vout,
    address: 'yTestAddress1',
    satoshis,
    height: 100,
    timestamp: null,
    confirmations: 6,
    isLocked: false,
    collateral: false,
    ...overrides,
  }
}

describe('masternodeCollateralPrep', () => {
  it('filters out locked and existing collateral coins, preferring confirmed then largest', () => {
    const coins = [
      coin('a'.repeat(64), 0, 60_000_000_000n, { height: 0, confirmations: 0 }),
      coin('b'.repeat(64), 0, 50_000_000_000n, { isLocked: true }),
      coin('c'.repeat(64), 0, 100_000_000_000n, { collateral: true }),
      coin('d'.repeat(64), 1, 30_000_000_000n),
      coin('e'.repeat(64), 0, 80_000_000_000n),
    ]

    const spendable = spendablePrepUtxos(coins)
    expect(spendable.map(prepOutpointKey)).toEqual([
      `${'e'.repeat(64)}:0`,
      `${'d'.repeat(64)}:1`,
      `${'a'.repeat(64)}:0`,
    ])
    expect(spendablePrepTotal(coins)).toBe(170_000_000_000n)
  })

  it('auto-selects minimal coins covering collateral plus fee buffer', () => {
    const coins = [
      coin('1'.repeat(64), 0, 60_000_000_000n),
      coin('2'.repeat(64), 0, 40_000_000_000n),
      coin('3'.repeat(64), 0, 10_000_000_000n),
    ]

    const picked = autoSelectCollateralPrepUtxos(coins, requiredCollateralDuffs('Regular'), 1_000n)
    expect(picked).toEqual([
      `${'1'.repeat(64)}:0`,
      `${'2'.repeat(64)}:0`,
      `${'3'.repeat(64)}:0`,
    ])

    const largeSingle = [coin('4'.repeat(64), 0, 150_000_000_000n)]
    expect(autoSelectCollateralPrepUtxos(largeSingle, requiredCollateralDuffs('Regular'), 1_000n)).toEqual([
      `${'4'.repeat(64)}:0`,
    ])
  })

  it('computes shortfall and change accurately across selection states', () => {
    const coins = [
      coin('1'.repeat(64), 0, 60_000_000_000n),
      coin('2'.repeat(64), 0, 50_000_000_000n),
    ]
    const required = requiredCollateralDuffs('Regular')

    const missingPrincipal = summarizeCollateralPrepSelection(
      coins,
      new Set([`${'1'.repeat(64)}:0`]),
      required,
      null,
    )
    expect(missingPrincipal.enough).toBe(false)
    expect(missingPrincipal.shortfallDuffs).toBe(40_000_000_000n)
    expect(missingPrincipal.changeDuffs).toBeNull()

    const enough = summarizeCollateralPrepSelection(
      coins,
      new Set([`${'1'.repeat(64)}:0`, `${'2'.repeat(64)}:0`]),
      required,
      1_200n,
    )
    expect(enough.enough).toBe(true)
    expect(enough.shortfallDuffs).toBe(0n)
    expect(enough.changeDuffs).toBe(10_000_000_000n - 1_200n)
  })

  it('resolves exact created output index from updated UTXOs or falls back to :0', () => {
    const txid = 'f'.repeat(64)
    const evoAmount = requiredCollateralDuffs('Evo')
    expect(
      resolveCreatedCollateralOutpoint(txid, evoAmount, [
        coin(txid, 0, 5_000_000_000n),
        coin(txid, 1, evoAmount),
      ]),
    ).toBe(`${txid}:1`)

    expect(resolveCreatedCollateralOutpoint(txid, evoAmount, [])).toBe(`${txid}:0`)
  })

  it('picks first clean unclaimed fresh receiving address ignoring raw address.label, or null when none remain', () => {
    const claimed = new Set(['yClaimed1'])
    const labels = new Map<string, string>([['yLabeledMap1', 'From request']])
    const receiving = [
      addr('yLocked1', { isLocked: true }),
      addr('yUsed1', { isUsed: true, txCount: 1 }),
      addr('yClaimed1', { index: 1 }),
      addr('yLabeledMap1', { index: 2 }),
      addr('yCleanWithRawLabel', { index: 3, label: 'Ignored legacy label' }),
      addr('yCleanUnused1', { index: 4 }),
    ]

    expect(pickFreshCollateralTargetAddress(receiving, claimed, labels)).toBe('yCleanWithRawLabel')
    expect(
      pickFreshCollateralTargetAddress(
        [
          addr('yClaimed1'),
          addr('yLabeledMap1'),
        ],
        claimed,
        labels,
      ),
    ).toBeNull()
    expect(fallbackCollateralTargetAddress([
      addr('yLocked1', { isLocked: true }),
      addr('yClaimed1', { index: 1 }),
    ])).toBe('yClaimed1')
  })

  it('syncs collateral label across labeled and unlabeled address switches', () => {
    const badges = new Map<string, string>([
      ['yInvoiceAddr', 'Freelance Invoice #104'],
    ])
    const badgeFor = (address: string) => badges.get(address.trim())

    expect(
      nextCollateralLabelOnAddressChange(
        'yClean1',
        'yInvoiceAddr',
        'Regular masternode collateral',
        badgeFor,
        'Regular',
      ),
    ).toBe('Freelance Invoice #104')

    expect(
      nextCollateralLabelOnAddressChange(
        'yInvoiceAddr',
        'yClean2',
        'Freelance Invoice #104',
        badgeFor,
        'Regular',
      ),
    ).toBe(defaultCollateralLabel('Regular'))

    expect(
      nextCollateralLabelOnAddressChange(
        'yClean1',
        'yClean2',
        'My Node #2',
        badgeFor,
        'Regular',
      ),
    ).toBe('My Node #2')

    expect(
      nextCollateralLabelOnAddressChange(
        'yClean1',
        'yClean2',
        '   ',
        badgeFor,
        'Evo',
      ),
    ).toBe(defaultCollateralLabel('Evo'))
  })

  it('orders clean unclaimed unused receiving addresses before invoice-labeled ones', () => {
    const claimed = new Set(['yInvoice1', 'yInvoice2'])
    const labels = new Map<string, string>([
      ['yInvoice1', 'Freelance Invoice #104'],
      ['yInvoice2', 'Coffee & Snacks'],
    ])
    const receiving = [
      addr('yLocked1', { isLocked: true }),
      addr('yUsed1', { isUsed: true, txCount: 1, balance: 50_000_000n }),
      addr('yInvoice1', { index: 1 }),
      addr('yInvoice2', { index: 2 }),
      addr('yClean1', { index: 3, label: 'Ignored legacy label' }),
      addr('yClean2', { index: 4 }),
    ]

    const options = collateralTargetAddressOptions(receiving, claimed, labels)
    expect(options.map(option => option.value)).toEqual([
      'yClean1',
      'yClean2',
      'yInvoice1',
      'yInvoice2',
    ])
    expect(options[0].badge).toBeUndefined()
    expect(options[1].badge).toBeUndefined()
    expect(options[2].badge).toBe('Freelance Invoice #104')
    expect(options[3].badge).toBe('Coffee & Snacks')
  })

  it('plans Receive invoice creation, rename replacement, and deletion without touching raw address labels', () => {
    const required = requiredCollateralDuffs('Regular')
    const existing = [
      { id: 42, address: 'yExisting', label: 'Old Invoice', amountDuffs: 25_000_000n },
    ]

    expect(planCollateralInvoiceSync('yFresh', 'Node #1', required, existing)).toEqual({
      deleteRequestId: null,
      createRequest: { label: 'Node #1', amountDuffs: required },
    })

    expect(planCollateralInvoiceSync('yFresh', '   ', required, existing)).toEqual({
      deleteRequestId: null,
      createRequest: null,
    })

    expect(planCollateralInvoiceSync('yExisting', ' Old Invoice ', required, existing)).toEqual({
      deleteRequestId: null,
      createRequest: null,
    })

    expect(planCollateralInvoiceSync('yExisting', 'Renamed Collateral', required, existing)).toEqual({
      deleteRequestId: 42,
      createRequest: { label: 'Renamed Collateral', amountDuffs: 25_000_000n },
    })

    expect(planCollateralInvoiceSync('yExisting', '   ', required, existing)).toEqual({
      deleteRequestId: 42,
      createRequest: null,
    })
  })
})
