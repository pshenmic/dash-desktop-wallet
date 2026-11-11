import type {Block} from 'dash-core-sdk'
import type {Message, Peer, SimplifiedMNListEntry} from 'dash-core-p2p'
import {MASTERNODE_MIN_CONFIRMATIONS, REGISTRATION_BLOCKS_INFLIGHT} from '../constants'
import {PeerRotation} from '../net/peerRotation'
import type {ChainStore} from '../store/ChainStore'
import type {MasternodeListOptions, PayoutUpdate, ProviderRegistration} from '../types/masternodeList'
import {displayHexToWire, isZeroHash} from '../utils/byteOrder'
import {listedMasternode, providerRegistration} from '../utils/masternodeList'
import {txsMatchMerkleRoot} from '../utils/merkle'
import {hashHeaderRaw} from '../utils/pow'
import {BlockFetcher} from './blockFetcher'
import {Logger} from '../../src/utils/logger'

const log = new Logger('p2p')

// The masternode list as the wallet sees it: each proven list joined with what
// every node's ProRegTx committed to, which the list itself does not carry.
// A registration is read once from the block confirmedHash points below and kept
// in chain.db, so only nodes new since the last list cost a block.
export class ProviderRegistry {
  private store: ChainStore | null = null
  private registrations = new Map<string, ProviderRegistration>()
  private entries: SimplifiedMNListEntry[] | null = null
  // The newest list handed in while one is being indexed.
  private next: {store: ChainStore; height: number; entries: SimplifiedMNListEntry[]} | null = null
  private fetcher: BlockFetcher | null = null
  // Block hash (display) → height and the registrations it holds.
  private wanted = new Map<string, {height: number; proTxHashes: string[]}>()
  // Not where confirmedHash says, so not asked again this session.
  private unresolvable = new Set<string>()
  private offering = false

  constructor(private readonly opts: MasternodeListOptions) {}

  // Takes a list already proven at `height` on our chain.
  async offer(store: ChainStore, height: number, entries: SimplifiedMNListEntry[]): Promise<void> {
    this.next = {store, height, entries}
    if (this.offering) return
    this.offering = true
    try {
      while (this.next != null) {
        const next = this.next
        this.next = null
        await this.index(next.store, next.height, next.entries)
      }
    } finally {
      this.offering = false
    }
  }

  private async index(store: ChainStore, height: number, entries: SimplifiedMNListEntry[]): Promise<void> {
    if (!await this.load(store)) return
    this.entries = entries

    const listed = new Set(entries.map(({proRegTxHash}) => proRegTxHash))
    const gone = [...this.registrations.keys()].filter(proTxHash => !listed.has(proTxHash))
    for (const proTxHash of gone) this.registrations.delete(proTxHash)
    await store.writeRegistrations(new Map(), gone)

    const queued = new Set([...this.wanted.values()].flatMap(({proTxHashes}) => proTxHashes))
    // Not confirmed yet: no block to look for, and a hash the walk down the chain
    // could never find would stop it ending early. A later list confirms it.
    const confirmed = entries.filter(({proRegTxHash, confirmedHash}) => !isZeroHash(confirmedHash) &&
      !this.registrations.has(proRegTxHash) && !this.unresolvable.has(proRegTxHash) && !queued.has(proRegTxHash))
    const confirmedWire = (entry: SimplifiedMNListEntry): string => Buffer.from(displayHexToWire(entry.confirmedHash)).toString('hex')
    const heights = await store.findHeights(new Set(confirmed.map(confirmedWire)), height)
    let queuing = 0
    for (const entry of confirmed) {
      const confirmedAt = heights.get(confirmedWire(entry))
      const registeredAt = confirmedAt == null ? null : confirmedAt - MASTERNODE_MIN_CONFIRMATIONS[store.network]
      const registeredHeader = registeredAt == null ? null : await store.getHeaderByHeight(registeredAt)
      if (registeredAt == null || registeredHeader == null) continue
      const blockHash = hashHeaderRaw(registeredHeader)
      const block = this.wanted.get(blockHash) ?? {height: registeredAt, proTxHashes: []}
      block.proTxHashes.push(entry.proRegTxHash)
      this.wanted.set(blockHash, block)
      queuing++
    }
    if (queuing > 0) log.info(`indexing ${queuing} masternode registration(s), ${this.wanted.size} block(s) to fetch`)
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
    await this.store?.writeRegistrations(trimmed, gone)
  }

  // Called before the new pool exists, so the next fetch builds its fetcher.
  resetPool(): void {
    this.fetcher?.stop()
    this.fetcher = null
    this.wanted.clear()
  }

  closeChain(): void {
    this.store = null
    this.registrations = new Map()
    this.entries = null
    this.next = null
    this.wanted.clear()
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

  // A delivered block leaves `wanted` before this runs and request() skips one in
  // flight, so the walk stops a few entries in.
  private pump(): void {
    const pool = this.opts.pool()
    if (this.fetcher == null && pool != null) {
      this.fetcher = new BlockFetcher({rotation: new PeerRotation(() => pool.readyPeers), messages: pool.messages})
    }
    const fetcher = this.fetcher
    if (fetcher == null) return
    for (const [blockHash, {height}] of this.wanted) {
      if (fetcher.size >= REGISTRATION_BLOCKS_INFLIGHT) return
      fetcher.request(height, displayHexToWire(blockHash))
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
