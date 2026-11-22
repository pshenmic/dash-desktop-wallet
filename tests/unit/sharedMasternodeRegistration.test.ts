import {describe, expect, it} from 'vitest'
import {OutPoint, PrivateKey, Script, Transaction, utils as sdkUtils} from 'dash-core-sdk'
import {Base58Check} from 'dash-core-sdk/src/base58check.js'
import {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import {bytesToHex, concatBytes} from '@noble/hashes/utils.js'
import {sha256} from '@noble/hashes/sha2.js'
import {ADDRESS_PREFIX} from '../../src/main/src/constants/addresses'
import {
  SharedRegistrationDraft,
  SharedRegistrationMemberDraft,
  SharedRegistrationPrevout,
} from '../../src/main/src/types/Masternode'
import {
  requireSharedRegistrationDraft,
  sharedRegistrationScript,
  sharedRegistrationTx,
  sharedRegistrationWithoutScriptSigs,
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

const p2pkh = (byte: string): Script => Script.fromHex(`76a914${byte.repeat(20)}88ac`)
const prevouts = new Map<string, SharedRegistrationPrevout>([
  [`${'aa'.repeat(32)}:0`, {satoshis: 60_000_100_000n, script: p2pkh('11')}],
  [`${'bb'.repeat(32)}:0`, {satoshis: 40_000_050_000n, script: p2pkh('22')}],
])
const expectedInputsHash = (tx: Transaction): string =>
  bytesToHex(sha256(sha256(concatBytes(
    ...tx.inputs.map(input => new OutPoint(input.txId, input.vOut).bytes()),
  ))).toReversed())

describe('sharedRegistrationTx', () => {
  it('orders inputs by member, splits the fee and puts the collateral last', () => {
    const {tx, plan} = sharedRegistrationTx(draft(), prevouts, 'mainnet')

    expect(tx.inputs.map(input => [input.txId, input.vOut])).toEqual([['aa'.repeat(32), 0], ['bb'.repeat(32), 0]])
    expect(tx.inputs.every(input => input.sequence === 0xffffffff)).toBe(true)
    expect(tx.outputs.map(output => [output.script.hex(), output.satoshis])).toEqual([
      [sharedRegistrationScript(address(3), 'mainnet').hex(), 50_000n],
      [Script.sharedCollateral().hex(), 1_000n * DASH],
    ])
    expect(plan.collateralIndex).toBe(1)
    expect(plan.members.map(member => [member.feeDuffs, member.changeDuffs])).toEqual([[50_000n, 50_000n], [50_000n, 0n]])
    expect(plan.members.map(member => member.inputIndexes)).toEqual([[0], [1]])
    expect(plan.actualFeeDuffs).toBe(100_000n)
  })

  it('refuses a member whose inputs do not cover its share and fee share', () => {
    const short = new Map(prevouts)
    short.set(`${'aa'.repeat(32)}:0`, {satoshis: 60_000_000_000n, script: p2pkh('11')})

    expect(() => sharedRegistrationTx(draft(), short, 'mainnet')).toThrow('Member 1')
  })

  it('drops dust change and reports the higher actual fee', () => {
    const dusty = new Map(prevouts)
    dusty.set(`${'aa'.repeat(32)}:0`, {satoshis: 60_000_050_100n, script: p2pkh('11')})

    const {tx, plan} = sharedRegistrationTx(draft(), dusty, 'mainnet')

    expect(tx.outputs).toHaveLength(1)
    expect(plan.members[0].changeDuffs).toBe(0n)
    expect(plan.actualFeeDuffs).toBe(100_100n)
  })

  it('gives the fee remainder to the last member', () => {
    const remainder = new Map(prevouts)
    remainder.set(`${'bb'.repeat(32)}:0`, {satoshis: 40_000_050_001n, script: p2pkh('22')})
    const {plan} = sharedRegistrationTx({...draft(), feeDuffs: 100_001n}, remainder, 'mainnet')

    expect(plan.members.map(member => member.feeDuffs)).toEqual([50_000n, 50_001n])
  })

  it('writes a v3 Regular payload with the share table and zero join signatures', () => {
    const {tx, plan} = sharedRegistrationTx(draft(), prevouts, 'mainnet')
    const payload = tx.extraPayload as ProRegTX

    expect(payload.version).toBe(3)
    expect(payload.type).toBe(0)
    expect(payload.keyIdOwner).toBe('00'.repeat(20))
    expect(payload.collateralOutpoint).toMatchObject({txId: '00'.repeat(32), vOut: plan.collateralIndex})
    expect(payload.joinSigs).toEqual(['00'.repeat(65), '00'.repeat(65)])
    expect(payload.shares?.map(share => share.amount)).toEqual([60_000_000_000n, 40_000_000_000n])
    expect(payload.shares?.[0].getOwnerAddress(sdkUtils.networkValueToEnumValue('mainnet'))).toBe(address(1))
    expect(payload.shares?.[1].scriptReward.hex()).toBe('')
    expect(payload.inputsHash).toBe(tx.providerInputsHash())
    expect(payload.inputsHash).toBe(expectedInputsHash(tx))
    expect(payload.payloadSig).toBe('')
    expect(payload.earlyPeriodBlocks).toBe(1_000)
    expect(payload.earlyPenalty).toBe(1_000_000n)
    expect(plan.consentHash).toBe(tx.consentHash())
    expect(plan.txHex).toBe(tx.hex())
  })

  it('builds the same bytes twice', () => {
    expect(sharedRegistrationTx(draft(), prevouts, 'mainnet').tx.hex())
      .toBe(sharedRegistrationTx(draft(), prevouts, 'mainnet').tx.hex())
  })

  it('blanks every scriptSig before comparing transactions', () => {
    const signed = Transaction.fromHex(sharedRegistrationTx(draft(), prevouts, 'mainnet').tx.hex())
    signed.inputs[0].scriptSig = Script.fromHex('51')

    const blanked = Transaction.fromHex(sharedRegistrationWithoutScriptSigs(signed.hex()))

    expect(blanked.inputs.every(input => input.scriptSig.hex() === '')).toBe(true)
    expect(sharedRegistrationWithoutScriptSigs(signed.hex()))
      .toBe(sharedRegistrationWithoutScriptSigs(blanked.hex()))
  })
})
