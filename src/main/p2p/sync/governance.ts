import {Inventory} from 'dash-core-p2p'
import type {Peer} from 'dash-core-p2p'
import {concatBytes} from '@noble/hashes/utils.js'
import {
  GOVERNANCE_ANNOUNCED_MAX,
  GOVERNANCE_EMIT_DELAY_MS,
  GOVERNANCE_REPLY_WINDOW_MS,
  GOVERNANCE_RESYNC_MS,
  GOVERNANCE_SYNC_PEERS,
  GOVSYNC_OBJECTS_FILTER,
  GOVSYNC_VOTES_FILTER,
  INV_GOVERNANCE_OBJECT,
  INV_GOVERNANCE_VOTE,
  PROPOSAL_ANNOUNCERS,
  PROPOSAL_VOTES_MAX,
  VOTE_CONFIRM_WINDOW_MS,
  VOTE_RELAY_WINDOW_MS,
} from '../constants'
import type {ChainStore} from '../store/ChainStore'
import type {GovernanceSyncState} from '../types/chainStore'
import type {GovernanceMessages, GovernanceOptions, InventoryMessage, PayloadMessage} from '../types/governance'
import type {PoolService} from '../net/PoolService'
import {displayHexToWire, wireToDisplayHex} from '../utils/byteOrder'
import {peerTarget} from '../net/peerAddress'
import {governanceObject, governanceVote, isStaleProposal, proposalOf} from '../../src/utils/governance'
import type {GovernanceVote, Proposal} from '../../src/types/Governance'
import {Logger} from '../../src/utils/logger'

const log = new Logger('governance')

const nowSeconds = (): number => Math.floor(Date.now() / 1000)

const messagesOf = (pool: PoolService): GovernanceMessages => pool.messages as unknown as GovernanceMessages

// Proposals and their votes, read from peers with govsync and kept in chain.db.
// Votes are fetched per proposal when main asks, since a full set is thousands.
export class Governance {
  private store: ChainStore | null = null
  private state: GovernanceSyncState = {syncedAt: 0, votesSyncedAt: {}, asked: {}}
  private proposals = new Map<string, Proposal>()
  // Parsed once per session: recovering a vote's signer is the costly part.
  private votes = new Map<string, Map<string, GovernanceVote>>()
  // Proposal hash, or '' for the object list → when peers were last asked for it.
  private waiting = new Map<string, number>()
  // Peers asked for the object list and those that answered, until enough have.
  private objectsAsked = new Set<Peer>()
  private objectAnswers = new Set<Peer>()
  // Object hash → the peers that announced it.
  private announced = new Map<string, Set<Peer>>()
  // Until when a peer's vote invs answer our govsync; votes are not fetched otherwise.
  private voteWindows = new Map<Peer, {until: number; proposalHash: string}>()
  // Hash → when it was asked for; a peer that never delivers frees it after the window.
  private requested = new Map<string, number>()
  // Proposals whose held votes main already has.
  private votesSent = new Set<string>()
  // Triggers and stale or unreadable objects, so a re-announcement is not fetched.
  private ignored = new Set<string>()
  private unsavedObjects = new Map<string, Uint8Array>()
  private unsavedVotes = new Map<string, Map<string, Uint8Array>>()
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  // peers asked for the vote; asked back are those sent a getdata for it once
  // the window closed, and accepted those that served it.
  private relays = new Map<string, {payload: Uint8Array; peers: Set<Peer>; askedBack: Set<Peer>; accepted: Set<Peer>}>()

  constructor(private readonly opts: GovernanceOptions) {}

  // Drops what ended before the current superblock cycle, its votes with it.
  async open(): Promise<void> {
    const store = this.opts.chain()
    if (store == null) return
    const [objects, state] = await Promise.all([store.getProposalObjects(), store.getGovernanceState()])
    if (store !== this.opts.chain()) return
    const now = nowSeconds()
    const stale: string[] = []
    const proposals = new Map<string, Proposal>()
    for (const bytes of objects) {
      const object = governanceObject(bytes)
      const proposal = proposalOf(object)
      if (proposal == null || isStaleProposal(proposal, now, store.network)) stale.push(object.hash)
      else proposals.set(proposal.hash, proposal)
    }
    for (const hash of stale) delete state.votesSyncedAt[hash]
    await store.writeProposals(new Map(), stale)
    if (store !== this.opts.chain()) return
    this.store = store
    this.proposals = proposals
    this.state = state
    log.info(`${this.proposals.size} stored proposal(s), ${stale.length} stale dropped`)
    this.opts.events.proposals(store.network, [...this.proposals.values()])
    this.onPeerReady()
  }

