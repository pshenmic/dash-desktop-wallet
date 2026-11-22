import {describe, expect, it} from 'vitest'
import {
  CollateralShare,
  ExtNetInfo,
  Output,
  OutPoint,
  PrivateKey,
  Script,
  Transaction,
  TransactionType,
} from 'dash-core-sdk'
import {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import {
  sharedRegistrationCollateralDuffs,
  sharedRegistrationConsentSigner,
  sharedRegistrationShares,
  signSharedRegistrationConsent,
} from '../../src/main/src/utils/sharedMasternodeSigning'

const OWNER = PrivateKey.fromBytes(new Uint8Array(32).fill(7), 'mainnet')

function sharedRegistration(outputs?: Output[]): Transaction {
  const p2pkh = (hash: string) => Script.fromHex(`76a914${hash}88ac`)
  const shares = [
    new CollateralShare(600_000_00000n, p2pkh('f5e39ebf4b0ede3685a8de904d71bea7c71a5f9d'), p2pkh('868a3bf8d8cf221118b526b9c6b114dc3b18e4d7'), OWNER.getPublicKey().getPublicKeyHash()),
    new CollateralShare(400_000_00000n, p2pkh('92cc55887af36a89aa15f3b4b9b10511d2fe557d'), new Script(), '4a3d03d232aa03e67ec79a8325c61645602d2c16'),
  ]
  const payload = new ProRegTX(3, 0, 0, new OutPoint('00'.repeat(32), 1), undefined, undefined,
    '00'.repeat(20), 'b1861e7cebdb77ae860788edf2d8b80fda62bcd4647a4cee6841b753b7c438b4c084554b2d71703891092b6d9e509f05',
    '40660b7a7c0ef6cd15a5cb8912cc86326661e19b', 500, new Script(), '00'.repeat(32),
    undefined, undefined, undefined, '',
    {netInfo: new ExtNetInfo(), payouts: [], shares, joinSigs: shares.map(() => '00'.repeat(65)), earlyPeriodBlocks: 17280, earlyPenalty: 500_000_000n})
  return new Transaction([], outputs ?? [new Output(1_000_000_00000n, Script.sharedCollateral())], 0, 3,
    TransactionType.TRANSACTION_PROVIDER_REGISTER, payload)
}

describe('shared registration consent', () => {
  it('signs the consent digest with a share owner key and recovers that owner', () => {
    const tx = sharedRegistration()
    const signature = signSharedRegistrationConsent(tx, OWNER)

    expect(Buffer.from(signature, 'base64')).toHaveLength(65)
    expect(sharedRegistrationConsentSigner(tx, signature, 'mainnet')).toBe(OWNER.getAddress())
  })

  it('lists the share table with its owner, refund and reward addresses', () => {
    const tx = sharedRegistration()
    const shares = sharedRegistrationShares(tx, 'mainnet')

    expect(shares.map(({index, amountDuffs}) => [index, amountDuffs])).toEqual([[0, 600_000_00000n], [1, 400_000_00000n]])
    expect(shares[0].ownerAddress).toBe(OWNER.getAddress())
    expect(shares[1].rewardAddress).toBeNull()
  })
})

describe('shared registration collateral', () => {
  it('answers the collateral output when the share table adds up to it', () => {
    const tx = sharedRegistration()
    expect(sharedRegistrationCollateralDuffs(tx, sharedRegistrationShares(tx, 'mainnet'))).toBe(1_000_000_00000n)
  })

  it('refuses a share table that does not add up to the collateral', () => {
    const tx = sharedRegistration([new Output(900_000_00000n, Script.sharedCollateral())])
    expect(() => sharedRegistrationCollateralDuffs(tx, sharedRegistrationShares(tx, 'mainnet')))
      .toThrow('adds up to 100000000000 duffs, not the collateral\'s 90000000000')
  })

  it('refuses a shared registration that pays no collateral', () => {
    const tx = sharedRegistration([new Output(1_000_000_00000n, Script.fromHex(`76a914${'11'.repeat(20)}88ac`))])
    expect(() => sharedRegistrationCollateralDuffs(tx, sharedRegistrationShares(tx, 'mainnet')))
      .toThrow('pays no collateral output')
  })
})