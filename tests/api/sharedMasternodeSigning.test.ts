import {beforeEach, describe, expect, it} from 'vitest'
import {
  CollateralShare,
  ExtNetInfo,
  Input,
  OutPoint,
  Output,
  PrivateKey,
  Script,
  Transaction,
  TransactionType,
} from 'dash-core-sdk'
import {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import {HDKey} from '@scure/bip32'
import {HD_VERSIONS} from '../../src/main/src/constants/addresses'
import {SEQUENCE_FINAL} from '../../src/main/src/constants/chain'
import {derivePath256} from '../../src/main/src/utils/dashPayKeys'
import {withUnlockedWallet} from '../../src/main/src/utils/walletSeed'
import {MasternodeDAO} from '../../src/main/src/database/MasternodeDAO'
import {MasternodeIdentityDAO} from '../../src/main/src/database/MasternodeIdentityDAO'
import {Preferences} from '../../src/main/src/preferences'
import {WalletProviderFactory} from '../../src/main/src/providers/WalletProviderFactory'
import {CoreTransactionService} from '../../src/main/src/services/core/CoreTransactionService'
import {MasternodeService} from '../../src/main/src/services/core/MasternodeService'
import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {UTXO} from '../../src/main/src/types/UTXO'
import {encryptImportedKey} from '../../src/main/src/utils/importedKeyEncryption'
import {sharedRegistrationConsentSigner} from '../../src/main/src/utils/sharedMasternodeSigning'
import {harness, Harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const FUNDING_TXID = 'aa'.repeat(32)

function sharedRegistration(owner: PrivateKey, other: PrivateKey): Transaction {
  const p2pkh = (hash: string): Script => Script.fromHex(`76a914${hash}88ac`)
  const shares = [
    new CollateralShare(60_000_000_000n, p2pkh('f5e39ebf4b0ede3685a8de904d71bea7c71a5f9d'), p2pkh('868a3bf8d8cf221118b526b9c6b114dc3b18e4d7'), owner.getPublicKey().getPublicKeyHash()),
    new CollateralShare(40_000_000_000n, p2pkh('92cc55887af36a89aa15f3b4b9b10511d2fe557d'), new Script(), other.getPublicKey().getPublicKeyHash()),
  ]
  const payload = new ProRegTX(3, 0, 0, new OutPoint('00'.repeat(32), 1), undefined, undefined,
    '00'.repeat(20), 'b1861e7cebdb77ae860788edf2d8b80fda62bcd4647a4cee6841b753b7c438b4c084554b2d71703891092b6d9e509f05',
    '40660b7a7c0ef6cd15a5cb8912cc86326661e19b', 500, new Script(), '00'.repeat(32),
    undefined, undefined, undefined, '',
    {netInfo: new ExtNetInfo(), payouts: [], shares, joinSigs: shares.map(() => '00'.repeat(65)), earlyPeriodBlocks: 17280, earlyPenalty: 500_000_000n})
  return new Transaction([new Input(FUNDING_TXID, 0, new Script(), SEQUENCE_FINAL)],
    [new Output(1_000_000_00000n, Script.sharedCollateral())], 0, 3,
    TransactionType.TRANSACTION_PROVIDER_REGISTER, payload)
}

describe('shared registration participant signing', () => {
  let wired: Harness
  let walletId: string
  let utxos: UTXO[]
  let masternodes: MasternodeService

  beforeEach(async () => {
    wired = await harness()
    walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'mainnet', PASSWORD)
    utxos = []
    const provider = {
      ensureReady: async () => undefined,
      getWalletUtxos: async () => utxos,
    }
    const providers = {forWallet: () => provider} as unknown as WalletProviderFactory
    masternodes = new MasternodeService(
      wired.walletDAO, wired.masternodeKeyDAO, new MasternodeDAO(wired.knex), new MasternodeIdentityDAO(wired.knex),
      providers, wired.addressDAO, new CoreTransactionService(), {} as WalletSyncService, Preferences.default(),
    )
  })

  it('consents with an imported owner key and signs only this wallet\'s funding input', async () => {
    const owner = PrivateKey.fromBytes(new Uint8Array(32).fill(7), 'mainnet')
    const other = PrivateKey.fromBytes(new Uint8Array(32).fill(8), 'mainnet')
    const encrypted = await withUnlockedWallet(wired.walletDAO, walletId, PASSWORD, async ({seed}) =>
      encryptImportedKey(owner.toWIF(), seed))
    await wired.masternodeKeyDAO.saveImportedKey(walletId, {role: 'owner', publicKey: owner.getAddress()}, encrypted)

    const [{address, derivationPath}] = (await wired.addressDAO.getAddressesByWalletId(walletId)).receiving
    const script = Output.createP2PKH(100_000_000_000n, address).script
    utxos = [{address, satoshis: 100_000_000_000n, script, txId: FUNDING_TXID, vOut: 0, height: 1, timestamp: null, confirmations: 1, isLocked: false}]
    const tx = sharedRegistration(owner, other)

    expect(await masternodes.previewSharedRegistration(walletId, tx.hex())).toMatchObject({
      signableShares: [0],
      fundingInputs: [{index: 0, address, amountDuffs: 100_000_000_000n}],
    })

    const expectedScript = await withUnlockedWallet(wired.walletDAO, walletId, PASSWORD, async ({seed}) => {
      const derived = derivePath256(HDKey.fromMasterSeed(seed, HD_VERSIONS.mainnet), derivationPath)
      const expected = Transaction.fromHex(tx.hex())
      expected.inputs[0].scriptSig = script
      expected.sign([PrivateKey.fromBytes(derived.privateKey!, 'mainnet', true)])
      return expected.inputs[0].scriptSig.hex()
    })

    const consent = await masternodes.signSharedRegistrationConsent(walletId, tx.hex(), PASSWORD)
    expect(consent.signatures).toHaveLength(1)
    expect(consent.signatures[0].shareIndex).toBe(0)
    expect(sharedRegistrationConsentSigner(tx, consent.signatures[0].signature, 'mainnet')).toBe(owner.getAddress())

    const funded = await masternodes.signSharedRegistrationFunding(walletId, tx.hex(), PASSWORD)
    const signedTx = Transaction.fromHex(funded.signedHex)
    expect(funded.signedInputs).toEqual([0])
    expect(signedTx.inputs[0].scriptSig.hex()).toBe(expectedScript)
    expect(sharedRegistrationConsentSigner(signedTx, consent.signatures[0].signature, 'mainnet')).toBe(owner.getAddress())
  })

  it('signs a funding input held by an imported owner key', async () => {
    const owner = PrivateKey.fromBytes(new Uint8Array(32).fill(7), 'mainnet')
    const funder = PrivateKey.fromBytes(new Uint8Array(32).fill(12), 'mainnet')
    const other = PrivateKey.fromBytes(new Uint8Array(32).fill(8), 'mainnet')
    const encrypted = await withUnlockedWallet(wired.walletDAO, walletId, PASSWORD, async ({seed}) =>
      encryptImportedKey(funder.toWIF(), seed))
    await wired.masternodeKeyDAO.saveImportedKey(walletId, {role: 'owner', publicKey: funder.getAddress()}, encrypted)

    const script = Output.createP2PKH(100_000_000_000n, funder.getAddress()).script
    utxos = [{address: funder.getAddress(), satoshis: 100_000_000_000n, script, txId: FUNDING_TXID, vOut: 0, height: 1, timestamp: null, confirmations: 1, isLocked: false}]
    const tx = sharedRegistration(owner, other)

    const funded = await masternodes.signSharedRegistrationFunding(walletId, tx.hex(), PASSWORD)

    expect(funded.signedInputs).toEqual([0])
    const expected = Transaction.fromHex(tx.hex())
    expected.inputs[0].scriptSig = script
    expected.sign([funder])
    expect(Transaction.fromHex(funded.signedHex).inputs[0].scriptSig.hex()).toBe(expected.inputs[0].scriptSig.hex())
  })

  it('refuses to sign a funding input this wallet has locked', async () => {
    const owner = PrivateKey.fromBytes(new Uint8Array(32).fill(7), 'mainnet')
    const other = PrivateKey.fromBytes(new Uint8Array(32).fill(8), 'mainnet')
    const [{address}] = (await wired.addressDAO.getAddressesByWalletId(walletId)).receiving
    const script = Output.createP2PKH(100_000_000_000n, address).script
    utxos = [{address, satoshis: 100_000_000_000n, script, txId: FUNDING_TXID, vOut: 0, height: 1, timestamp: null, confirmations: 1, isLocked: true}]
    const tx = sharedRegistration(owner, other)

    await expect(masternodes.previewSharedRegistration(walletId, tx.hex())).rejects.toThrow('locked')
    await expect(masternodes.signSharedRegistrationFunding(walletId, tx.hex(), PASSWORD)).rejects.toThrow('locked')
  })
})