  closeChain(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = null
    this.store = null
    this.proposals.clear()
    this.votes.clear()
    this.unsavedObjects.clear()
    this.unsavedVotes.clear()
    this.ignored.clear()
    this.requested.clear()
    this.votesSent.clear()
    this.waiting.clear()
  }

  // A relay waiting on the old pool can no longer be asked for.
  resetPool(): void {
    this.voteWindows.clear()
    this.objectsAsked.clear()
    this.objectAnswers.clear()
    this.announced.clear()
    this.waiting.clear()
    this.requested.clear()
    this.relays.clear()
  }

  // Answers from chain.db at once.
  syncProposals(): void {
    const store = this.store
    if (store == null) return
    this.opts.events.proposals(store.network, [...this.proposals.values()])
    this.onPeerReady()
  }

  // Asks peers only once the hour Core holds against a repeat has passed, and other
  // peers while the ones asked have not answered.
  onPeerReady = (): void => {
    const store = this.store
    const pool = this.opts.pool()
    if (store == null || pool == null || pool.network !== store.network) return
    if (Date.now() - this.state.syncedAt < GOVERNANCE_RESYNC_MS) return
    const peers = this.freshPeers('')
    if (peers.length === 0) return
    this.saveState(store)
    for (const peer of peers) {
      log.info(`asking ${peerTarget(peer)} for governance objects`)
      this.objectsAsked.add(peer)
      peer.sendMessage(messagesOf(pool).GovSync({payload: concatBytes(new Uint8Array(32), GOVSYNC_OBJECTS_FILTER)}))
    }
  }

  syncVotes = async (proposalHash: string): Promise<void> => {
    const store = this.store
    const pool = this.opts.pool()
    if (store == null || pool == null || pool.network !== store.network || !this.proposals.has(proposalHash)) return
    if (!this.votes.has(proposalHash)) {
      const stored = await store.getVotes(proposalHash)
      if (store !== this.store) return
      this.votes.set(proposalHash, new Map(stored.map(bytes => {
        const vote = governanceVote(bytes, store.network)
        return [vote.hash, vote]
      })))
    }
    if (!this.votesSent.has(proposalHash)) this.emitVotes(store, proposalHash)
    if (Date.now() - (this.state.votesSyncedAt[proposalHash] ?? 0) < GOVERNANCE_RESYNC_MS) return
    const peers = this.freshPeers(proposalHash)
    if (peers.length === 0) return
    this.saveState(store)
    for (const peer of peers) {
      log.info(`asking ${peerTarget(peer)} for the votes on ${proposalHash}`)
      this.voteWindows.set(peer, {until: Date.now() + GOVERNANCE_REPLY_WINDOW_MS, proposalHash})
      peer.sendMessage(messagesOf(pool).GovSync({payload: concatBytes(displayHexToWire(proposalHash), GOVSYNC_VOTES_FILTER)}))
    }
  }

