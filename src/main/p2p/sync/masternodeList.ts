import type {Message, MnListDiff, Peer} from 'dash-core-p2p'
import type {PoolService} from '../net/PoolService'
import {ProviderRegistry} from './providerRegistry'
import {MNLIST_REFRESH_MS, MNLIST_REPLY_TIMEOUT_MS, PLATFORM_QUORUM_PEERS} from '../constants'
import {isZeroHash, wireToDisplayHex} from '../utils/byteOrder'
import {committedList, committedQuorums, evonodeDapiUrls, isV24Active, quorumKey} from '../utils/masternodeList'
import type {MasternodeListOptions, ProvenList} from '../types/masternodeList'
import {Logger} from '../../src/utils/logger'

const log = new Logger('p2p')

// The evonodes platform requests go to, refreshed hourly from a full list, and the
// list and quorum keys at our tip, followed block by block.
export class MasternodeList {
  private verifiedAt = 0
  private askedAt = 0
  private retry: ReturnType<typeof setTimeout> | null = null
  private proven: ProvenList | null = null
  // Block hash → when a list at it was first asked for.
  private asked = new Map<string, number>()
  private fullRetry: ReturnType<typeof setTimeout> | null = null
  // The newest block a peer announced, where an asked-for list is taken.
  private latest: {peer: Peer; blockHash: string} | null = null
  readonly registry: ProviderRegistry

  constructor(private readonly opts: MasternodeListOptions) {
    this.registry = new ProviderRegistry(opts)
  }

  // A new lock pool may be on another network, so its list is fetched afresh.
  resetPool(): void {
    this.verifiedAt = 0
    this.askedAt = 0
    this.latest = null
    this.asked.clear()
    if (this.retry) clearTimeout(this.retry)
    this.retry = null
    if (this.fullRetry) clearTimeout(this.fullRetry)
    this.fullRetry = null
    this.registry.resetPool()
  }

  // A peer is asked for a block it announced itself, so it always holds it; a reply
  // is checked against its own coinbase, so the first verified one wins.
  onBlockAnnounced(peer: Peer, blockHash: string): void {
    this.latest = {peer, blockHash}
    const now = Date.now()
    if (now - this.verifiedAt < MNLIST_REFRESH_MS || now - this.askedAt < MNLIST_REPLY_TIMEOUT_MS) return
    this.ask(peer, blockHash)
  }

  // An ask still unanswered answers this too.
  refresh(): void {
    const inFlight = this.askedAt > this.verifiedAt && Date.now() - this.askedAt < MNLIST_REPLY_TIMEOUT_MS
    if (this.latest == null || inFlight) return
    this.verifiedAt = 0
    this.ask(this.latest.peer, this.latest.blockHash)
  }

  // Many peers never answer getmnlistd, and waiting for the next announcement
  // leaves platform requests without evonodes for minutes.
  private ask(peer: Peer, blockHash: string): void {
    const pool = this.opts.pool()
    if (!pool) return
    this.askedAt = Date.now()
    this.noteAsked(blockHash)
    log.info(`asking ${peer.host}:${peer.port} for the masternode list at ${blockHash}`)
    peer.sendMessage(pool.messages.GetMnListDiff({blockHash}))

    if (this.retry) clearTimeout(this.retry)
    this.retry = setTimeout(() => {
      this.retry = null
      const others = [...this.opts.pool()?.readyPeers ?? []].filter(ready => ready !== peer)
      if (Date.now() - this.verifiedAt < MNLIST_REFRESH_MS || others.length === 0) return
      this.ask(others[Math.floor(Math.random() * others.length)]!, blockHash)
    }, MNLIST_REPLY_TIMEOUT_MS)
  }

  // Core opens every connection with a getheaders whose locator starts at its tip.
  // A peer still syncing would name a block long buried, so only the highest count.
  onPeerTip = (peer: Peer, msg: Message & {starts?: Uint8Array[]}): void => {
    const best = Math.max(...[...this.opts.pool()?.readyPeers ?? []].map(ready => ready.bestHeight ?? 0))
    const tip = msg.starts?.[0]
    if (tip != null && (peer.bestHeight ?? 0) >= best) this.onBlockAnnounced(peer, wireToDisplayHex(tip))
  }

  onDiff = (peer: Peer, msg: Message & {mnlistdiff?: MnListDiff}): void => {
    const pool = this.opts.pool()
    const diff = msg.mnlistdiff
    if (!pool || diff == null) return
    this.take(pool, peer, diff).catch(err => log.warn(`masternode list from ${peer.host}:${peer.port} failed:`, err))
  }

