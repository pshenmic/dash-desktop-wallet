import {describe, expect, it} from 'vitest'
import {PrivateKey} from 'dash-core-sdk'
import {Base58Check} from 'dash-core-sdk/src/base58check.js'
import {ADDRESS_PREFIX} from '../../src/main/src/constants/addresses'
import {SharedRegistrationDraft, SharedRegistrationMemberDraft} from '../../src/main/src/types/Masternode'
import {
  requireSharedRegistrationDraft,
  sharedRegistrationScript,
} from '../../src/main/src/utils/sharedMasternodeRegistration'

const DASH = 100_000_000n

const address = (byte: number): string =>
  PrivateKey.fromBytes(new Uint8Array(32).fill(byte), 'mainnet').getAddress()

const p2shAddress = (byte: number): string =>
  Base58Check.encode(Uint8Array.from([ADDRESS_PREFIX.mainnet.p2sh, ...new Uint8Array(20).fill(byte)]))

const member = (fields: Partial<SharedRegistrationMemberDraft> = {}): SharedRegistrationMemberDraft => ({
  amountDuffs: 600n * DASH,
  ownerAddress: address(1),
  refundAddress: address(2),
  rewardAddress: null,
  changeAddress: address(3),
  inputs: [{txid: 'aa'.repeat(32), vout: 0}],
  ...fields,
})

const draft = (members: SharedRegistrationMemberDraft[] = [
  member(),
  member({
    amountDuffs: 400n * DASH,
    ownerAddress: address(4),
    refundAddress: address(5),
    changeAddress: address(6),
    inputs: [{txid: 'bb'.repeat(32), vout: 0}],
  }),
]): SharedRegistrationDraft => ({
  members,
  serviceAddress: '1.2.3.4:9999',
  operatorPublicKey: 'b1861e7cebdb77ae860788edf2d8b80fda62bcd4647a4cee6841b753b7c438b4c084554b2d71703891092b6d9e509f05',
  votingAddress: address(7),
  operatorReward: 0,
  earlyPeriodBlocks: 1_000,
  earlyPenaltyDuffs: 1_000_000n,
  feeDuffs: 100_000n,
})

const nineMembers = (): SharedRegistrationMemberDraft[] =>
  Array.from({length: 9}, (_, index) => member({
    amountDuffs: index === 8 ? 200n * DASH : 100n * DASH,
    ownerAddress: address(10 + index),
    refundAddress: address(20 + index),
    changeAddress: address(30 + index),
    inputs: [{txid: `${index}`.repeat(64), vout: 0}],
  }))

describe('sharedRegistrationScript', () => {
  it('builds the P2PKH script of an address', () => {
    expect(sharedRegistrationScript(address(1), 'mainnet').hex())
      .toBe(`76a914${PrivateKey.fromBytes(new Uint8Array(32).fill(1), 'mainnet').getPublicKey().getPublicKeyHash()}88ac`)
  })

  it('builds the P2SH script of an address', () => {
    expect(sharedRegistrationScript(p2shAddress(9), 'mainnet').hex())
      .toBe(`a914${'09'.repeat(20)}87`)
  })

  it('refuses another network and an unknown prefix', () => {
    const testnet = PrivateKey.fromBytes(new Uint8Array(32).fill(1), 'testnet').getAddress()
    expect(() => sharedRegistrationScript(testnet, 'mainnet')).toThrow('not a valid mainnet address')
    expect(() => sharedRegistrationScript('not an address', 'mainnet')).toThrow('Invalid address')
  })
})

