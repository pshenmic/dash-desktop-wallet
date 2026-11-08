import {utils as sdkUtils} from 'dash-core-sdk'
import {AddressDAO} from '../../database/AddressDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {MasternodeDAO} from '../../database/MasternodeDAO'
import {MasternodeKeyDAO} from '../../database/MasternodeKeyDAO'
import {WalletProviderFactory} from '../../providers/WalletProviderFactory'
import {MASTERNODE_KEY_CHAINS, MASTERNODE_KEY_WINDOW} from '../../constants/addresses'
import {DUFFS_PER_DASH, DUST_THRESHOLD_DUFFS, MASTERNODE_COLLATERAL_DUFFS} from '../../constants/chain'
import {Preferences} from '../../preferences'
import {
  ImportedMasternodeKey,
  Masternode,
  MasternodeKeyChain,
  MasternodeRegistration,
  MasternodeRegistrationResult,
  NetworkMasternode,
} from '../../types/Masternode'
import {memoryWindowStore, runAddressWindow} from '../../utils/addressWindow'
import {coreFeeDuffsFor} from '../../utils/coreFeeRate'
import {masternodeKeyDeriver, masternodePublicKey} from '../../utils/masternodeKeys'
import {
  carriesKey,
  collateralsToStore,
  collateralUtxos,
  masternodeFilterValues,
  matchMasternodeKeys,
  ownedMasternodes,
  unusedKeyIndex,
  withoutCollaterals,
} from '../../utils/masternodes'
import {proRegPayloadBytes, requireRegistrationFields} from '../../utils/proRegTx'
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
    await this.discover(walletId)
    return this.listed.get(walletId)?.filter(node => carriesKey(node, key)) ?? null
  }

  async removeKey(walletId: string, key: ImportedMasternodeKey): Promise<void> {
    await this.masternodeKeyDAO.removeImportedKey(walletId, key)
    await this.discover(walletId)
  }

  // A registration still unmined is in no list, so one made before it is mined
  // takes the same keys and is refused by consensus as a duplicate.
  async register(walletId: string, registration: MasternodeRegistration, password: string): Promise<MasternodeRegistrationResult> {
    requireRegistrationFields(registration)
    if (!this.listed.has(walletId)) await this.discover(walletId)
    const owned = this.listed.get(walletId)
    if (owned == null) throw new Error('The masternode list has not arrived yet')
    const keys = await this.masternodeKeyDAO.getKeys(walletId)
    if (keys == null) throw new Error('Masternode keys are derived at the next password check')

    const {tx, inputTotal} = await withUnlockedWallet(this.walletDAO, walletId, password, async ({wallet, seed}) => {
      const {network} = wallet
      const provider = this.providers.forWallet(walletId, network)
      await provider.ensureReady()
      const [grouped, utxos, collaterals] = await Promise.all([
        this.addressDAO.getAddressesByWalletId(walletId),
        provider.getWalletUtxos(),
        this.masternodeDAO.getCollaterals(walletId),
      ])

      const {txid, vout} = registration.collateral
      const coin = utxos.find(({txId, vOut}) => txId === txid && vOut === vout)
      if (coin == null) throw new Error('The collateral is not an unspent coin of this wallet')
      if (coin.satoshis !== MASTERNODE_COLLATERAL_DUFFS[registration.type]) {
        throw new Error(`A ${registration.type} masternode's collateral is exactly ${MASTERNODE_COLLATERAL_DUFFS[registration.type] / DUFFS_PER_DASH} DASH`)
      }
      if (collaterals.some(row => row.txid === txid && row.vout === vout)) throw new Error('This coin is already a masternode collateral')
      const collateralPath = addressPaths(grouped).get(coin.address)
      if (collateralPath == null) throw new Error(`No derivation path for address ${coin.address}`)

      const derived = (chain: MasternodeKeyChain): string => masternodeKeyDeriver(keys, network, chain).derive(unusedKeyIndex(owned, chain)).address
      const keyId = (chain: MasternodeKeyChain): string => bytesToHex(sdkUtils.addressToPublicKeyHash(derived(chain)))
      const payload = this.coreTransactionService.proRegPayload(registration, {
        ownerKeyId: keyId('owner'),
        votingKeyId: keyId('voting'),
        operatorPublicKey: derived('operator'),
      }, network)

      // The change is the only output, so it is what has to clear dust.
      const {coreFeeMultiplier} = this.preferences.general
      const {transferInputs, inputTotal, changeAddress, feeDuffs} = selectTransferInputs(
        grouped,
        withoutCollaterals(utxos.filter(utxo => utxo !== coin), collaterals),
        DUST_THRESHOLD_DUFFS,
        inputsCount => coreFeeDuffsFor(coreFeeMultiplier, inputsCount, 1, false, proRegPayloadBytes(payload)),
      )
      const tx = await this.coreTransactionService.buildSignedProRegTx({
        payload,
        collateral: {txId: coin.txId, vOut: coin.vOut, script: coin.script, derivationPath: collateralPath, address: coin.address},
        inputs: transferInputs,
        changeAddress,
        inputTotal,
        feeDuffs,
        seed,
        network,
      })
      return {tx, inputTotal}
    })

    const broadcast = await this.walletSyncService.broadcastTransaction(tx.hex())
    return {
      proTxHash: broadcast.txid,
      fee: inputTotal - tx.outputs.reduce((sum, output) => sum + output.satoshis, 0n),
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

    const owned = await Promise.all(ownedMasternodes(nodes, matches, imported, collateral)
      .map(node => this.withEvonodeStatus(node, wallet.network)))
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
