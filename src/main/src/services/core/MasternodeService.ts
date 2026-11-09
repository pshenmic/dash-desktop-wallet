import {WalletDAO} from '../../database/WalletDAO'
import {MasternodeDAO} from '../../database/MasternodeDAO'
import {MasternodeKeyDAO} from '../../database/MasternodeKeyDAO'
import {WalletProviderFactory} from '../../providers/WalletProviderFactory'
import {MASTERNODE_KEY_CHAINS, MASTERNODE_KEY_WINDOW} from '../../constants/addresses'
import {Masternode, MasternodeKeyChain, NetworkMasternode} from '../../types/Masternode'
import {memoryWindowStore, runAddressWindow} from '../../utils/addressWindow'
import {masternodeKeyDeriver} from '../../utils/masternodeKeys'
import {collateralUtxos, masternodeFilterValues, matchMasternodeKeys, ownedMasternodes} from '../../utils/masternodes'
import {requireWallet} from '../../utils/requireWallet'
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

  async getMasternodes(walletId: string): Promise<Masternode[]> {
    return this.listed.get(walletId) ?? []
  }

  // Leaves the stored collaterals as they are when the source has no masternode
  // list or a request fails, so a known collateral is never forgotten by an outage.
  async discover(walletId: string): Promise<void> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    const keys = await this.masternodeKeyDAO.getKeys(walletId)
    if (keys == null) return

    const provider = this.providers.forWallet(walletId, wallet.network)
    const collateral = collateralUtxos(await provider.getWalletUtxos())
    const found = await provider.getMasternodes('collateral', [...new Set(collateral.map(({address}) => address))])
    if (found == null) return

    const nodes: NetworkMasternode[] = [...found]
    const matches = {} as Record<MasternodeKeyChain, Map<string, number>>
    for (const chain of MASTERNODE_KEY_CHAINS) {
      const chainMatches = matches[chain] = new Map<string, number>()
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

    const owned = ownedMasternodes(nodes, matches, collateral)
    await this.masternodeDAO.replaceCollaterals(walletId, owned.map(({proTxHash, collateralTxid, collateralVout}) =>
      ({proTxHash, txid: collateralTxid, vout: collateralVout})))
    this.listed.set(walletId, owned)
    log.debug(`wallet ${walletId}: ${owned.length} masternode(s)`)
  }
}