  // Every diff may advance the list at our tip; a full one also refreshes the
  // DAPI urls, and is main's list where no chain proved it.
  private async take(pool: PoolService, peer: Peer, diff: MnListDiff): Promise<void> {
    const askedAt = this.asked.get(diff.blockHash) ?? 0
    const announced = await this.apply(peer, diff, askedAt).catch(err => {
      log.warn(`masternode list from ${peer.host}:${peer.port} failed:`, err)
      return false
    })
    // A peer answering after the list verified would only repeat it.
    if (!isZeroHash(diff.baseBlockHash) || Date.now() - this.verifiedAt < MNLIST_REFRESH_MS) return
    const dapiUrls = evonodeDapiUrls(diff)
    if (dapiUrls == null) {
      log.warn(`${peer.host}:${peer.port} sent a masternode list its coinbase does not commit to`)
      this.askedAt = 0
      return
    }
    this.verifiedAt = Date.now()
    log.info(`masternode list at ${diff.blockHash} from ${peer.host}:${peer.port}: ${dapiUrls.length} evonode DAPI url(s)`)
    this.opts.events.evonodeDapiUrls(pool.network, dapiUrls)
    if (announced) return
    this.opts.events.listedMasternodes(pool.network, diff.mnList.map(({proRegTxHash}) => proRegTxHash), askedAt, isV24Active(diff))
  }

  // Asked at a block our chain already holds, so the answer can be proven against
  // it. A diff is a few KB and many peers never answer, so several are asked at once.
  followTip(blockHash: string): void {
    const pool = this.opts.pool()
    if (!pool) return
    this.noteAsked(blockHash)
    const request = pool.messages.GetMnListDiff({baseBlockHash: this.proven?.blockHash, blockHash})
    const peers = [...pool.readyPeers]
    const count = this.proven == null ? 1 : PLATFORM_QUORUM_PEERS
    for (let i = 0; i < count && peers.length > 0; i++) {
      peers.splice(Math.floor(Math.random() * peers.length), 1)[0]!.sendMessage(request)
    }
    if (this.fullRetry) clearTimeout(this.fullRetry)
    this.fullRetry = null
    if (this.proven != null) return
    // The full list is ~500 KB on mainnet, so one peer at a time is asked for it.
    this.fullRetry = setTimeout(() => {
      this.fullRetry = null
      if (this.proven == null && this.opts.chain() != null) this.followTip(blockHash)
    }, MNLIST_REPLY_TIMEOUT_MS)
  }

  // An answer an hour late is stamped as never asked for, which drops no node.
  private noteAsked(blockHash: string): void {
    const now = Date.now()
    for (const [asked, at] of this.asked) if (now - at >= MNLIST_REFRESH_MS) this.asked.delete(asked)
    if (!this.asked.has(blockHash)) this.asked.set(blockHash, now)
  }

  // Core refuses, and scores, a diff based on a block off its active chain.
  rewound(height: number): void {
    if (this.proven != null && this.proven.height > height) this.proven = null
    this.registry.rewound(height).catch(err => log.warn('registration index rewind failed:', err))
  }

  closeChain(): void {
    const store = this.opts.chain()
    if (store && this.proven) this.opts.events.platformQuorums(store.network, new Map())
    this.proven = null
    if (this.fullRetry) clearTimeout(this.fullRetry)
    this.fullRetry = null
    this.registry.closeChain()
  }

  // Trusted only at a block on our own header chain, whose work vouches for the
  // coinbase. True once main was told the list; a diff on a replaced list is dropped.
  private async apply(peer: Peer, diff: MnListDiff, askedAt: number): Promise<boolean> {
    const store = this.opts.chain()
    const height = diff.coinbaseHeight
    const full = isZeroHash(diff.baseBlockHash)
    const base = full ? null : this.proven
    const onOurList = full || base?.blockHash === diff.baseBlockHash
    if (store == null || height == null || !onOurList) return false
    const header = await store.getHeaderByHeight(height)
    const replaced = height <= (this.proven?.height ?? 0) || (!full && this.proven !== base)
    if (header == null || store !== this.opts.chain() || replaced) return false
    const commitments = committedQuorums(diff, header, base?.commitments ?? [])
    const entries = committedList(diff, header, base?.entries ?? [])
    if (commitments == null || entries == null) {
      log.warn(`${peer.host}:${peer.port} sent a masternode list block ${height} does not commit to`)
      return false
    }
    const v24Active = isV24Active(diff)
    this.proven = {blockHash: diff.blockHash, height, entries, commitments, v24Active}
    for (const [blockHash, at] of this.asked) if (at <= askedAt) this.asked.delete(blockHash)
    this.opts.events.platformQuorums(store.network, new Map(commitments.map(quorum =>
      [quorumKey(quorum), Uint8Array.from(Buffer.from(quorum.quorumPublicKey, 'hex'))])))
    // Main rediscovers on every list, and most blocks change no node.
    const unchanged = base?.v24Active === v24Active && diff.mnList.length === 0 && diff.deletedMNs.length === 0
    if (unchanged) return false
    this.opts.events.listedMasternodes(store.network, entries.map(({proRegTxHash}) => proRegTxHash), askedAt, v24Active)
    await this.registry.offer(store, height, entries)
    return true
  }
}
