import {utils as sdkUtils} from 'dash-core-sdk'
import {AddressDAO} from '../../database/AddressDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {MasternodeDAO} from '../../database/MasternodeDAO'
import {MasternodeKeyDAO} from '../../database/MasternodeKeyDAO'
import {WalletProviderFactory} from '../../providers/WalletProviderFactory'
import {MASTERNODE_KEY_CHAINS, MASTERNODE_KEY_WINDOW} from '../../constants/addresses'
import {DUFFS_PER_DASH, DUST_THRESHOLD_DUFFS, MASTERNODE_COLLATERAL_DUFFS, REVOCATION_REASON_CODE} from '../../constants/chain'
import {Preferences} from '../../preferences'
import {
  ImportedMasternodeKey,
  Masternode,
  MasternodeKeyChain,
  MasternodeRegistrarUpdate,
  MasternodeRegistration,
  MasternodeRegistrationResult,
  MasternodeServiceUpdate,
  MasternodeUpdateResult,
  NetworkMasternode,
  OperatorKeyChoice,
  ProviderTxContext,
  ProviderTxPlan,
  RevocationReason,
} from '../../types/Masternode'
import {memoryWindowStore, runAddressWindow} from '../../utils/addressWindow'
import {coreFeeDuffsFor} from '../../utils/coreFeeRate'
import {basicOperatorKey, masternodeKeyDeriver, masternodePublicKey, requireBasicOperatorKey} from '../../utils/masternodeKeys'
import {
  carriesKey,
  collateralsToStore,
  collateralUtxos,
  existingMasternodes,
  masternodeFilterValues,
  matchMasternodeKeys,
  operatedNode,
  ownedMasternodes,
  unusedKeyIndex,
  withoutCollaterals,
} from '../../utils/masternodes'
import {
  providerPayloadBytes,
  requireProTxHash,
  requireRegistrationFields,
  requireServiceUpdate,
  serviceAddressParts,
} from '../../utils/providerTx'
import {addressPaths, selectTransferInputs} from '../../utils/transferInputs'
import {withUnlockedWallet} from '../../utils/walletSeed'
import {CoreTransactionService} from './CoreTransactionService'
import {WalletSyncService} from './WalletSyncService'
import {requireWallet} from '../../utils/requireWallet'
import {bytesToHex} from '@noble/hashes/utils.js'
import createCoreClient from 'dash-core-sdk/src/createCoreClient.js'
import {EVONODE_STATUS_TIMEOUT_MS} from '../../constants/dapi'
import {Network} from '../../types/Network'
import {Logger} from '../../utils/logger'

const log = new Logger('masternodes')

export class MasternodeService {
  private walletDAO: WalletDAO
  private masternodeKeyDAO: MasternodeKeyDAO
  private masternodeDAO: MasternodeDAO
  private providers: WalletProviderFactory
  private addressDAO: AddressDAO
  private coreTransactionService: CoreTransactionService
  private walletSyncService: WalletSyncService
  private preferences: Preferences
  // Live network state, so only the last run's answer is kept, in memory.
  private listed = new Map<string, Masternode[]>()
  // When discovery first found each node, which a list must postdate to drop it.
  private firstSeen = new Map<string, number>()

