import type {Block} from 'dash-core-sdk'
import type {Message, MnListDiff, Peer, SimplifiedMNListEntry} from 'dash-core-p2p'
import {MASTERNODE_MIN_CONFIRMATIONS, MNLIST_PENDING_REFRESH_MS, MNLIST_REFRESH_MS, REGISTRATION_BLOCKS_INFLIGHT} from '../constants'
import {PeerRotation} from '../net/peerRotation'
import type {ChainStore} from '../store/ChainStore'
import type {MasternodeListOptions, PayoutUpdate, ProviderRegistration} from '../types/masternodeList'
import {displayHexToWire} from '../utils/byteOrder'
import {listCommitted, listedMasternode, providerRegistration} from '../utils/masternodeList'
import {txsMatchMerkleRoot} from '../utils/merkle'
import {hashHeaderRaw} from '../utils/pow'
import {BlockFetcher} from './blockFetcher'
import {Logger} from '../../src/utils/logger'

const log = new Logger('p2p')

// The masternode list as the wallet sees it: each verified full list joined with
// what every node's ProRegTx committed to, which the list itself does not carry.
// A registration is read once from the block confirmedHash points below and kept
// in chain.db, so only nodes new since the last list cost a block.
export class ProviderRegistry {
  private store: ChainStore | null = null
  private registrations = new Map<string, ProviderRegistration>()
  private entries: SimplifiedMNListEntry[] | null = null
  private acceptedAt = 0
  private fetcher: BlockFetcher | null = null
  // Block hash (display) → height and the registrations it holds.
  private wanted = new Map<string, {height: number; proTxHashes: string[]}>()
  private queue: string[] = []
  // Not where confirmedHash says, so not asked again this session.
  private unresolvable = new Set<string>()
  // The last list held a node whose registration could not be read yet.
  private pending = false
  private offering = false

  constructor(private readonly opts: MasternodeListOptions) {}

  get due(): boolean {
    return !this.offering && this.wanted.size === 0 &&
      Date.now() - this.acceptedAt >= (this.pending ? MNLIST_PENDING_REFRESH_MS : MNLIST_REFRESH_MS)
  }

  // A full list only counts once our own chain proves it; one the header sync has
  // not reached yet is dropped, and the next tip asks again. Several peers answer
  // the same request, so a second list arriving mid-offer is turned away.
  async offer(diff: MnListDiff): Promise<void> {
    const store = this.opts.chain()
    const height = diff.coinbaseHeight
    // A quorum diff from followTip races the full list; it must not hold the slot.
    if (store == null || height == null || /[^0]/.test(diff.baseBlockHash) || !this.due) return
    this.offering = true
    try {
      await this.index(diff, store, height)
    } finally {
      this.offering = false
    }
  }

  private async index(diff: MnListDiff, store: ChainStore, height: number): Promise<void> {
    const header = await store.getHeaderByHeight(height)
    if (header == null || !listCommitted(diff, header) || !await this.load(store)) return
    this.acceptedAt = Date.now()
    this.entries = diff.mnList

    const listed = new Set(diff.mnList.map(({proRegTxHash}) => proRegTxHash))
    const gone = [...this.registrations.keys()].filter(proTxHash => !listed.has(proTxHash))
    for (const proTxHash of gone) this.registrations.delete(proTxHash)
    await store.writeRegistrations(new Map(), gone)

    const missing = diff.mnList.filter(({proRegTxHash}) => !this.registrations.has(proRegTxHash) && !this.unresolvable.has(proRegTxHash))
    // Not confirmed yet: no block to look for, and a hash the walk down the chain
    // could never find would stop it ending early.
    const confirmed = missing.filter(({confirmedHash}) => /[^0]/.test(confirmedHash))
    const confirmedWire = (entry: SimplifiedMNListEntry): string => Buffer.from(displayHexToWire(entry.confirmedHash)).toString('hex')
    const heights = await store.findHeights(new Set(confirmed.map(confirmedWire)), height)
    this.pending = confirmed.length < missing.length
    for (const entry of confirmed) {
      const confirmedAt = heights.get(confirmedWire(entry))
      const registeredAt = confirmedAt == null ? null : confirmedAt - MASTERNODE_MIN_CONFIRMATIONS[store.network]
      const registeredHeader = registeredAt == null ? null : await store.getHeaderByHeight(registeredAt)
      if (registeredAt == null || registeredHeader == null) {
        this.pending = true
        continue
      }
      const blockHash = hashHeaderRaw(registeredHeader)
      const block = this.wanted.get(blockHash) ?? {height: registeredAt, proTxHashes: []}
      block.proTxHashes.push(entry.proRegTxHash)
      this.wanted.set(blockHash, block)
    }
    const indexing = [...this.wanted.values()].reduce((n, {proTxHashes}) => n + proTxHashes.length, 0)
    if (indexing > 0) log.info(`indexing ${indexing} masternode registration(s) from ${this.wanted.size} block(s)`)
    this.queue = [...this.wanted.keys()]
    this.pump()
    this.emitIfSettled()
  }

