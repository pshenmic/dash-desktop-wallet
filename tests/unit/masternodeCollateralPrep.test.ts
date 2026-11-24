import { describe, expect, it } from 'vitest'
import type { WalletAddressDto } from '@renderer/api/types'
import { COLLATERAL_PREP_FEE_BUFFER_DUFFS } from '@renderer/constants/masternodeCollateralPrep'
import type { FeeSelectableUtxo } from '@renderer/types/MasternodeRegistrationWizard'
import {
  autoSelectCollateralPrepUtxos,
  defaultCollateralLabel,
  fallbackCollateralTargetAddress,
  isExactCollateralCoin,
  isSufficientPrepCoin,
  isSuitableGreenUtxo,
  nextCollateralLabelOnAddressChange,
  pickFreshCollateralTargetAddress,
  planCollateralInvoiceSync,
  prepOutpointKey,
  requiredCollateralDuffs,
  resolveCollateralPrepSelectedKeys,
  resolveCreatedCollateralOutpoint,
  spendablePrepTotal,
  spendablePrepUtxos,
  summarizeCollateralPrepSelection,
  unifiedCollateralStepCoins,
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

  it('classifies exact collateral coins, sufficient prep coins, and suitable green UTXOs', () => {
    const required = requiredCollateralDuffs('Regular')
    const exactUnlocked = coin('a'.repeat(64), 0, required)
    const exactLocked = coin('b'.repeat(64), 0, required, { isLocked: true })
    const exactExistingCollateral = coin('c'.repeat(64), 0, required, { collateral: true })
    const sufficientCoin = coin('d'.repeat(64), 0, required + COLLATERAL_PREP_FEE_BUFFER_DUFFS)
    const sufficientLocked = coin('e'.repeat(64), 0, required + COLLATERAL_PREP_FEE_BUFFER_DUFFS, { isLocked: true })
    const slightlyShort = coin('f'.repeat(64), 0, required + COLLATERAL_PREP_FEE_BUFFER_DUFFS - 1n)

    expect(isExactCollateralCoin(exactUnlocked, required)).toBe(true)
    expect(isExactCollateralCoin(exactLocked, required)).toBe(true)
    expect(isExactCollateralCoin(exactExistingCollateral, required)).toBe(false)
    expect(isExactCollateralCoin(sufficientCoin, required)).toBe(false)

    expect(isSufficientPrepCoin(sufficientCoin, required)).toBe(true)
    expect(isSufficientPrepCoin(exactUnlocked, required)).toBe(false)
    expect(isSufficientPrepCoin(sufficientLocked, required)).toBe(false)
    expect(isSufficientPrepCoin(exactExistingCollateral, required)).toBe(false)
    expect(isSufficientPrepCoin(slightlyShort, required)).toBe(false)

    expect(isSuitableGreenUtxo(exactUnlocked, required)).toBe(true)
    expect(isSuitableGreenUtxo(exactLocked, required)).toBe(true)
    expect(isSuitableGreenUtxo(sufficientCoin, required)).toBe(true)
    expect(isSuitableGreenUtxo(sufficientLocked, required)).toBe(false)
    expect(isSuitableGreenUtxo(exactExistingCollateral, required)).toBe(false)
    expect(isSuitableGreenUtxo(slightlyShort, required)).toBe(false)
  })

  it('orders unified collateral step coins with exact confirmed first, exact confirming, then remaining spendable largest-first', () => {
    const required = requiredCollateralDuffs('Regular')
    const confirmingExact = coin('1'.repeat(64), 0, required, { height: 0, confirmations: 0 })
    const confirmedExact = coin('2'.repeat(64), 0, required, { height: 120 })
    const lockedExact = coin('3'.repeat(64), 0, required, { height: 100, isLocked: true })
    const existingCollateral = coin('4'.repeat(64), 0, required, { height: 100, collateral: true })
    const lockedLarge = coin('5'.repeat(64), 0, 200_000_000_000n, { height: 100, isLocked: true })
    const confirmingLarge = coin('6'.repeat(64), 0, 150_000_000_000n, { height: 0, confirmations: 0 })
    const confirmedSmall = coin('7'.repeat(64), 0, 40_000_000_000n, { height: 100 })
    const confirmedLarge = coin('8'.repeat(64), 0, 120_000_000_000n, { height: 100 })

    const ordered = unifiedCollateralStepCoins(
      [
        confirmingExact,
        existingCollateral,
        lockedLarge,
        confirmingLarge,
        confirmedSmall,
        confirmedExact,
        confirmedLarge,
        lockedExact,
      ],
      required,
    )

    expect(ordered.map(prepOutpointKey)).toEqual([
      `${'2'.repeat(64)}:0`,
      `${'3'.repeat(64)}:0`,
      `${'1'.repeat(64)}:0`,
      `${'8'.repeat(64)}:0`,
      `${'7'.repeat(64)}:0`,
      `${'6'.repeat(64)}:0`,
    ])
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

  it('resolves selected keys cleanly in auto-select vs manual mode', () => {
    const coins = [
      coin('1'.repeat(64), 0, 80_000_000_000n),
      coin('2'.repeat(64), 0, 50_000_000_000n),
    ]
    const required = requiredCollateralDuffs('Regular')

    expect(
      resolveCollateralPrepSelectedKeys('auto', coins, required, [`${'2'.repeat(64)}:0`]),
    ).toEqual([`${'1'.repeat(64)}:0`, `${'2'.repeat(64)}:0`])

    expect(
      resolveCollateralPrepSelectedKeys('manual', coins, required, [
        `${'2'.repeat(64)}:0`,
        `${'9'.repeat(64)}:0`,
      ]),
    ).toEqual([`${'2'.repeat(64)}:0`])
  })
})
