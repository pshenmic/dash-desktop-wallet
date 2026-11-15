import {describe, it, expect} from 'vitest'
import {requireQuoteSources} from '../../src/main/src/utils/quoteSources'
import type {FeeOperation, FeeParams} from '../../src/main/platform/types/messages'
import type {CoreSpendSource} from '../../src/main/src/types/CoinSelection'
import type {PlatformSpendSource} from '../../src/main/src/types/PlatformTransfer'

const params = (overrides: Partial<FeeParams> = {}): FeeParams => ({
  amountCredits: 1_000n,
  recipient: 'recipient',
  ...overrides,
})

const corePick: CoreSpendSource = {kind: 'outpoints', outpoints: [{txid: 'aa'.repeat(32), vout: 0}]}
const platformPick: PlatformSpendSource = {kind: 'address', address: 'platform-address'}

describe('requireQuoteSources', () => {
  const l1Funded: FeeOperation[] = ['coreSend', 'assetLockFunding', 'assetLockShield', 'identityRegister', 'identityTopUpL1']
  const addressFunded: FeeOperation[] = ['addressFundsTransfer', 'addressWithdrawal', 'identityCreate', 'identityTopUp', 'shield']
  const bothAutomatic: FeeOperation[] = [
    'shieldedTransfer', 'unshield', 'shieldedWithdrawal', 'identityCreateFromShielded',
    'identityToAddress', 'identityToIdentity', 'identityWithdrawal',
    'usernameRegister', 'dashPayContactRequest', 'identityUpdateKeys',
  ]

  it('lets L1-funded operations pick core coins but not platform addresses', () => {
    for (const operation of l1Funded) {
      expect(() => requireQuoteSources(operation, params({coreSource: corePick}))).not.toThrow()
      expect(() => requireQuoteSources(operation, params({platformSource: platformPick}))).toThrow(/address-funded/)
    }
  })

  it('lets address-funded operations pick platform addresses but not core coins', () => {
    for (const operation of addressFunded) {
      expect(() => requireQuoteSources(operation, params({platformSource: platformPick}))).not.toThrow()
      expect(() => requireQuoteSources(operation, params({coreSource: corePick}))).toThrow(/L1-funded/)
    }
  })

  it('refuses any pick for operations that select nothing', () => {
    for (const operation of bothAutomatic) {
      expect(() => requireQuoteSources(operation, params())).not.toThrow()
      expect(() => requireQuoteSources(operation, params({coreSource: corePick}))).toThrow(/L1-funded/)
      expect(() => requireQuoteSources(operation, params({platformSource: platformPick}))).toThrow(/address-funded/)
    }
  })

  it('answers for every operation the fee model prices', () => {
    const all: FeeOperation[] = [...l1Funded, ...addressFunded, ...bothAutomatic]
    expect(new Set(all).size).toBe(20)
    for (const operation of all) {
      expect(() => requireQuoteSources(operation, params())).not.toThrow()
    }
  })
})
