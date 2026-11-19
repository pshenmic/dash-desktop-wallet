import { describe, expect, it } from 'vitest'
import type { FeeSelectableUtxo } from '@renderer/types/MasternodeRegistrationWizard'
import {
  autoSelectCollateralPrepUtxos,
  prepOutpointKey,
  requiredCollateralDuffs,
  resolveCreatedCollateralOutpoint,
  spendablePrepTotal,
  spendablePrepUtxos,
  summarizeCollateralPrepSelection,
} from '@renderer/utils/masternodeCollateralPrep'

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
})