  onBlock = (peer: Peer, msg: Message & {block?: unknown}): void => {
    const block = msg.block as Block | undefined
    const hashWire = block == null ? null : displayHexToWire(block.hash())
    const fetcher = this.fetcher
    if (block == null || hashWire == null || fetcher == null || !fetcher.owns(hashWire)) return
    if (!txsMatchMerkleRoot(block)) {
      fetcher.reject(hashWire)
      return
    }
    if (fetcher.receive(peer, hashWire) == null) return
    this.apply(block).catch(err => log.warn('registration index write failed:', err))
  }

  owns(hashWire: Uint8Array): boolean {
    return this.fetcher?.owns(hashWire) ?? false
  }

  async applyPayouts(updates: PayoutUpdate[]): Promise<void> {
    const store = this.opts.chain()
    if (store == null || !await this.load(store)) return
    const changed = new Map<string, ProviderRegistration>()
    // A rescan replays changes already kept, so only one above the last is new.
    for (const {proTxHash, payoutAddress, height} of updates) {
      const registration = changed.get(proTxHash) ?? this.registrations.get(proTxHash)
      if (registration == null || height <= registration.payouts.at(-1)!.height) continue
      changed.set(proTxHash, {...registration, payouts: [...registration.payouts, {height, address: payoutAddress}]})
    }
    if (changed.size === 0) return
    changed.forEach((registration, proTxHash) => this.registrations.set(proTxHash, registration))
    await store.writeRegistrations(changed)
    this.emitIfSettled()
  }

  // A registration from a block that left our chain is read again; a payout
  // change from one is dropped, and the scan re-applies it if it was mined again.
  async rewound(height: number): Promise<void> {
    const gone: string[] = []
    const trimmed = new Map<string, ProviderRegistration>()
    for (const [proTxHash, registration] of this.registrations) {
      if (registration.height > height) {
        gone.push(proTxHash)
      } else if (registration.payouts.at(-1)!.height > height) {
        trimmed.set(proTxHash, {...registration, payouts: registration.payouts.filter(payout => payout.height <= height)})
      }
    }
    for (const proTxHash of gone) this.registrations.delete(proTxHash)
    trimmed.forEach((registration, proTxHash) => this.registrations.set(proTxHash, registration))
    this.acceptedAt = 0
    await this.store?.writeRegistrations(trimmed, gone)
  }

  // Called before the new pool exists, so the next fetch builds its fetcher.
  resetPool(): void {
    this.fetcher?.stop()
    this.fetcher = null
    this.wanted.clear()
    this.queue = []
    this.acceptedAt = 0
  }

  closeChain(): void {
    this.store = null
    this.registrations = new Map()
    this.entries = null
    this.wanted.clear()
    this.queue = []
    this.acceptedAt = 0
    this.fetcher?.reset()
  }

  // False when chain.db changed while the index was read.
  private async load(store: ChainStore): Promise<boolean> {
    if (store !== this.store) {
      const registrations = await store.getRegistrations()
      if (store !== this.opts.chain()) return false
      this.store = store
      // An entry without a payout history is from an older layout: read it again.
      this.registrations = new Map([...registrations].filter(([, registration]) => Array.isArray(registration.payouts)))
    }
    return true
  }

  private pump(): void {
    const pool = this.opts.pool()
    if (this.fetcher == null && pool != null) {
      this.fetcher = new BlockFetcher({rotation: new PeerRotation(() => pool.readyPeers), messages: pool.messages})
    }
    while (this.fetcher != null && this.fetcher.size < REGISTRATION_BLOCKS_INFLIGHT && this.queue.length > 0) {
      const blockHash = this.queue.shift()!
      this.fetcher.request(this.wanted.get(blockHash)!.height, displayHexToWire(blockHash))
    }
  }

  private async apply(block: Block): Promise<void> {
    const store = this.store
    const wanted = this.wanted.get(block.hash())
    if (store == null || wanted == null) return
    this.wanted.delete(block.hash())
    const found = new Map<string, ProviderRegistration>()
    for (const proTxHash of wanted.proTxHashes) {
      const tx = block.txs.find(candidate => candidate.hash() === proTxHash)
      const registration = tx == null ? null : providerRegistration(tx, proTxHash, wanted.height, store.network)
      if (registration == null) {
        log.warn(`masternode ${proTxHash} has no ProRegTx in block ${wanted.height}`)
        this.unresolvable.add(proTxHash)
      } else {
        found.set(proTxHash, registration)
      }
    }
    if (store !== this.store) return
    found.forEach((registration, proTxHash) => this.registrations.set(proTxHash, registration))
    await store.writeRegistrations(found)
    this.pump()
    this.emitIfSettled()
  }

  private emitIfSettled(): void {
    const store = this.store
    if (store == null || this.entries == null || this.wanted.size > 0) return
    this.opts.events.masternodeList(store.network,
      this.entries.map(entry => listedMasternode(entry, this.registrations.get(entry.proRegTxHash), store.network)))
  }
}
