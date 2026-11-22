import {bls, PrivateKey, Transaction, TransactionType, utils as sdkUtils} from 'dash-core-sdk'
import {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import {HDKey} from '@scure/bip32'
import {AddressDAO} from '../../database/AddressDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {MasternodeDAO} from '../../database/MasternodeDAO'
import {MasternodeKeyDAO} from '../../database/MasternodeKeyDAO'
import {MasternodeIdentityDAO} from '../../database/MasternodeIdentityDAO'
import {WalletProvider} from '../../providers/WalletProvider'
import {WalletProviderFactory} from '../../providers/WalletProviderFactory'
import {MASTERNODE_KEY_CHAINS, MASTERNODE_KEY_WINDOW, MASTERNODE_WALKED_CHAINS, HD_VERSIONS} from '../../constants/addresses'
import {DUST_THRESHOLD_DUFFS, MASTERNODE_TYPE_CODE, PROTX_VERSION, REVOCATION_REASON_CODE, SHARED_REGISTRATION_NO_PENALTY_WARNING} from '../../constants/chain'
import {MIN_RELAY_FEE_DUFFS} from '../../constants/fee/core'
import {Preferences} from '../../preferences'
import {
  ImportedMasternodeKey,
  Masternode,
  MasternodeCollateral,
  MasternodeKeyChain,
  MasternodeKeyFilter,
  MasternodeKeys,
  MasternodeRegistrarUpdate,
  MasternodeRegistration,
  MasternodeRegistrationPlan,
  MasternodeRegistrationPreview,
  MasternodeRegistrationResult,
  MasternodeServiceUpdate,
  MasternodeUpdateResult,
  NetworkMasternode,
  OperatorKeyChoice,
  OwnedCollateral,
  ParsedMasternodeRegistration,
  ProviderTxContext,
  ProviderTxPlan,
  RevocationReason,
  SharedRegistrationFundingResult,
  SharedRegistrationFundingSource,
  SharedRegistrationPreview,
  SharedRegistrationConsentResult,
  SharedRegistrationBase,
  SharedRegistrationSignature,
} from '../../types/Masternode'
import {ProviderTxSigner, TransactionInputToSign, TransferInput, TransferInputSelection} from '../../types/CoreTransaction'
import {UTXO} from '../../types/UTXO'
import {memoryWindowStore, runAddressWindow} from '../../utils/addressWindow'
import {coreFeeDuffsFor} from '../../utils/coreFeeRate'
import {masternodeKeyDeriver, masternodePublicKey, masternodeAccountPath, requireBasicOperatorKey} from '../../utils/masternodeKeys'
import {masternodeIdentityRows} from '../../utils/masternodeIdentities'
import {
  carriesKey,
  collateralsToStore,
  collateralUtxos,
  existingMasternodes,
  masternodeFilterValues,
  matchMasternodeKeys,
  operatedNode,
  ownedCollaterals,
  ownedMasternodes,
  ownerNode,
  requireCollateral,
  requirePayout,
  revocableNode,
  unusedKeyIndex,
  withoutCollaterals,
} from '../../utils/masternodes'
import {
  requireProTxHash,
  requireRegistrationFields,
  requireServiceUpdate,
  serviceAddressParts,
} from '../../utils/providerTx'
import {addressPaths, selectTransferInputs} from '../../utils/transferInputs'
import {coreChangeAndFee, coreInputEntries} from '../../utils/transactionPreview'
import {withUnlockedWallet} from '../../utils/walletSeed'
import {CoreTransactionService} from './CoreTransactionService'
import {WalletSyncService} from './WalletSyncService'
import {requireWallet} from '../../utils/requireWallet'
import {bytesToHex, hexToBytes} from '@noble/hashes/utils.js'
import createCoreClient from 'dash-core-sdk/src/createCoreClient.js'
import {decryptImportedKey, encryptImportedKey} from '../../utils/importedKeyEncryption'
import {
  sharedRegistrationConsentSigner,
  sharedRegistrationShares,
  signSharedRegistrationConsent,
} from '../../utils/sharedMasternodeSigning'
import {EVONODE_STATUS_TIMEOUT_MS} from '../../constants/dapi'
import {Network} from '../../types/Network'
import {coreSDK} from '../../utils/coreSDK'
import {Logger} from '../../utils/logger'

const log = new Logger('masternodes')

export class MasternodeService {
  private walletDAO: WalletDAO
  private masternodeKeyDAO: MasternodeKeyDAO
  private masternodeDAO: MasternodeDAO
  private masternodeIdentityDAO: MasternodeIdentityDAO
  private providers: WalletProviderFactory
  private addressDAO: AddressDAO
  private coreTransactionService: CoreTransactionService
  private walletSyncService: WalletSyncService
  private preferences: Preferences
  // Live network state, so only the last run's answer is kept, in memory.
  private listed = new Map<string, Masternode[]>()
  // When discovery first found each node, which a list must postdate to drop it.
  private firstSeen = new Map<string, number>()
  // Registrations still in the mempool: their identity rows must survive passes
  // that do not carry the node yet.
  private pendingIdentities = new Map<string, Set<string>>()

  constructor(
    walletDAO: WalletDAO,
    masternodeKeyDAO: MasternodeKeyDAO,
    masternodeDAO: MasternodeDAO,
    masternodeIdentityDAO: MasternodeIdentityDAO,
    providers: WalletProviderFactory,
    addressDAO: AddressDAO,
    coreTransactionService: CoreTransactionService,
    walletSyncService: WalletSyncService,
    preferences: Preferences,
  ) {
    this.walletDAO = walletDAO
    this.masternodeKeyDAO = masternodeKeyDAO
    this.masternodeDAO = masternodeDAO
    this.masternodeIdentityDAO = masternodeIdentityDAO
    this.providers = providers
    this.addressDAO = addressDAO
    this.coreTransactionService = coreTransactionService
    this.walletSyncService = walletSyncService
    this.preferences = preferences
  }

  // null until the first discovery run since startup has answered.
  async getMasternodes(walletId: string): Promise<Masternode[] | null> {
    return this.listed.get(walletId) ?? null
  }

  // From the stored rows, so a list outage still answers what sends must not spend.
  async getCollaterals(walletId: string): Promise<OwnedCollateral[]> {
    return ownedCollaterals(await this.masternodeDAO.getCollaterals(walletId), this.listed.get(walletId) ?? [])
  }

  async getImportedKeys(walletId: string): Promise<ImportedMasternodeKey[]> {
    return this.masternodeKeyDAO.getImportedKeys(walletId)
  }

  // Kept even when no node carries it yet, so a later registration is found.
  // Answers the listed nodes that carry it, or null while no list has arrived to
  // search — p2p before its first proven list — which is not "none". The secret
  // is encrypted under the seed, so the key can sign later.
  async importKey(walletId: string, role: MasternodeKeyChain, privateKey: string, password?: string): Promise<Masternode[] | null> {
    if (!MASTERNODE_KEY_CHAINS.includes(role)) throw new Error(`Unknown masternode key role: ${role}`)
    const wallet = await requireWallet(this.walletDAO, walletId)
    const trimmed = privateKey.trim()
    const key = {role, publicKey: masternodePublicKey(role, trimmed, wallet.network)}
    const encryptedPrivateKey = await this.encryptImportedSecret(walletId, trimmed, password)
    await this.masternodeKeyDAO.saveImportedKey(walletId, key, encryptedPrivateKey)
    log.info(`wallet ${walletId}: imported a ${role} key`)
    await this.discover(walletId)
    return this.listed.get(walletId)?.filter(node => carriesKey(node, key)) ?? null
  }

  async getImportedKeySecret(walletId: string, role: MasternodeKeyChain, publicKey: string): Promise<string | null> {
    return this.masternodeKeyDAO.getImportedKeySecret(walletId, role, publicKey)
  }

  // What this wallet can contribute to a shared registration prepared elsewhere:
  // the shares whose owner key it holds and the funding inputs it owns. Nothing
  // is signed here, so it can run before the password prompt.
  async previewSharedRegistration(walletId: string, txHex: string): Promise<SharedRegistrationPreview> {
    const base = await this.sharedRegistrationBase(walletId, txHex)
    return this.sharedRegistrationPreview(base, await this.sharedRegistrationFunding(walletId, base.tx, base.network))
  }

  // Participant-side consent: sign the preparation's consent digest with every
  // share owner key this wallet holds. The coordinator combines these into
  // joinSigs before any funding input is signed.
  async signSharedRegistrationConsent(walletId: string, txHex: string, password: string): Promise<SharedRegistrationConsentResult> {
    const {tx, network, shares, keys, ownerIndexes, importedOwners, signableShares} = await this.sharedRegistrationBase(walletId, txHex)
    if (signableShares.length === 0) {
      throw new Error('This wallet holds no share owner key for this registration')
    }

    const signatures: SharedRegistrationSignature[] = []

    await withUnlockedWallet(this.walletDAO, walletId, password, async ({seed}) => {
      const ownerAccount = keys == null ? null : HDKey.fromMasterSeed(seed, HD_VERSIONS[network]).derive(masternodeAccountPath(network, 'owner'))
      for (const share of shares) {
        let key: PrivateKey | null = null
        if (importedOwners.has(share.ownerAddress)) {
          const secret = await this.masternodeKeyDAO.getImportedKeySecret(walletId, 'owner', share.ownerAddress)
          if (secret == null) continue
          key = PrivateKey.fromWIF(decryptImportedKey(secret, seed))
        } else {
          const index = ownerIndexes.get(share.ownerAddress)
          const privateKey = index == null || ownerAccount == null ? null : ownerAccount.deriveChild(index).privateKey
          if (privateKey == null) continue
          key = PrivateKey.fromBytes(privateKey, network, true)
        }
        const signature = signSharedRegistrationConsent(tx, key)
        const signer = sharedRegistrationConsentSigner(tx, signature, network)
        if (signer !== share.ownerAddress) {
          throw new Error(`Consent for share ${share.index} recovers to ${signer}, not ${share.ownerAddress}`)
        }
        signatures.push({shareIndex: share.index, signature})
      }
    })

    log.info(`wallet ${walletId}: shared registration consent signed ${signatures.length} share(s)`)
    return {
      preview: this.sharedRegistrationPreview({tx, shares, signableShares}, []),
      signatures,
    }
  }

  // Funding signatures sign the whole transaction, joinSigs included, so this
  // must run on the combined transaction after shared_combine — never on the
  // prepared one. Consent is unaffected by funding signatures.
  async signSharedRegistrationFunding(walletId: string, txHex: string, password: string): Promise<SharedRegistrationFundingResult> {
    const base = await this.sharedRegistrationBase(walletId, txHex)
    const sources = await this.sharedRegistrationFunding(walletId, base.tx, base.network)
    if (sources.length === 0) {
      throw new Error('This wallet has no funding input in this registration')
    }

    const signedInputs = await withUnlockedWallet(this.walletDAO, walletId, password, async ({seed}) => {
      const inputs: TransactionInputToSign[] = []
      for (const source of sources) {
        if (source.kind === 'wallet') {
          inputs.push({
            index: source.index,
            address: source.address,
            script: source.script,
            key: {kind: 'derivation', derivationPath: source.derivationPath},
          })
          continue
        }
        const secret = await this.masternodeKeyDAO.getImportedKeySecret(walletId, source.role, source.publicKey)
        if (secret == null) throw new Error(`No stored ${source.role} key for funding input ${source.address}`)
        inputs.push({
          index: source.index,
          address: source.address,
          script: source.script,
          key: {kind: 'privateKey', privateKey: PrivateKey.fromWIF(decryptImportedKey(secret, seed))},
        })
      }
      return this.coreTransactionService.signTransactionInputs(base.tx, inputs, seed, base.network)
    })

    log.info(`wallet ${walletId}: shared registration signed ${signedInputs.length} funding input(s)`)
    return {
      preview: this.sharedRegistrationPreview(base, sources),
      signedHex: base.tx.hex(),
      signedInputs,
    }
  }

  private async sharedRegistrationBase(walletId: string, txHex: string): Promise<SharedRegistrationBase> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    const tx = Transaction.fromHex(txHex)
    const shares = sharedRegistrationShares(tx, wallet.network)
    const [keys, imported] = await Promise.all([
      this.masternodeKeyDAO.getKeys(walletId),
      this.masternodeKeyDAO.getImportedKeys(walletId),
    ])
    const ownerIndexes = this.ownerIndexes(keys, wallet.network)
    const importedOwners = new Set(imported
      .filter(({role, hasPrivateKey}) => role === 'owner' && hasPrivateKey)
      .map(({publicKey}) => publicKey))
    const signableShares = shares
      .filter(share => importedOwners.has(share.ownerAddress) || ownerIndexes.has(share.ownerAddress))
      .map(({index}) => index)
    return {tx, network: wallet.network, shares, keys, imported, ownerIndexes, importedOwners, signableShares}
  }

  private async sharedRegistrationFunding(walletId: string, tx: Transaction, network: Network): Promise<SharedRegistrationFundingSource[]> {
    const provider = this.providers.forWallet(walletId, network)
    await provider.ensureReady()
    const [utxos, grouped, imported] = await Promise.all([
      provider.getWalletUtxos(),
      this.addressDAO.getAddressesByWalletId(walletId),
      this.masternodeKeyDAO.getImportedKeys(walletId),
    ])
    const paths = addressPaths(grouped)
    const byOutpoint = new Map(utxos.map(utxo => [`${utxo.txId}:${utxo.vOut}`, utxo]))
    const importedFunding = new Map(imported
      .filter((key): key is ImportedMasternodeKey & {role: 'owner' | 'voting'} =>
        (key.role === 'owner' || key.role === 'voting') && key.hasPrivateKey)
      .map(key => [key.publicKey, key]))

    const sources: SharedRegistrationFundingSource[] = []
    const unresolved: Array<{input: Transaction['inputs'][number]; index: number}> = []
    tx.inputs.forEach((input, index) => {
      const utxo = byOutpoint.get(`${input.txId}:${input.vOut}`)
      if (utxo != null) {
        if (utxo.isLocked) throw new Error(`The registration spends a coin this wallet has locked: ${utxo.address}`)
        const derivationPath = paths.get(utxo.address)
        if (derivationPath != null) {
          sources.push({kind: 'wallet', index, address: utxo.address, amountDuffs: utxo.satoshis, script: utxo.script, derivationPath})
          return
        }
        const importedKey = importedFunding.get(utxo.address)
        if (importedKey != null) {
          sources.push({kind: 'imported', index, address: utxo.address, amountDuffs: utxo.satoshis, script: utxo.script, role: importedKey.role, publicKey: importedKey.publicKey})
          return
        }
      }
      unresolved.push({input, index})
    })

    if (importedFunding.size > 0 && unresolved.length > 0) {
      const resolved = await Promise.all(unresolved.map(async ({input, index}) => {
        try {
          const {transaction} = await coreSDK(network).getTransaction(input.txId)
          const output = Transaction.fromBytes(transaction).outputs[input.vOut]
          if (output == null) return null
          const address = output.getAddress(sdkUtils.networkValueToEnumValue(network)) ?? ''
          const importedKey = importedFunding.get(address)
          if (importedKey == null) return null
          return {
            kind: 'imported' as const,
            index,
            address,
            amountDuffs: output.satoshis,
            script: output.script,
            role: importedKey.role,
            publicKey: importedKey.publicKey,
          }
        } catch (err) {
          log.warn(`wallet ${walletId}: shared registration funding input ${input.txId}:${input.vOut} not resolved:`, err)
          return null
        }
      }))
      for (const source of resolved) if (source != null) sources.push(source)
    }

    return sources
  }

  private sharedRegistrationPreview(
    {tx, shares, signableShares}: Pick<SharedRegistrationBase, 'tx' | 'shares' | 'signableShares'>,
    sources: SharedRegistrationFundingSource[],
  ): SharedRegistrationPreview {
    const earlyPenalty = (tx.extraPayload as ProRegTX).earlyPenalty ?? 0n
    return {
      consentHash: tx.consentHash(),
      shares,
      signableShares,
      fundingInputs: sources.map(({index, address, amountDuffs}) => ({index, address, amountDuffs})),
      warning: earlyPenalty === 0n ? SHARED_REGISTRATION_NO_PENALTY_WARNING : null,
    }
  }

  // The owner chain is public-only in storage, so only the addresses (and thus
  // indexes) are known here; signing derives the private key from the seed.
  private ownerIndexes(keys: MasternodeKeys | null, network: Network): Map<string, number> {
    if (keys == null) return new Map()
    const deriver = masternodeKeyDeriver(keys, network, 'owner')
    const indexes = new Map<string, number>()
    for (let index = 0; index < MASTERNODE_KEY_WINDOW.gapLimit; index++) {
      indexes.set(deriver.derive(index).address, index)
    }
    return indexes
  }

  private async encryptImportedSecret(walletId: string, privateKey: string, password?: string): Promise<string> {
    if (password == null || password.length === 0) throw new Error('A wallet password is required to save an imported masternode key')
    return withUnlockedWallet(this.walletDAO, walletId, password, async ({seed}) =>
      encryptImportedKey(privateKey, seed))
  }

  async removeKey(walletId: string, key: ImportedMasternodeKey): Promise<void> {
    await this.masternodeKeyDAO.removeImportedKey(walletId, key)
    log.info(`wallet ${walletId}: removed a ${key.role} key`)
    await this.discover(walletId)
  }

  // Rebuilds the registration from this wallet's own coins and refuses unless it
  // reproduces the submitted bytes, so no output or input can hide behind a signature.
  async signAndBroadcastRegistration(walletId: string, unsignedHex: string, password: string): Promise<MasternodeRegistrationResult> {
    const context = await this.providerTxContext(walletId)
    const plan = await this.registrationTxParams(unsignedHex, context)
    log.info(`register ${plan.payload.type === MASTERNODE_TYPE_CODE.Evo ? 'Evo' : 'Regular'} on ` +
      `${plan.payload.collateralOutpoint.txId}:${plan.payload.collateralOutpoint.vOut}: broadcasting`)
    const {tx, inputTotal} = await withUnlockedWallet(this.walletDAO, walletId, password, async ({seed}) => {
      const tx = await this.coreTransactionService.buildSignedProviderTx({
        payload: plan.payload,
        signer: plan.signer,
        inputs: plan.inputs,
        changeAddress: plan.changeAddress,
        inputTotal: plan.inputTotal,
        feeDuffs: plan.feeDuffs,
        seed,
        network: context.network,
      })
      return {tx, inputTotal: plan.inputTotal}
    })
    const {txid, fee, peersAcked} = await this.broadcastProviderTx(tx, inputTotal)
    if (plan.payload.type === MASTERNODE_TYPE_CODE.Evo) {
      const pending = this.pendingIdentities.get(walletId) ?? new Set<string>()
      pending.add(txid)
      this.pendingIdentities.set(walletId, pending)
      await this.masternodeIdentityDAO.save(walletId, masternodeIdentityRows([{
        proTxHash: txid, type: 'Evo', votingAddress: plan.payload.getVotingAddress(context.network),
      }])).catch(err => log.warn(`wallet ${walletId}: node identities not stored:`, err))
    }
    return {proTxHash: txid, fee, peersAcked}
  }

  // The registration the wallet would sign, priced and built but unsigned: its
  // keys are stored xpubs, so no password is asked for.
  async previewRegistration(walletId: string, registration: MasternodeRegistration): Promise<MasternodeRegistrationPreview> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    requireRegistrationFields(registration, wallet.network)
    this.coreTransactionService.classifyAddress(registration.payoutAddress, wallet.network)
    const provided = this.providedKeys(registration, wallet.network)
    const context = await this.providerTxContext(walletId)
    const plan = await this.registrationPlan(registration, provided, context)
    const selection = this.selectProviderInputs(plan, context)
    // A registration pays change only, so nothing is subtracted before it.
    const {change, feeDuffs} = coreChangeAndFee(selection, 0n)
    return {
      ...this.registrationFromPayload(plan.payload, wallet.network),
      ownerKeyIndex: plan.ownerKeyIndex,
      votingKeyIndex: plan.votingKeyIndex,
      operatorKeyIndex: plan.operatorKeyIndex,
      inputs: coreInputEntries(selection.transferInputs, context.utxos),
      outputs: change,
      feeDuffs,
      unsignedHex: this.coreTransactionService.buildProviderTx({
        payload: plan.payload,
        inputs: selection.transferInputs,
        changeAddress: selection.changeAddress,
        inputTotal: selection.inputTotal,
        feeDuffs: selection.feeDuffs,
      }).hex(),
    }
  }

  private providedKeys(
    registration: MasternodeRegistration,
    network: Network,
  ): Pick<MasternodeRegistration, 'ownerAddress' | 'votingAddress' | 'operatorPublicKey'> {
    const {ownerAddress, votingAddress} = registration
    if (ownerAddress != null) this.coreTransactionService.requireP2pkhAddress(ownerAddress, network, 'owner')
    if (votingAddress != null) this.coreTransactionService.requireP2pkhAddress(votingAddress, network, 'voting')
    return {
      ownerAddress,
      votingAddress,
      operatorPublicKey: registration.operatorPublicKey == null ? null : requireBasicOperatorKey(registration.operatorPublicKey),
    }
  }

  // What the previewed hex must be: a v2 ProRegTx over this wallet's coins whose
  // only output is its change, reproduced byte for byte before it is signed.
  private async registrationTxParams(
    unsignedHex: string,
    {network, grouped, utxos, collaterals, provider}: ProviderTxContext,
  ): Promise<{
    payload: ProRegTX
    signer: ProviderTxSigner
    inputs: TransferInput[]
    changeAddress: string
    inputTotal: bigint
    feeDuffs: bigint
  }> {
    const {transaction, payload} = this.requireRegistrationTransaction(unsignedHex)
    const registration = this.registrationFromPayload(payload, network)
    requireRegistrationFields(registration, network)
    this.coreTransactionService.classifyAddress(registration.payoutAddress, network)
    requirePayout(registration.payoutAddress, registration.ownerAddress, registration.votingAddress)

    const coin = requireCollateral(utxos, collaterals, registration)
    const paths = addressPaths(grouped)
    const collateralPath = paths.get(coin.address)
    if (collateralPath == null) throw new Error(`No derivation path for address ${coin.address}`)
    await this.requireFreeOperatorKey(registration.operatorPublicKey, provider)

    const {inputs, inputTotal} = this.requireRegistrationInputs(transaction, utxos, coin, collaterals, paths)
    const {changeAddress, changeDuffs} = this.requireRegistrationChange(transaction, paths, network, coin.address)
    const feeDuffs = inputTotal - changeDuffs
    if (feeDuffs <= 0n) throw new Error('The registration pays no fee')

    const rebuilt = this.coreTransactionService.proRegPayload(registration, {
      ownerKeyId: bytesToHex(sdkUtils.addressToPublicKeyHash(registration.ownerAddress)),
      votingKeyId: bytesToHex(sdkUtils.addressToPublicKeyHash(registration.votingAddress)),
      operatorPublicKey: registration.operatorPublicKey,
    }, network)

    // The preview priced exactly this selection; anything above the quote is
    // the dust change it folds into the fee, never a burn the renderer chose.
    const quotedFeeDuffs = coreFeeDuffsFor(
      this.preferences.general.coreFeeMultiplier, inputs.length, 1, false, rebuilt.signedSize())
    if (feeDuffs < quotedFeeDuffs || feeDuffs - quotedFeeDuffs >= DUST_THRESHOLD_DUFFS) {
      throw new Error('The registration fee does not match the quoted network fee')
    }

    const reproduced = this.coreTransactionService.buildProviderTx({payload: rebuilt, inputs, changeAddress, inputTotal, feeDuffs})
    if (reproduced.hex() !== unsignedHex.toLowerCase()) {
      throw new Error('The transaction does not match the registration this wallet would build')
    }
    return {payload: rebuilt, signer: {kind: 'address', derivationPath: collateralPath, address: coin.address}, inputs, changeAddress, inputTotal, feeDuffs}
  }

  // Untrusted hex: the shape is settled before any field is read from it.
  private requireRegistrationTransaction(unsignedHex: string): {transaction: Transaction; payload: ProRegTX} {
    let transaction: Transaction
    try {
      transaction = Transaction.fromHex(unsignedHex)
    } catch {
      throw new Error('Not a transaction')
    }
    const payload = transaction.extraPayload
    if (transaction.type !== TransactionType.TRANSACTION_PROVIDER_REGISTER || !(payload instanceof ProRegTX)) {
      throw new Error('Not a registration transaction')
    }
    if (payload.version !== PROTX_VERSION || payload.mode !== 0 || payload.netInfo != null ||
        payload.payouts != null || payload.shares != null || payload.joinSigs != null) {
      throw new Error('Only a v2 registration without shares is supported')
    }
    if (payload.payloadSig !== '') throw new Error('The registration is already signed')
    if (payload.type !== MASTERNODE_TYPE_CODE.Regular && payload.type !== MASTERNODE_TYPE_CODE.Evo) {
      throw new Error(`Unknown masternode type: ${payload.type}`)
    }
    return {transaction, payload}
  }

  // The payload's own fields, so a preview shows exactly what the hex carries.
  private registrationFromPayload(payload: ProRegTX, network: Network): ParsedMasternodeRegistration {
    const payoutAddress = payload.getPayoutAddress(network)
    if (payoutAddress == null) throw new Error('The registration has no payout address')
    return {
      type: payload.type === MASTERNODE_TYPE_CODE.Evo ? 'Evo' : 'Regular',
      collateral: {txid: payload.collateralOutpoint.txId, vout: payload.collateralOutpoint.vOut},
      serviceAddress: payload.ipAddress == null ? null : `${payload.ipAddress}:${payload.port}`,
      payoutAddress,
      operatorReward: payload.operatorReward,
      ownerAddress: payload.getOwnerAddress(network),
      votingAddress: payload.getVotingAddress(network),
      operatorPublicKey: requireBasicOperatorKey(payload.pubKeyOperator),
      platformNodeId: payload.platformNodeID ?? null,
      platformP2PPort: payload.platformP2PPort ?? null,
      platformHttpPort: payload.platformHTTPPort ?? null,
    }
  }

  private requireRegistrationInputs(
    transaction: Transaction,
    utxos: UTXO[],
    coin: UTXO,
    collaterals: MasternodeCollateral[],
    paths: Map<string, string>,
  ): {inputs: TransferInput[]; inputTotal: bigint} {
    const byOutpoint = new Map(utxos.map(utxo => [`${utxo.txId}:${utxo.vOut}`, utxo]))
    const seen = new Set<string>()
    let inputTotal = 0n
    const inputs: TransferInput[] = transaction.inputs.map(input => {
      const reference = `${input.txId}:${input.vOut}`
      if (seen.has(reference)) throw new Error('The registration spends an input twice')
      seen.add(reference)
      const utxo = byOutpoint.get(reference)
      if (utxo == null) throw new Error(`An input is not an unspent coin of this wallet: ${reference}`)
      if (utxo.height === 0) throw new Error('An input needs a confirmation first')
      if (utxo === coin) throw new Error('The collateral may not pay the registration fee')
      if (collaterals.some(row => row.txid === utxo.txId && row.vout === utxo.vOut)) {
        throw new Error('A masternode collateral may not pay the registration fee')
      }
      const derivationPath = paths.get(utxo.address)
      if (derivationPath == null) throw new Error(`No derivation path for address ${utxo.address}`)
      inputTotal += utxo.satoshis
      return {txId: utxo.txId, vOut: utxo.vOut, script: utxo.script, derivationPath, address: utxo.address}
    })
    if (inputs.length === 0) throw new Error('The registration has no coin to pay its fee')
    return {inputs, inputTotal}
  }

  private requireRegistrationChange(
    transaction: Transaction,
    paths: Map<string, string>,
    network: Network,
    collateralAddress: string,
  ): {changeAddress: string; changeDuffs: bigint} {
    if (transaction.outputs.length > 1) throw new Error('A registration pays its change and nothing else')
    if (transaction.outputs.length === 0) return {changeAddress: collateralAddress, changeDuffs: 0n}

    const [output] = transaction.outputs
    const address = output.script.getAddress(network)
    if (address == null || paths.get(address) == null) {
      throw new Error('The registration pays an address that is not this wallet\'s')
    }
    return {changeAddress: address, changeDuffs: output.satoshis}
  }

  private async registrationPlan(
    registration: MasternodeRegistration,
    provided: Pick<MasternodeRegistration, 'ownerAddress' | 'votingAddress' | 'operatorPublicKey'>,
    {network, keys, owned, provider, grouped, utxos, collaterals}: ProviderTxContext,
  ): Promise<MasternodeRegistrationPlan> {
    const coin = requireCollateral(utxos, collaterals, registration)
    const collateralPath = addressPaths(grouped).get(coin.address)
    if (collateralPath == null) throw new Error(`No derivation path for address ${coin.address}`)

    // One index for all three: a node not confirmed yet lists no owner key, so
    // the owner chain alone would hand out the index that node already took.
    const index = unusedKeyIndex(owned, ...MASTERNODE_KEY_CHAINS)
    const derived = (chain: MasternodeKeyChain): string => masternodeKeyDeriver(keys, network, chain).derive(index).address
    const ownerAddress = provided.ownerAddress ?? derived('owner')
    const votingAddress = provided.votingAddress ?? derived('voting')
    const operatorPublicKey = provided.operatorPublicKey ?? derived('operator')
    await this.requireFreeOperatorKey(operatorPublicKey, provider)
    requirePayout(registration.payoutAddress, ownerAddress, votingAddress)
    return {
      payload: this.coreTransactionService.proRegPayload(registration, {
        ownerKeyId: bytesToHex(sdkUtils.addressToPublicKeyHash(ownerAddress)),
        votingKeyId: bytesToHex(sdkUtils.addressToPublicKeyHash(votingAddress)),
        operatorPublicKey,
      }, network),
      signer: {kind: 'address', derivationPath: collateralPath, address: coin.address},
      // The sign step refuses an unconfirmed fee coin, so the preview must not pick one.
      spendable: utxos.filter(utxo => utxo !== coin && utxo.height > 0),
      ownerAddress,
      votingAddress,
      operatorPublicKey,
      ownerKeyIndex: provided.ownerAddress == null ? index : null,
      votingKeyIndex: provided.votingAddress == null ? index : null,
      operatorKeyIndex: provided.operatorPublicKey == null ? index : null,
    }
  }

  // The coins a provider transaction adds for its fee, priced against the
  // payload's signed size — the selection register and its preview share.
  private selectProviderInputs(plan: ProviderTxPlan, {grouped, collaterals}: ProviderTxContext): TransferInputSelection {
    const {coreFeeMultiplier} = this.preferences.general
    const feeForInputs = (inputsCount: number): bigint => {
      const fee = coreFeeDuffsFor(coreFeeMultiplier, inputsCount, 1, false, plan.payload.signedSize())
      // A provider payload is small, so its byte-priced fee can fall below what
      // peers relay. Floor it, and let input selection fund the difference.
      return fee < MIN_RELAY_FEE_DUFFS ? MIN_RELAY_FEE_DUFFS : fee
    }
    return selectTransferInputs(
      grouped,
      withoutCollaterals(plan.spendable, collaterals),
      DUST_THRESHOLD_DUFFS,
      feeForInputs,
    )
  }

  // A ProUpRegTx restates all three fields, so a kept one is the node's current value.
  async updateRegistrar(walletId: string, proTxHash: string, update: MasternodeRegistrarUpdate, password: string): Promise<MasternodeUpdateResult> {
    requireProTxHash(proTxHash)
    const {network: walletNetwork} = await requireWallet(this.walletDAO, walletId)
    if (update.operator.kind === 'external') requireBasicOperatorKey(update.operator.publicKey)
    if (update.voting.kind === 'external') this.coreTransactionService.requireP2pkhAddress(update.voting.address, walletNetwork, 'voting')
    if (update.payoutAddress != null) this.coreTransactionService.classifyAddress(update.payoutAddress, walletNetwork)
    return this.sendProviderTx(walletId, password, async context => {
      const {network, keys, owned, utxos} = context
      const node = ownerNode(owned, proTxHash)
      const owner = masternodeKeyDeriver(keys, network, 'owner').derive(node.ownerKeyIndex)

      const votingAddress = update.voting.kind === 'keep' ? node.votingAddress
        : update.voting.kind === 'wallet' ? masternodeKeyDeriver(keys, network, 'voting').derive(unusedKeyIndex(owned, 'voting')).address
        : update.voting.address
      this.coreTransactionService.requireP2pkhAddress(votingAddress, network, 'voting')
      if (votingAddress === node.collateralAddress) throw new Error('The voting key may not be the collateral address')

      const payoutAddress = requirePayout(update.payoutAddress ?? node.payeeAddress, owner.address, votingAddress)
      log.info(`update registrar ${proTxHash}: operator ${update.operator.kind}, voting ${update.voting.kind}, ` +
        `payout ${update.payoutAddress == null ? 'kept' : 'set'}`)

      return {
        payload: this.coreTransactionService.proUpRegPayload(proTxHash, await this.operatorKey(node, update.operator, context), votingAddress, payoutAddress, network),
        signer: {kind: 'address', derivationPath: owner.derivationPath, address: owner.address},
        spendable: utxos,
      }
    }, proTxHash)
  }

  // The operator signs. The key may be derived by this wallet or imported, so a