  // Core accepts a vote only from a peer that announced it or was asked for it,
  // so it goes out as an inv and is handed over on getdata.
  relay(requestId: string, payload: Uint8Array): void {
    const pool = this.opts.pool()
    if (pool == null || pool.readyPeers.size === 0) {
      this.opts.events.voteRelayed(requestId, 0, 0, 'No peer is connected')
      return
    }
    const vote = governanceVote(payload, pool.network)
    const relay = {payload, peers: new Set<Peer>(), askedBack: new Set<Peer>(), accepted: new Set<Peer>()}
    this.relays.set(vote.hash, relay)
    const inv = messagesOf(pool).Inventory([Inventory.forItem(INV_GOVERNANCE_VOTE, vote.hash)])
    for (const peer of pool.readyPeers) peer.sendMessage(inv)
    // Core serves a vote on getdata only from the votes it kept, so asking the
    // peers that took it is what tells a kept vote from a silently dropped one.
    setTimeout(() => {
      const getData = messagesOf(pool).GetData([{type: INV_GOVERNANCE_VOTE, hash: displayHexToWire(vote.hash)}])
      for (const peer of relay.peers) {
        if (!pool.readyPeers.has(peer)) continue
        relay.askedBack.add(peer)
        peer.sendMessage(getData)
      }
      setTimeout(() => {
        if (this.relays.get(vote.hash) === relay) this.relays.delete(vote.hash)
        log.info(`vote ${vote.hash} on ${vote.parentHash}: ${relay.peers.size} peer(s) asked for it, ${relay.accepted.size} kept it`)
        this.opts.events.voteRelayed(requestId, relay.peers.size, relay.accepted.size, null)
      }, VOTE_CONFIRM_WINDOW_MS).unref?.()
    }, VOTE_RELAY_WINDOW_MS).unref?.()
  }

  // A vote inv counts only from a peer answering our vote sync. The first inv of
  // an answer is what marks the sync done, so an unanswered one is asked again.
  onInv = (peer: Peer, msg: InventoryMessage): void => {
    const pool = this.opts.pool()
    const store = this.store
    if (store == null || pool == null) return
    const now = Date.now()
    const items = msg.inventory ?? []
    const needed = Math.min(PROPOSAL_ANNOUNCERS, pool.readyPeers.size)
    const votes = this.voteWindows.get(peer)
    const votesOpen = votes != null && votes.until > now
    if (this.objectsAsked.has(peer) && items.some(({type}) => type === INV_GOVERNANCE_OBJECT)) {
      this.objectAnswers.add(peer)
      if (this.objectAnswers.size >= needed) {
        this.objectsAsked.clear()
        this.objectAnswers.clear()
        this.state.syncedAt = now
        this.saveState(store)
      }
    }
    if (votesOpen && now - (this.state.votesSyncedAt[votes.proposalHash] ?? 0) >= GOVERNANCE_RESYNC_MS
      && items.some(({type}) => type === INV_GOVERNANCE_VOTE)) {
      this.state.votesSyncedAt[votes.proposalHash] = now
      this.saveState(store)
    }
    const wanted = items.filter(item => {
      const hash = wireToDisplayHex(item.hash)
      if (now - (this.requested.get(hash) ?? 0) < GOVERNANCE_REPLY_WINDOW_MS) return false
      if (item.type === INV_GOVERNANCE_OBJECT) return this.announcedEnough(peer, hash, needed)
      return item.type === INV_GOVERNANCE_VOTE && votesOpen
    })
    if (wanted.length === 0) return
    for (const item of wanted) this.requested.set(wireToDisplayHex(item.hash), now)
    peer.sendMessage(messagesOf(pool).GetData(wanted))
  }

  // Nothing here checks a proposal's collateral, so one peer alone could invent
  // one: it is fetched once `needed` peers have announced it.
  private announcedEnough(peer: Peer, hash: string, needed: number): boolean {
    if (this.proposals.has(hash) || this.ignored.has(hash)) return false
    if (this.announced.size >= GOVERNANCE_ANNOUNCED_MAX) this.announced.clear()
    const peers = this.announced.get(hash) ?? new Set<Peer>()
    peers.add(peer)
    this.announced.set(hash, peers)
    if (peers.size < needed) return false
    this.announced.delete(hash)
    return true
  }

  onObject = (peer: Peer, msg: PayloadMessage): void => {
    const store = this.store
    if (store == null) return
    let proposal: Proposal | null = null
    let hash: string
    try {
      const object = governanceObject(msg.payload)
      hash = object.hash
      proposal = proposalOf(object)
    } catch (err) {
      log.debug(`unreadable governance object from ${peerTarget(peer)}:`, err)
      return
    }
    if (!this.requested.delete(hash)) return
    if (proposal == null || isStaleProposal(proposal, nowSeconds(), store.network)) {
      this.ignored.add(hash)
      return
    }
    this.proposals.set(hash, proposal)
    this.unsavedObjects.set(hash, msg.payload)
    this.scheduleFlush()
  }

