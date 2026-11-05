import {WalletDAO} from '../../database/WalletDAO'
import {MasternodeDAO} from '../../database/MasternodeDAO'
import {MasternodeKeyDAO} from '../../database/MasternodeKeyDAO'
import {WalletProviderFactory} from '../../providers/WalletProviderFactory'
import {MASTERNODE_KEY_CHAINS, MASTERNODE_KEY_WINDOW} from '../../constants/addresses'
import {ImportedMasternodeKey, Masternode, MasternodeKeyChain, NetworkMasternode} from '../../types/Masternode'
import {memoryWindowStore, runAddressWindow} from '../../utils/addressWindow'
import {masternodeKeyDeriver, masternodePublicKey} from '../../utils/masternodeKeys'
import {carriesKey, collateralUtxos, masternodeFilterValues, matchMasternodeKeys, ownedMasternodes} from '../../utils/masternodes'
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
  // Live network state, so only the last run's answer is kept, in memory.
  private listed = new Map<string, Masternode[]>()

  constructor(walletDAO: WalletDAO, masternodeKeyDAO: MasternodeKeyDAO, masternodeDAO: MasternodeDAO, providers: WalletProviderFactory) {
    this.walletDAO = walletDAO
    this.masternodeKeyDAO = masternodeKeyDAO
    this.masternodeDAO = masternodeDAO
    this.providers = providers
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
    const followed = new Set(await this.masternodeDAO.getProTxHashes(walletId))
    await provider.watchMasternodes(owned, owned.filter(({proTxHash}) => !followed.has(proTxHash)))
    await this.masternodeDAO.replaceCollaterals(walletId, owned.flatMap(({proTxHash, collateralTxid, collateralVout}) =>
      collateralTxid == null || collateralVout == null ? [] : [{proTxHash, txid: collateralTxid, vout: collateralVout}]))
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