// shared node's service update works from the operator's own key. A node run by
// a hosting provider is updated by that provider.
  async updateService(walletId: string, proTxHash: string, update: MasternodeServiceUpdate, password: string): Promise<MasternodeUpdateResult> {
    requireProTxHash(proTxHash)
    const {network: walletNetwork} = await requireWallet(this.walletDAO, walletId)
    serviceAddressParts(update.serviceAddress, walletNetwork)
    if (update.operatorPayoutAddress != null) this.coreTransactionService.classifyAddress(update.operatorPayoutAddress, walletNetwork)
    return this.sendProviderTx(walletId, password, async ({network, owned, utxos, imported}, seed) => {
      const node = operatedNode(owned, proTxHash)
      const type = node.type === 'Evo' ? 'Evo' : 'Regular'
      requireServiceUpdate(type, update, network)
      const v24Active = this.walletSyncService.getListedMasternodes(network)?.v24Active ?? false
      const signer = await this.operatorSigner(walletId, node, imported, seed)
      log.info(`update service ${proTxHash}: ${type}, service ${update.serviceAddress}, operator ${signer.kind}`)
      return {
        payload: this.coreTransactionService.proUpServPayload(type, proTxHash, update, v24Active, network),
        signer,
        spendable: utxos,
      }
    }, proTxHash)
  }

  // Revoking resets the node's service and PoSe-bans it; only the owner's
  // ProUpRegTx with a new operator key brings it back.
  async revoke(walletId: string, proTxHash: string, reason: RevocationReason, password: string): Promise<MasternodeUpdateResult> {
    requireProTxHash(proTxHash)
    if (!(reason in REVOCATION_REASON_CODE)) throw new Error(`Unknown revocation reason: ${reason}`)
    return this.sendProviderTx(walletId, password, async ({owned, utxos, imported}, seed) => {
      const node = revocableNode(owned, proTxHash)
      const signer = await this.operatorSigner(walletId, node, imported, seed)
      log.info(`revoke ${proTxHash}: ${reason}, operator ${signer.kind}`)
      return {
        payload: this.coreTransactionService.proUpRevPayload(proTxHash, reason),
        signer,
        spendable: utxos,
      }
    }, proTxHash)
  }

  private async operatorSigner(walletId: string, node: Masternode, imported: ImportedMasternodeKey[], seed: Uint8Array): Promise<ProviderTxSigner> {
    if (node.operatorKeyIndex != null) return {kind: 'operator', index: node.operatorKeyIndex}
    const key = imported.find(entry => entry.role === 'operator' && entry.hasPrivateKey && carriesKey(node, entry))
    if (key == null) throw new Error("This wallet does not hold the masternode's operator key")
    const secret = await this.masternodeKeyDAO.getImportedKeySecret(walletId, 'operator', key.publicKey)
    if (secret == null) throw new Error("This wallet does not hold the masternode's operator key")
    return {kind: 'operatorSecret', secretKey: hexToBytes(decryptImportedKey(secret, seed))}
  }

  // Operator keys are unique across the list, so an external one is checked
  // against it; a wallet one is unused by construction.
  private async operatorKey(node: Masternode, choice: OperatorKeyChoice, {network, keys, owned, imported, provider}: ProviderTxContext): Promise<string> {
    const deriver = masternodeKeyDeriver(keys, network, 'operator')
    if (choice.kind === 'wallet') return deriver.derive(unusedKeyIndex(owned, 'operator')).address
    if (choice.kind === 'keep') {
      if (node.operatorKeyIndex != null) return deriver.derive(node.operatorKeyIndex).address
      return imported.find(key => key.role === 'operator' && carriesKey(node, key))?.publicKey
        ?? bytesToHex(bls.toBasicPublicKey(hexToBytes(node.operatorPublicKey)))
    }
    const publicKey = requireBasicOperatorKey(choice.publicKey)
    await this.requireFreeOperatorKey(publicKey, provider, node.proTxHash)
    return publicKey
  }

  // Core refuses a second node on one operator key. `except` is the node being
  // updated, which already carries it.
  private async requireFreeOperatorKey(publicKey: string, provider: WalletProvider, except?: string): Promise<void> {
    const listed = await provider.getMasternodes('operator', masternodeFilterValues('operator', publicKey))
    if (listed == null) throw new Error('The masternode list has not arrived yet')
    if (listed.some(entry => entry.proTxHash !== except)) throw new Error('Another masternode already uses this operator key')
  }

  // Everything a provider transaction is planned from. No seed: the provider keys
  // are the stored xpubs, so a preview resolves them too.
  private async providerTxContext(walletId: string): Promise<ProviderTxContext> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    if (!this.listed.has(walletId)) await this.discover(walletId)
    const owned = this.listed.get(walletId)
    if (owned == null) throw new Error('The masternode list has not arrived yet')
    const keys = await this.masternodeKeyDAO.getKeys(walletId)
    if (keys == null) throw new Error('Masternode keys are derived at the next password check')

    const provider = this.providers.forWallet(walletId, wallet.network)
    await provider.ensureReady()
    const [grouped, utxos, imported, collaterals] = await Promise.all([
      this.addressDAO.getAddressesByWalletId(walletId),
      provider.getWalletUtxos(),
      this.masternodeKeyDAO.getImportedKeys(walletId),
      this.masternodeDAO.getCollaterals(walletId),
    ])
    return {network: wallet.network, keys, owned, imported, provider, grouped, utxos, collaterals}
  }

  // The change is the only output, so it is what has to clear dust. `target` is
  // the node an update names: one no longer listed is dropped by every peer silently.
  private async sendProviderTx(
    walletId: string,
    password: string,
    plan: (context: ProviderTxContext, seed: Uint8Array) => Promise<ProviderTxPlan>,
    target?: string,
  ): Promise<MasternodeUpdateResult> {
    const context = await this.providerTxContext(walletId)
    const {network} = context
    const {tx, inputTotal} = await withUnlockedWallet(this.walletDAO, walletId, password, async ({seed}) => {
      if (target != null && !this.walletSyncService.getListedMasternodes(network)?.proTxHashes.has(target)) {
        this.walletSyncService.refreshListedMasternodes()
        throw new Error("The network's masternode list does not carry this node: its collateral was spent, or the list is still arriving")
      }
      const providerPlan = await plan(context, seed)
      const selection = this.selectProviderInputs(providerPlan, context)
      const tx = await this.coreTransactionService.buildSignedProviderTx({
        payload: providerPlan.payload,
        signer: providerPlan.signer,
        inputs: selection.transferInputs,
        changeAddress: selection.changeAddress,
        inputTotal: selection.inputTotal,
        feeDuffs: selection.feeDuffs,
        seed,
        network,
      })
      return {tx, inputTotal: selection.inputTotal}
    })

    return this.broadcastProviderTx(tx, inputTotal)
  }

  private async broadcastProviderTx(tx: Transaction, inputTotal: bigint): Promise<MasternodeUpdateResult> {
    const fee = inputTotal - tx.outputs.reduce((sum, output) => sum + output.satoshis, 0n)
    log.info(`provider tx ${tx.hash()} (type ${tx.type}, ${tx.inputs.length} input(s), fee ${fee} duffs): broadcasting`)
    // Peers drop an invalid tx without a reason, so the bytes are the only trace.
    const broadcast = await this.walletSyncService.broadcastTransaction(tx.hex()).catch(error => {
      log.error(`provider tx broadcast failed, rawtx: ${tx.hex()}`)
      throw error
    })
    log.info(`provider tx ${broadcast.txid} delivered to ${broadcast.peersDelivered.length} peer(s)`)
    return {
      txid: broadcast.txid,
      fee,
      peersAcked: broadcast.peersDelivered.length,
    }
  }

  // Leaves the stored collaterals as they are when the source has no masternode
  // list or a request fails, so a known collateral is never forgotten by an outage.
  async discover(walletId: string): Promise<void> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    const [keys, imported] = await Promise.all([
      this.masternodeKeyDAO.getKeys(walletId),
      this.masternodeKeyDAO.getImportedKeys(walletId),
    ])

    const provider = this.providers.forWallet(walletId, wallet.network)
    const collateral = collateralUtxos(await provider.getWalletUtxos())
    const found = await provider.getMasternodes('collateral', [...new Set(collateral.map(({address}) => address))])
    if (found == null) return

    const nodes: NetworkMasternode[] = [...found]
    const matches = {} as Record<MasternodeKeyFilter, Map<string, number>>
    const ownerIndexes = new Map<string, number>()
    for (const chain of MASTERNODE_WALKED_CHAINS) {
      const chainMatches = matches[chain] = new Map<string, number>()
      const importedValues = imported.filter(({role}) => role === chain)
        .flatMap(({publicKey}) => masternodeFilterValues(chain, publicKey))
      nodes.push(...await provider.getMasternodes(chain, importedValues) ?? [])
      // A wallet created before the key tables gets its keys at the next password check.
      if (keys == null) continue
      await runAddressWindow(masternodeKeyDeriver(keys, wallet.network, chain), {
        scan: async () => null,
        probe: async derived => {
          if (chain === 'owner') for (const {index, address} of derived) ownerIndexes.set(address, index)
          const listed = await provider.getMasternodes(chain, derived.flatMap(({address}) => masternodeFilterValues(chain, address))) ?? []
          nodes.push(...listed)
          const probeMatches = matchMasternodeKeys(chain, derived, listed)
          probeMatches.forEach((index, proTxHash) => chainMatches.set(proTxHash, index))
          const used = new Set(probeMatches.values())
          return derived.map(({index}) => ({index, isUsed: used.has(index)}))
        },
      }, memoryWindowStore(), MASTERNODE_KEY_WINDOW)
    }

    const candidates = ownedMasternodes(nodes, matches, imported, collateral, ownerIndexes)
    const now = Date.now()
    for (const {proTxHash} of candidates) if (!this.firstSeen.has(proTxHash)) this.firstSeen.set(proTxHash, now)
    const {existing, unsettled} = existingMasternodes(candidates, this.walletSyncService.getListedMasternodes(wallet.network), this.firstSeen)
    if (unsettled) this.walletSyncService.refreshListedMasternodes()
    const owned = await Promise.all(existing.map(node => this.withEvonodeStatus(node, wallet.network)))
    const stored = await this.masternodeDAO.getCollaterals(walletId)
    const followed = new Set(stored.filter(row => row.followed).map(({proTxHash}) => proTxHash))
    const followedNow = await provider.watchMasternodes(owned, owned.filter(({proTxHash}) => !followed.has(proTxHash)))
    await this.masternodeDAO.replaceCollaterals(walletId, collateralsToStore(owned, stored, followedNow))
    this.listed.set(walletId, owned)
    const pending = this.pendingIdentities.get(walletId)
    try {
      const keep = [...owned.map(({proTxHash}) => proTxHash), ...(pending ?? [])]
      await this.masternodeIdentityDAO.replace(walletId, masternodeIdentityRows(owned), keep)
    } catch (err) {
      log.warn(`wallet ${walletId}: node identities not stored:`, err)
    }
    for (const {proTxHash} of owned) pending?.delete(proTxHash)
    if (pending?.size === 0) this.pendingIdentities.delete(walletId)
    log.debug(`wallet ${walletId}: ${owned.length} masternode(s)`)
  }

  // A list without PoSe scores (p2p) leaves an evonode to report its own over
  // DAPI. Unverifiable, which is acceptable for a node the wallet holds a key of.
  private async withEvonodeStatus(node: Masternode, network: Network): Promise<Masternode> {
    if (node.type !== 'Evo' || node.posePenaltyScore != null || node.serviceAddress == null || node.platformHttpPort == null) return node
    const host = node.serviceAddress.slice(0, node.serviceAddress.lastIndexOf(':'))
    try {
      const {response} = await createCoreClient(`https://${host}:${node.platformHttpPort}`)
        .getMasternodeStatus({}, {timeout: EVONODE_STATUS_TIMEOUT_MS})
      return bytesToHex(response.proTxHash) === node.proTxHash ? {...node, posePenaltyScore: response.posePenalty} : node
    } catch (err) {
      log.debug(`${network} evonode ${node.proTxHash} did not report its status:`, err)
      return node
    }
  }
}