  // Our own vote served back is the proof a peer kept it, and only then is it
  // ours to count; that runs in rpc mode too, where nothing is stored.
  onVote = (peer: Peer, msg: PayloadMessage): void => {
    const pool = this.opts.pool()
    if (pool == null) return
    let vote: GovernanceVote
    try {
      vote = governanceVote(msg.payload, pool.network)
    } catch (err) {
      log.debug(`unreadable governance vote from ${peerTarget(peer)}:`, err)
      return
    }
    const relay = this.relays.get(vote.hash)
    if (relay?.askedBack.has(peer)) {
      if (relay.accepted.size === 0 && this.store != null) this.keepVote(vote, relay.payload)
      relay.accepted.add(peer)
    } else if (this.store != null && this.requested.delete(vote.hash)) {
      this.keepVote(vote, msg.payload)
    }
  }

  onGetData = (peer: Peer, msg: InventoryMessage): void => {
    const pool = this.opts.pool()
    if (pool == null) return
    for (const item of msg.inventory ?? []) {
      const relay = item.type === INV_GOVERNANCE_VOTE ? this.relays.get(wireToDisplayHex(item.hash)) : undefined
      if (relay == null || relay.peers.has(peer)) continue
      relay.peers.add(peer)
      peer.sendMessage(messagesOf(pool).GovObjVote({payload: relay.payload}))
    }
  }

  // Ready peers not asked for this within the hour, in random order; none while
  // the last ones asked may still answer.
  private freshPeers(proposalHash: string): Peer[] {
    const now = Date.now()
    if (now - (this.waiting.get(proposalHash) ?? 0) < GOVERNANCE_REPLY_WINDOW_MS) return []
    const {asked} = this.state
    for (const key of Object.keys(asked)) if (now - asked[key]! >= GOVERNANCE_RESYNC_MS) delete asked[key]
    const peers = [...this.opts.pool()?.readyPeers ?? []]
      .filter(peer => asked[`${peerTarget(peer)}/${proposalHash}`] == null)
      .sort(() => Math.random() - 0.5)
      .slice(0, GOVERNANCE_SYNC_PEERS)
    for (const peer of peers) asked[`${peerTarget(peer)}/${proposalHash}`] = now
    if (peers.length > 0) this.waiting.set(proposalHash, now)
    return peers
  }

  // Votes of a proposal not loaded yet are only written; loading reads them back.
  // A signature recovering to no key counts nowhere, and the cap holds a flood.
  private keepVote(vote: GovernanceVote, payload: Uint8Array): void {
    const held = this.votes.get(vote.parentHash)
    if (!this.proposals.has(vote.parentHash) || vote.voter == null || (held?.size ?? 0) >= PROPOSAL_VOTES_MAX) return
    held?.set(vote.hash, vote)
    const unsaved = this.unsavedVotes.get(vote.parentHash) ?? new Map<string, Uint8Array>()
    unsaved.set(vote.hash, payload)
    this.unsavedVotes.set(vote.parentHash, unsaved)
    this.scheduleFlush()
  }

  // A sync answers in a burst of messages, written and announced once it settles.
  private scheduleFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      this.flush().catch(err => log.warn('governance write failed:', err))
    }, GOVERNANCE_EMIT_DELAY_MS)
  }

  private async flush(): Promise<void> {
    const store = this.store
    if (store == null) return
    const objects = this.unsavedObjects
    const votes = this.unsavedVotes
    this.unsavedObjects = new Map()
    this.unsavedVotes = new Map()
    await store.writeProposals(objects)
    for (const [proposalHash, batch] of votes) await store.writeVotes(proposalHash, batch)
    if (store !== this.store) return
    if (objects.size > 0) this.opts.events.proposals(store.network, [...this.proposals.values()])
    for (const proposalHash of votes.keys()) this.emitVotes(store, proposalHash)
  }

  private emitVotes(store: ChainStore, proposalHash: string): void {
    const votes = this.votes.get(proposalHash)
    if (votes == null) return
    this.votesSent.add(proposalHash)
    this.opts.events.proposalVotes(store.network, proposalHash, [...votes.values()])
  }

  private saveState(store: ChainStore): void {
    store.writeGovernanceState(this.state).catch(err => log.warn('governance state write failed:', err))
  }
}
