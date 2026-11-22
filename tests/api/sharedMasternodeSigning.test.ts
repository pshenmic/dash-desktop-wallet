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
import {masternodeAccountPath} from '../../src/main/src/utils/masternodeKeys'
import {nodeKeyValues} from '../../src/main/src/utils/masternodes'
import {withUnlockedWallet} from '../../src/main/src/utils/walletSeed'
import {MasternodeDAO} from '../../src/main/src/database/MasternodeDAO'
import {MasternodeIdentityDAO} from '../../src/main/src/database/MasternodeIdentityDAO'
import {Preferences} from '../../src/main/src/preferences'
import {WalletProviderFactory} from '../../src/main/src/providers/WalletProviderFactory'
import {CoreTransactionService} from '../../src/main/src/services/core/CoreTransactionService'
import {MasternodeService} from '../../src/main/src/services/core/MasternodeService'
import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {MasternodeKeyFilter, NetworkMasternode} from '../../src/main/src/types/Masternode'
import {UTXO} from '../../src/main/src/types/UTXO'
import {encryptImportedKey} from '../../src/main/src/utils/importedKeyEncryption'
import {sharedRegistrationConsentSigner, signSharedRegistrationConsent} from '../../src/main/src/utils/sharedMasternodeSigning'
import {harness, Harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const FUNDING_TXID = 'aa'.repeat(32)

function sharedRegistration(owner: PrivateKey, other: PrivateKey, consents?: string[]): Transaction {
  const p2pkh = (hash: string): Script => Script.fromHex(`76a914${hash}88ac`)
  const shares = [
    new CollateralShare(60_000_000_000n, p2pkh('f5e39ebf4b0ede3685a8de904d71bea7c71a5f9d'), p2pkh('868a3bf8d8cf221118b526b9c6b114dc3b18e4d7'), owner.getPublicKey().getPublicKeyHash()),
    new CollateralShare(40_000_000_000n, p2pkh('92cc55887af36a89aa15f3b4b9b10511d2fe557d'), new Script(), other.getPublicKey().getPublicKeyHash()),
  ]
  const payload = new ProRegTX(3, 0, 0, new OutPoint('00'.repeat(32), 1), undefined, undefined,
    '00'.repeat(20), 'b1861e7cebdb77ae860788edf2d8b80fda62bcd4647a4cee6841b753b7c438b4c084554b2d71703891092b6d9e509f05',
    '40660b7a7c0ef6cd15a5cb8912cc86326661e19b', 500, new Script(), '00'.repeat(32),
    undefined, undefined, undefined, '',
    {netInfo: new ExtNetInfo(), payouts: [], shares, joinSigs: consents ?? shares.map(() => '00'.repeat(65)), earlyPeriodBlocks: 17280, earlyPenalty: 500_000_000n})
  const tx = new Transaction([new Input(FUNDING_TXID, 0, new Script(), SEQUENCE_FINAL)],
    [new Output(1_000_000_00000n, Script.sharedCollateral())], 0, 3,
    TransactionType.TRANSACTION_PROVIDER_REGISTER, payload)
  // A combined registration carries a consent signature per share; the consent
  // digest leaves joinSigs out, so it can be computed before they are filled in.
  if (consents == null) {
    payload.joinSigs = [owner, other].map(key =>
      Buffer.from(signSharedRegistrationConsent(tx, key), 'base64').toString('hex'))
  }
  return tx
}

function node(proTxHash: string, fields: Partial<NetworkMasternode>): NetworkMasternode {
  return {
    proTxHash, type: 'Regular', status: 'ENABLED', posePenaltyScore: null,
    collateralTxid: 'ee'.repeat(32), collateralVout: 0, collateralAddress: 'Xnobody',
    serviceAddress: '1.2.3.4:19999', payeeAddress: 'Xpayee', ownerAddress: 'Xnobody', votingAddress: 'Xvoting',
    operatorPublicKey: 'ff'.repeat(48), platformNodeId: null, platformP2PPort: null, platformHttpPort: null,
    lastPaidBlock: null, lastPaidTime: null, registeredHeight: 100, isShared: false, shares: [], ...fields,
  }
}

describe('shared registration participant signing', () => {
  let wired: Harness
  let walletId: string
  let utxos: UTXO[]
  let network: NetworkMasternode[]
  let masternodes: MasternodeService

  beforeEach(async () => {
    wired = await harness()
    walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'mainnet', PASSWORD)
    utxos = []
    network = []
    const provider = {
      ensureReady: async () => undefined,
      getWalletUtxos: async () => utxos,
      getMasternodes: async (filter: MasternodeKeyFilter, values: string[]) =>
        network.filter(entry => nodeKeyValues(filter, entry).some(key => values.includes(key))),
      watchMasternodes: async () => [],
    }
    const providers = {forWallet: () => provider} as unknown as WalletProviderFactory
    const walletSync = {getListedMasternodes: () => null, refreshListedMasternodes: () => undefined} as unknown as WalletSyncService
    masternodes = new MasternodeService(
      wired.walletDAO, wired.masternodeKeyDAO, new MasternodeDAO(wired.knex), new MasternodeIdentityDAO(wired.knex),
      providers, wired.addressDAO, new CoreTransactionService(), walletSync, Preferences.default(),
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
      fundingTotalDuffs: 100_000_000_000n,
      unresolvedInputs: 0,
      collateralDuffs: 100_000_000_000n,
      outputs: [{address: null, amountDuffs: 100_000_000_000n, collateral: true}],
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

  it('refuses to sign funding before every share owner consented', async () => {
    const owner = PrivateKey.fromBytes(new Uint8Array(32).fill(7), 'mainnet')
    const other = PrivateKey.fromBytes(new Uint8Array(32).fill(8), 'mainnet')
    const tx = sharedRegistration(owner, other, ['00'.repeat(65), '00'.repeat(65)])

    await expect(masternodes.signSharedRegistrationFunding(walletId, tx.hex(), PASSWORD))
      .rejects.toThrow('has not collected share 0\'s consent yet')
  })

  it('consents with a share owner key discovery found past the first window', async () => {
    const {deep, first} = await withUnlockedWallet(wired.walletDAO, walletId, PASSWORD, async ({seed}) => {
      const ownerAccount = HDKey.fromMasterSeed(seed, HD_VERSIONS.mainnet).derive(masternodeAccountPath('mainnet', 'owner'))
      return {
        deep: PrivateKey.fromBytes(ownerAccount.deriveChild(55).privateKey!, 'mainnet', true),
        first: PrivateKey.fromBytes(ownerAccount.deriveChild(0).privateKey!, 'mainnet', true),
      }
    })
    const other = PrivateKey.fromBytes(new Uint8Array(32).fill(8), 'mainnet')
    // Index 0 keeps discovery's walk open, so it can widen to the share at 55.
    network = [
      node('a', {ownerAddress: first.getAddress()}),
      node('s', {ownerAddress: null, isShared: true, shares: [
        {ownerAddress: deep.getAddress(), amountDuffs: 60_000_000_000n},
        {ownerAddress: other.getAddress(), amountDuffs: 40_000_000_000n},
      ]}),
    ]
    await masternodes.discover(walletId)

    const tx = sharedRegistration(deep, other)
    expect((await masternodes.getMasternodes(walletId))?.map(node => [node.proTxHash, node.ownerKeyIndex]))
      .toEqual([['a', 0], ['s', 55]])
    expect(await masternodes.previewSharedRegistration(walletId, tx.hex())).toMatchObject({signableShares: [0]})
    const consent = await masternodes.signSharedRegistrationConsent(walletId, tx.hex(), PASSWORD)
    expect(consent.signatures).toHaveLength(1)
    expect(sharedRegistrationConsentSigner(tx, consent.signatures[0].signature, 'mainnet')).toBe(deep.getAddress())
  })
})