  constructor(
    walletDAO: WalletDAO,
    masternodeKeyDAO: MasternodeKeyDAO,
    masternodeDAO: MasternodeDAO,
    providers: WalletProviderFactory,
    addressDAO: AddressDAO,
    coreTransactionService: CoreTransactionService,
    walletSyncService: WalletSyncService,
    preferences: Preferences,
  ) {
    this.walletDAO = walletDAO
    this.masternodeKeyDAO = masternodeKeyDAO
    this.masternodeDAO = masternodeDAO
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

  async getImportedKeys(walletId: string): Promise<ImportedMasternodeKey[]> {
    return this.masternodeKeyDAO.getImportedKeys(walletId)
  }

  // Kept even when no node carries it yet, so a later registration is found.
  // Answers the listed nodes that carry it, or null while no list has arrived to
  // search — p2p before its first proven list — which is not "none".
  async importKey(walletId: string, role: MasternodeKeyChain, privateKey: string): Promise<Masternode[] | null> {
    if (!MASTERNODE_KEY_CHAINS.includes(role)) throw new Error(`Unknown masternode key role: ${role}`)
    const wallet = await requireWallet(this.walletDAO, walletId)
    const key = {role, publicKey: masternodePublicKey(role, privateKey.trim(), wallet.network)}
    await this.masternodeKeyDAO.saveImportedKey(walletId, key)
    log.info(`wallet ${walletId}: imported a ${role} key`)
    await this.discover(walletId)
    return this.listed.get(walletId)?.filter(node => carriesKey(node, key)) ?? null
  }

  async removeKey(walletId: string, key: ImportedMasternodeKey): Promise<void> {
    await this.masternodeKeyDAO.removeImportedKey(walletId, key)
    log.info(`wallet ${walletId}: removed a ${key.role} key`)
    await this.discover(walletId)
  }

  // A registration still unmined is in no list, so one made before it is mined
  // takes the same keys and is refused by consensus as a duplicate.
  async register(walletId: string, registration: MasternodeRegistration, password: string): Promise<MasternodeRegistrationResult> {
    const {network: walletNetwork} = await requireWallet(this.walletDAO, walletId)
    requireRegistrationFields(registration, walletNetwork)
    this.coreTransactionService.classifyAddress(registration.payoutAddress, walletNetwork)
    const {txid, fee, peersAcked} = await this.sendProviderTx(walletId, password, async ({network, keys, owned, grouped, utxos, collaterals}) => {
      const {txid, vout} = registration.collateral
      const coin = utxos.find(({txId, vOut}) => txId === txid && vOut === vout)
      if (coin == null) throw new Error('The collateral is not an unspent coin of this wallet')
      // Core checks a collateral against the UTXO set alone, never the mempool.
      if (coin.height === 0) throw new Error('The collateral needs a confirmation first: Core does not accept a mempool output as collateral')
      if (coin.satoshis !== MASTERNODE_COLLATERAL_DUFFS[registration.type]) {
        throw new Error(`A ${registration.type} masternode's collateral is exactly ${MASTERNODE_COLLATERAL_DUFFS[registration.type] / DUFFS_PER_DASH} DASH`)
      }
      if (collaterals.some(row => row.txid === txid && row.vout === vout)) throw new Error('This coin is already a masternode collateral')
      const collateralPath = addressPaths(grouped).get(coin.address)
      if (collateralPath == null) throw new Error(`No derivation path for address ${coin.address}`)

      const derived = (chain: MasternodeKeyChain): string => masternodeKeyDeriver(keys, network, chain).derive(unusedKeyIndex(owned, chain)).address
      const keyId = (chain: MasternodeKeyChain): string => bytesToHex(sdkUtils.addressToPublicKeyHash(derived(chain)))
      if ([derived('owner'), derived('voting')].includes(registration.payoutAddress)) throw new Error('The payout may not pay the owner or voting key')
      log.info(`register ${registration.type} on ${txid}:${vout}: wallet keys owner #${unusedKeyIndex(owned, 'owner')}, ` +
        `voting #${unusedKeyIndex(owned, 'voting')}, operator #${unusedKeyIndex(owned, 'operator')}, service ${registration.serviceAddress ?? 'none'}`)
      return {
        payload: this.coreTransactionService.proRegPayload(registration, {
          ownerKeyId: keyId('owner'),
          votingKeyId: keyId('voting'),
          operatorPublicKey: derived('operator'),
        }, network),
        signer: {kind: 'address', derivationPath: collateralPath, address: coin.address},
        spendable: utxos.filter(utxo => utxo !== coin),
      }
    })
    return {proTxHash: txid, fee, peersAcked}
  }

  // A ProUpRegTx restates all three fields, so a kept one is the node's current value.
  async updateRegistrar(walletId: string, proTxHash: string, update: MasternodeRegistrarUpdate, password: string): Promise<MasternodeUpdateResult> {
    requireProTxHash(proTxHash)
    const {network: walletNetwork} = await requireWallet(this.walletDAO, walletId)
    if (update.operator.kind === 'external') requireBasicOperatorKey(update.operator.publicKey)
    if (update.voting.kind === 'external' && this.coreTransactionService.classifyAddress(update.voting.address, walletNetwork) !== 'p2pkh') {
      throw new Error('A voting key is a P2PKH address')
    }
    if (update.payoutAddress != null) this.coreTransactionService.classifyAddress(update.payoutAddress, walletNetwork)
    return this.sendProviderTx(walletId, password, async context => {
      const {network, keys, owned, utxos} = context
      const node = owned.find(entry => entry.proTxHash === proTxHash)
      if (node == null) throw new Error('Not a masternode of this wallet')
      if (node.ownerKeyIndex == null) throw new Error("This wallet does not derive the masternode's owner key")
      const owner = masternodeKeyDeriver(keys, network, 'owner').derive(node.ownerKeyIndex)

      const votingAddress = update.voting.kind === 'keep' ? node.votingAddress
        : update.voting.kind === 'wallet' ? masternodeKeyDeriver(keys, network, 'voting').derive(unusedKeyIndex(owned, 'voting')).address
        : update.voting.address
      if (this.coreTransactionService.classifyAddress(votingAddress, network) !== 'p2pkh') throw new Error('A voting key is a P2PKH address')
      if (votingAddress === node.collateralAddress) throw new Error('The voting key may not be the collateral address')

      const payoutAddress = update.payoutAddress ?? node.payeeAddress
      if (payoutAddress == null) throw new Error('The current payout is not known yet; pass a payout address')
      if (payoutAddress === owner.address || payoutAddress === votingAddress) throw new Error('The payout may not pay the owner or voting key')
      log.info(`update registrar ${proTxHash}: operator ${update.operator.kind}, voting ${update.voting.kind}, ` +
        `payout ${update.payoutAddress == null ? 'kept' : 'set'}`)

      return {
        payload: this.coreTransactionService.proUpRegPayload(proTxHash, await this.operatorKey(node, update.operator, context), votingAddress, payoutAddress, network),
        signer: {kind: 'address', derivationPath: owner.derivationPath, address: owner.address},
        spendable: utxos,
      }
    }, proTxHash)
  }

  // The operator signs, so only a node whose operator key the wallet derives;
  // one run by a hosting provider is updated by that provider.
  async updateService(walletId: string, proTxHash: string, update: MasternodeServiceUpdate, password: string): Promise<MasternodeUpdateResult> {
    requireProTxHash(proTxHash)
    const {network: walletNetwork} = await requireWallet(this.walletDAO, walletId)
    serviceAddressParts(update.serviceAddress, walletNetwork)
    if (update.operatorPayoutAddress != null) this.coreTransactionService.classifyAddress(update.operatorPayoutAddress, walletNetwork)
    return this.sendProviderTx(walletId, password, async ({network, owned, utxos}) => {
      const node = operatedNode(owned, proTxHash)
      const type = node.type === 'Evo' ? 'Evo' : 'Regular'
      requireServiceUpdate(type, update, network)
      log.info(`update service ${proTxHash}: ${type}, service ${update.serviceAddress}, operator key #${node.operatorKeyIndex}`)
      return {
        payload: this.coreTransactionService.proUpServPayload(type, proTxHash, update, network),
        signer: {kind: 'operator', index: node.operatorKeyIndex},
        spendable: utxos,
      }
    }, proTxHash)
  }

  // Revoking resets the node's service and PoSe-bans it; only the owner's
  // ProUpRegTx with a new operator key brings it back.
  async revoke(walletId: string, proTxHash: string, reason: RevocationReason, password: string): Promise<MasternodeUpdateResult> {
    requireProTxHash(proTxHash)
    if (!(reason in REVOCATION_REASON_CODE)) throw new Error(`Unknown revocation reason: ${reason}`)
    return this.sendProviderTx(walletId, password, async ({owned, utxos}) => {
      const {operatorKeyIndex} = operatedNode(owned, proTxHash)
      log.info(`revoke ${proTxHash}: ${reason}, operator key #${operatorKeyIndex}`)
      return {
        payload: this.coreTransactionService.proUpRevPayload(proTxHash, reason),
        signer: {kind: 'operator', index: operatorKeyIndex},
        spendable: utxos,
      }
    }, proTxHash)
  }

  // Operator keys are unique across the list, so an external one is checked
  // against it; a wallet one is unused by construction.
  private async operatorKey(node: Masternode, choice: OperatorKeyChoice, {network, keys, owned, imported, provider}: ProviderTxContext): Promise<string> {
    const deriver = masternodeKeyDeriver(keys, network, 'operator')
    if (choice.kind === 'wallet') return deriver.derive(unusedKeyIndex(owned, 'operator')).address
    if (choice.kind === 'keep') {
      if (node.operatorKeyIndex != null) return deriver.derive(node.operatorKeyIndex).address
      return imported.find(key => key.role === 'operator' && carriesKey(node, key))?.publicKey ?? basicOperatorKey(node.operatorPublicKey)
    }
    const publicKey = requireBasicOperatorKey(choice.publicKey)
    const listed = await provider.getMasternodes('operator', masternodeFilterValues('operator', publicKey))
    if (listed == null) throw new Error('The masternode list has not arrived yet')
    if (listed.some(entry => entry.proTxHash !== node.proTxHash)) throw new Error('Another masternode already uses this operator key')
    return publicKey
  }

  // Both kinds pay their fee from the wallet's ordinary coins, with the change as
  // their only output, so the change is what has to clear dust.
  // An update names a node that must still exist, or every peer drops it silently.
  private async sendProviderTx(
    walletId: string,
    password: string,
    plan: (context: ProviderTxContext) => Promise<ProviderTxPlan>,
    target?: string,
  ): Promise<MasternodeUpdateResult> {
    if (!this.listed.has(walletId)) await this.discover(walletId)
    const owned = this.listed.get(walletId)
    if (owned == null) throw new Error('The masternode list has not arrived yet')
    const keys = await this.masternodeKeyDAO.getKeys(walletId)
    if (keys == null) throw new Error('Masternode keys are derived at the next password check')

    const {tx, inputTotal} = await withUnlockedWallet(this.walletDAO, walletId, password, async ({wallet, seed}) => {
      const {network} = wallet
      if (target != null && !this.walletSyncService.getListedMasternodes(network)?.proTxHashes.has(target)) {
        this.walletSyncService.refreshListedMasternodes()
        throw new Error("The network's masternode list does not carry this node: its collateral was spent, or the list is still arriving")
      }
      const provider = this.providers.forWallet(walletId, network)
      await provider.ensureReady()
      const [grouped, utxos, imported, collaterals] = await Promise.all([
        this.addressDAO.getAddressesByWalletId(walletId),
        provider.getWalletUtxos(),
        this.masternodeKeyDAO.getImportedKeys(walletId),
        this.masternodeDAO.getCollaterals(walletId),
      ])
      const {payload, signer, spendable} = await plan({network, keys, owned, imported, provider, grouped, utxos, collaterals})

      const {coreFeeMultiplier} = this.preferences.general
      const {transferInputs, inputTotal, changeAddress, feeDuffs} = selectTransferInputs(
        grouped,
        withoutCollaterals(spendable, collaterals),
        DUST_THRESHOLD_DUFFS,
        inputsCount => coreFeeDuffsFor(coreFeeMultiplier, inputsCount, 1, false, providerPayloadBytes(payload)),
      )
      const tx = await this.coreTransactionService.buildSignedProviderTx({
        payload, signer, inputs: transferInputs, changeAddress, inputTotal, feeDuffs, seed, network,
      })
      return {tx, inputTotal}
    })

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
    const matches = {} as Record<MasternodeKeyChain, Map<string, number>>
    for (const chain of MASTERNODE_KEY_CHAINS) {
      const chainMatches = matches[chain] = new Map<string, number>()
      const importedValues = imported.filter(({role}) => role === chain)
        .flatMap(({publicKey}) => masternodeFilterValues(chain, publicKey))
      nodes.push(...await provider.getMasternodes(chain, importedValues) ?? [])
      // A wallet created before the key tables gets its keys at the next password check.
      if (keys == null) continue
      await runAddressWindow(masternodeKeyDeriver(keys, wallet.network, chain), {
        scan: async () => null,
        probe: async derived => {
          const listed = await provider.getMasternodes(chain, derived.flatMap(({address}) => masternodeFilterValues(chain, address))) ?? []
          nodes.push(...listed)
          const probeMatches = matchMasternodeKeys(chain, derived, listed)
          probeMatches.forEach((index, proTxHash) => chainMatches.set(proTxHash, index))
          const used = new Set(probeMatches.values())
          return derived.map(({index}) => ({index, isUsed: used.has(index)}))
        },
      }, memoryWindowStore(), MASTERNODE_KEY_WINDOW)
    }

    const candidates = ownedMasternodes(nodes, matches, imported, collateral)
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