describe('requireSharedRegistrationDraft', () => {
  it('accepts a two-member draft whose shares add up to 1000 DASH', () => {
    expect(() => requireSharedRegistrationDraft(draft(), 'mainnet')).not.toThrow()
  })

  it('refuses fewer than two or more than eight shares', () => {
    expect(() => requireSharedRegistrationDraft(draft([member({amountDuffs: 1_000n * DASH})]), 'mainnet'))
      .toThrow('2 to 8 shares')
    expect(() => requireSharedRegistrationDraft(draft(nineMembers()), 'mainnet')).toThrow('2 to 8 shares')
  })

  it('refuses a share below 100 DASH or a table that does not sum to 1000', () => {
    expect(() => requireSharedRegistrationDraft(draft([
      member({amountDuffs: 99n * DASH}),
      member({amountDuffs: 901n * DASH, ownerAddress: address(4), refundAddress: address(5), inputs: [{txid: 'bb'.repeat(32), vout: 0}]}),
    ]), 'mainnet')).toThrow('at least 100 DASH')
    expect(() => requireSharedRegistrationDraft(draft([
      member({amountDuffs: 500n * DASH}),
      member({amountDuffs: 400n * DASH, ownerAddress: address(4), refundAddress: address(5), inputs: [{txid: 'bb'.repeat(32), vout: 0}]}),
    ]), 'mainnet')).toThrow('1000 DASH')
  })

  it('refuses duplicate owner keys or duplicate refund scripts', () => {
    expect(() => requireSharedRegistrationDraft(draft([
      member(),
      member({amountDuffs: 400n * DASH, ownerAddress: address(1), refundAddress: address(5), inputs: [{txid: 'bb'.repeat(32), vout: 0}]}),
    ]), 'mainnet')).toThrow('owner key')
    expect(() => requireSharedRegistrationDraft(draft([
      member(),
      member({amountDuffs: 400n * DASH, ownerAddress: address(4), refundAddress: address(2), inputs: [{txid: 'bb'.repeat(32), vout: 0}]}),
    ]), 'mainnet')).toThrow('refund script')
  })

  it('refuses a refund or reward script paying the voting key or a share owner', () => {
    expect(() => requireSharedRegistrationDraft(draft([
      member({refundAddress: address(7)}),
      member({amountDuffs: 400n * DASH, ownerAddress: address(4), refundAddress: address(5), inputs: [{txid: 'bb'.repeat(32), vout: 0}]}),
    ]), 'mainnet')).toThrow('voting key')
    expect(() => requireSharedRegistrationDraft(draft([
      member({rewardAddress: address(4)}),
      member({amountDuffs: 400n * DASH, ownerAddress: address(4), refundAddress: address(5), inputs: [{txid: 'bb'.repeat(32), vout: 0}]}),
    ]), 'mainnet')).toThrow('owner key')
  })

  it('refuses a penalty that is not below the smallest share, or a penalty with no early period', () => {
    expect(() => requireSharedRegistrationDraft({...draft(), earlyPenaltyDuffs: 400n * DASH}, 'mainnet'))
      .toThrow('smallest share')
    expect(() => requireSharedRegistrationDraft({...draft(), earlyPeriodBlocks: 0}, 'mainnet'))
      .toThrow('penalty')
  })

  it('refuses too many blocks, an invalid operator key and a non-P2PKH voting key', () => {
    expect(() => requireSharedRegistrationDraft({...draft(), earlyPeriodBlocks: 420_481}, 'mainnet'))
      .toThrow('420480')
    expect(() => requireSharedRegistrationDraft({...draft(), operatorPublicKey: 'ab'.repeat(48)}, 'mainnet'))
      .toThrow('BLS')
    expect(() => requireSharedRegistrationDraft({...draft(), votingAddress: p2shAddress(9)}, 'mainnet'))
      .toThrow('P2PKH')
  })

  it('refuses duplicate outpoints, a malformed txid and a zero fee', () => {
    expect(() => requireSharedRegistrationDraft(draft([
      member(),
      member({amountDuffs: 400n * DASH, ownerAddress: address(4), refundAddress: address(5), inputs: [{txid: 'aa'.repeat(32), vout: 0}]}),
    ]), 'mainnet')).toThrow('same funding outpoint')
    expect(() => requireSharedRegistrationDraft(draft([
      member({inputs: [{txid: 'nope', vout: 0}]}),
      member({amountDuffs: 400n * DASH, ownerAddress: address(4), refundAddress: address(5), inputs: [{txid: 'bb'.repeat(32), vout: 0}]}),
    ]), 'mainnet')).toThrow('txid')
    expect(() => requireSharedRegistrationDraft({...draft(), feeDuffs: 0n}, 'mainnet')).toThrow('fee')
  })
})
