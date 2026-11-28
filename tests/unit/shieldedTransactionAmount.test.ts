import {describe, expect, it} from 'vitest'
import {PlatformTransaction} from '../../src/main/src/types/PlatformTransaction'
import {shieldedTransactionAmount} from '../../src/main/src/utils/shieldedTransactionAmount'

const WALLET = 'wallet-1'
const CHANGE = 'tdash1change000000000000000000000000000000000000000000000000000'
const SEND = 'tdash1send00000000000000000000000000000000000000000000000000000'
const RECEIVE = 'tdash1receive0000000000000000000000000000000000000000000000000000'
const shielded = new Set([CHANGE, SEND, RECEIVE])

const part = (source: string, amount: bigint): {source: string, amount: bigint} => ({source, amount})

const shieldedTx = (overrides: Partial<PlatformTransaction>): PlatformTransaction => ({
  walletId: WALLET,
  hash: 'SSSS',
  type: 'SHIELDED_TRANSFER',
  date: new Date(0),
  blockHeight: null,
  status: 'SUCCESS',
  error: null,
  gasCredits: 0n,
  netCredits: 0n,
  amountCredits: 0n,
  sender: [],
  recipient: [],
  ...overrides,
})

describe('shieldedTransactionAmount', () => {
  it('uses the notes a shield created, not the address that paid for them', () => {
    const row = shieldedTransactionAmount(shieldedTx({
      type: 'SHIELD',
      sender: [part('tdash1address', 115_455_069_000n)],
      recipient: [part(SEND, 20_752_599_000n)],
    }), shielded, CHANGE)

    expect(row.amountCredits).toBe(20_752_599_000n)
  })

  it('keeps a shield to an address this wallet cannot read', () => {
    const row = shieldedTransactionAmount(shieldedTx({
      type: 'SHIELD',
      amountCredits: 50_000_000n,
      sender: [part('tdash1address', 50_100_000n)],
      recipient: [part('tdash1stranger', 50_000_000n)],
    }), shielded, CHANGE)

    expect(row.amountCredits).toBe(50_000_000n)
  })

  it('leaves the change out of an unshield', () => {
    const row = shieldedTransactionAmount(shieldedTx({
      type: 'UNSHIELD',
      gasCredits: 168_934_000n,
      sender: [part(SEND, 3_057_626_686_000n)],
      recipient: [part('tdash1address', 100_000_000_000n), part(CHANGE, 2_957_457_752_000n)],
    }), shielded, CHANGE)

    expect(row.amountCredits).toBe(100_000_000_000n)
  })

  it('shows what a shielded transfer paid, not the note that funded it', () => {
    const row = shieldedTransactionAmount(shieldedTx({
      sender: [part(SEND, 2_000_000n)],
      recipient: [part(RECEIVE, 1_000_000n), part(CHANGE, 1_000_000n)],
    }), shielded, CHANGE)

    expect(row.amountCredits).toBe(1_000_000n)
  })

  it('sums the notes a receive created', () => {
    const row = shieldedTransactionAmount(shieldedTx({
      recipient: [part(RECEIVE, 1_000_000n)],
    }), shielded, CHANGE)

    expect(row.amountCredits).toBe(1_000_000n)
  })

  it('recovers an outgoing payment that left only change', () => {
    const row = shieldedTransactionAmount(shieldedTx({
      gasCredits: 1n,
      sender: [part(SEND, 2_000n)],
      recipient: [part(CHANGE, 999n)],
    }), shielded, CHANGE)

    expect(row.amountCredits).toBe(1_000n)
  })

  it('ignores a platform surplus beside a shield from an asset lock', () => {
    const row = shieldedTransactionAmount(shieldedTx({
      type: 'SHIELD_FROM_ASSET_LOCK',
      recipient: [part('tdash1address', 87_148_800n), part(SEND, 100_000_000_000n)],
    }), shielded, CHANGE)

    expect(row.amountCredits).toBe(100_000_000_000n)
  })

  it('leaves a transition that did not touch the pool alone', () => {
    const row = shieldedTx({type: 'ADDRESS_FUNDS_TRANSFER', amountCredits: 900n, recipient: [part('x', 900n)]})
    expect(shieldedTransactionAmount(row, shielded, CHANGE)).toBe(row)
  })
})
