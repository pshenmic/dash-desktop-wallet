import type {Message, MnListDiff, Peer} from 'dash-core-p2p'
import {ProviderRegistry} from './providerRegistry'
import {MNLIST_REFRESH_MS, MNLIST_REPLY_TIMEOUT_MS, PLATFORM_QUORUM_PEERS} from '../constants'
import {wireToDisplayHex} from '../utils/byteOrder'
import {committedList, committedQuorums, evonodeDapiUrls, quorumKey} from '../utils/masternodeList'
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
  private followedAt = 0
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
    if (this.retry) clearTimeout(this.retry)
    this.retry = null
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
    this.apply(peer, diff).catch(err => log.warn(`masternode list from ${peer.host}:${peer.port} failed:`, err))
    // Only a full list carries every evonode, and a peer answering after the
    // list verified would only repeat it.
    if (/[^0]/.test(diff.baseBlockHash) || Date.now() - this.verifiedAt < MNLIST_REFRESH_MS) return
    const dapiUrls = evonodeDapiUrls(diff)
    if (dapiUrls == null) {
      log.warn(`${peer.host}:${peer.port} sent a masternode list its coinbase does not commit to`)
      this.askedAt = 0
      return
    }
    this.verifiedAt = Date.now()
    log.info(`masternode list at ${diff.blockHash} from ${peer.host}:${peer.port}: ${dapiUrls.length} evonode DAPI url(s)`)
    this.opts.events.evonodeDapiUrls(pool.network, dapiUrls)
    this.opts.events.listedMasternodes(pool.network, diff.mnList.map(({proRegTxHash}) => proRegTxHash), this.askedAt)
  }

  // A diff from the last proven list, so following the tip costs a few KB a block;
  // the full list is asked only while there is none. Asked at a block our chain
  // already holds, so the answer can be proven against it.
  followTip(blockHash: string): void {
    const pool = this.opts.pool()
    if (!pool) return
    this.followedAt = Date.now()
    const request = pool.messages.GetMnListDiff({baseBlockHash: this.proven?.blockHash, blockHash})
    const peers = [...pool.readyPeers]
    for (let i = 0; i < PLATFORM_QUORUM_PEERS && peers.length > 0; i++) {
      peers.splice(Math.floor(Math.random() * peers.length), 1)[0]!.sendMessage(request)
    }
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
    this.registry.closeChain()
  }

  // Trusted only at a block on our own header chain: its work vouches for the
  // coinbase, and the coinbase for the list and the commitments. Several peers
  // answer each ask, so one based on a list already replaced is dropped.
  private async apply(peer: Peer, diff: MnListDiff): Promise<void> {
    const store = this.opts.chain()
    const height = diff.coinbaseHeight
    const full = !/[^0]/.test(diff.baseBlockHash)
    const base = full ? null : this.proven
    if (store == null || height == null || (!full && base?.blockHash !== diff.baseBlockHash)) return
    const header = await store.getHeaderByHeight(height)
    if (header == null || store !== this.opts.chain() || height <= (this.proven?.height ?? 0) || (!full && this.proven !== base)) return
    const commitments = committedQuorums(diff, header, base?.commitments ?? [])
    const entries = committedList(diff, header, base?.entries ?? [])
    if (commitments == null || entries == null) {
      log.warn(`${peer.host}:${peer.port} sent a masternode list block ${height} does not commit to`)
      return
    }
    this.proven = {blockHash: diff.blockHash, height, entries, commitments}
    this.opts.events.platformQuorums(store.network, new Map(commitments.map(quorum =>
      [quorumKey(quorum), Uint8Array.from(Buffer.from(quorum.quorumPublicKey, 'hex'))])))
    // Main rediscovers on every list, and most blocks change no node.
    if (!full && diff.mnList.length === 0 && diff.deletedMNs.length === 0) return
    this.opts.events.listedMasternodes(store.network, entries.map(({proRegTxHash}) => proRegTxHash), this.followedAt)
    await this.registry.offer(store, height, entries)
  }
}
