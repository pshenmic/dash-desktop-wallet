import type {GovObjMessage, GovObjVoteMessage, Peer} from 'dash-core-p2p'
import {GovernanceObject, GovernanceVote as SDKGovernanceVote} from 'dash-core-sdk'
import {
  GOVERNANCE_ANNOUNCED_MAX,
  GOVERNANCE_EMIT_DELAY_MS,
  GOVERNANCE_REPLY_WINDOW_MS,
  GOVERNANCE_RESYNC_MS,
  GOVERNANCE_SYNC_PEERS,
  INV_GOVERNANCE_OBJECT,
  INV_GOVERNANCE_VOTE,
  PROPOSAL_ANNOUNCERS,
  PROPOSAL_VOTES_MAX,
} from '../constants'
import type {ChainStore} from '../store/ChainStore'
import type {GovernanceSyncState} from '../types/chainStore'
import type {GovernanceOptions, InventoryMessage} from '../types/governance'
import {wireToDisplayHex} from '../utils/byteOrder'
import {peerTarget} from '../net/peerAddress'
import {governanceVote, isStaleProposal, proposalOf} from '../../src/utils/governance'
import type {GovernanceVote, Proposal} from '../../src/types/Governance'
import {Logger} from '../../src/utils/logger'
import {VoteRelay} from './voteRelay'

const log = new Logger('governance')

const nowSeconds = (): number => Math.floor(Date.now() / 1000)

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
  // Object hash → the hosts that announced it: a peer reconnecting is still one.
  private announced = new Map<string, Set<string>>()
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
  readonly voteRelay: VoteRelay

  constructor(private readonly opts: GovernanceOptions) {
    this.voteRelay = new VoteRelay(opts)
  }

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
      const object = GovernanceObject.fromBytes(bytes)
      const proposal = proposalOf(object)
      if (proposal == null || isStaleProposal(proposal, now, store.network)) stale.push(object.hash())
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

  resetPool(): void {
    this.voteWindows.clear()
    this.objectsAsked.clear()
    this.objectAnswers.clear()
    this.announced.clear()
    this.waiting.clear()
    this.requested.clear()
    this.voteRelay.resetPool()
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
      peer.sendMessage(pool.messages.GovSync())
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
        const vote = governanceVote(SDKGovernanceVote.fromBytes(bytes), store.network)
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
      peer.sendMessage(pool.messages.GovSync({parentHash: proposalHash}))
    }
  }

  // The first inv of an answer is what marks a sync done, so an unanswered one is
  // asked again. A vote inv counts only from a peer answering our vote sync.
  onInv = (peer: Peer, msg: InventoryMessage): void => {
    const pool = this.opts.pool()
    const store = this.store
    if (store == null || pool == null) return
    const now = Date.now()
    const items = msg.inventory ?? []
    const needed = Math.min(PROPOSAL_ANNOUNCERS, pool.readyPeers.size)
    const window = this.voteWindows.get(peer)
    const votesFor = window != null && window.until > now ? window.proposalHash : null
    if (items.some(({type}) => type === INV_GOVERNANCE_OBJECT)) this.objectsAnswered(store, peer, needed)
    if (votesFor != null && items.some(({type}) => type === INV_GOVERNANCE_VOTE)) this.votesAnswered(store, votesFor)

    const wanted = items.filter(item => {
      const hash = wireToDisplayHex(item.hash)
      if (now - (this.requested.get(hash) ?? 0) < GOVERNANCE_REPLY_WINDOW_MS) return false
      if (item.type === INV_GOVERNANCE_OBJECT) return this.announcedEnough(peer, hash, needed)
      return item.type === INV_GOVERNANCE_VOTE && votesFor != null
    })
    if (wanted.length === 0) return
    for (const item of wanted) this.requested.set(wireToDisplayHex(item.hash), now)
    peer.sendMessage(pool.messages.GetData(wanted))
  }

  // The object list is synced once `needed` of the peers asked have answered.
  private objectsAnswered(store: ChainStore, peer: Peer, needed: number): void {
    if (!this.objectsAsked.has(peer)) return
    this.objectAnswers.add(peer)
    if (this.objectAnswers.size < needed) return
    this.objectsAsked.clear()
    this.objectAnswers.clear()
    this.state.syncedAt = Date.now()
    this.saveState(store)
  }

  private votesAnswered(store: ChainStore, proposalHash: string): void {
    if (Date.now() - (this.state.votesSyncedAt[proposalHash] ?? 0) < GOVERNANCE_RESYNC_MS) return
    this.state.votesSyncedAt[proposalHash] = Date.now()
    this.saveState(store)
  }

  // Nothing here checks a proposal's collateral, so one peer alone could invent
  // one: it is fetched once `needed` peers have announced it.
  private announcedEnough(peer: Peer, hash: string, needed: number): boolean {
    if (this.proposals.has(hash) || this.ignored.has(hash)) return false
    if (this.announced.size >= GOVERNANCE_ANNOUNCED_MAX) this.announced.clear()
    const hosts = this.announced.get(hash) ?? new Set<string>()
    hosts.add(peer.host)
    this.announced.set(hash, hosts)
    if (hosts.size < needed) return false
    this.announced.delete(hash)
    return true
  }

  onObject = (peer: Peer, msg: GovObjMessage): void => {
    const store = this.store
    if (store == null) return
    const object = msg.object
    const hash = object.hash()
    const proposal = proposalOf(object)
    if (!this.requested.delete(hash)) return
    if (proposal == null || isStaleProposal(proposal, nowSeconds(), store.network)) {
      log.debug(`ignoring governance object ${hash} from ${peerTarget(peer)}`)
      this.ignored.add(hash)
      return
    }
    this.proposals.set(hash, proposal)
    this.unsavedObjects.set(hash, object.bytes())
    this.scheduleFlush()
  }

  // Our own vote served back is the proof a peer kept it, and only then is it
  // ours to count; that runs in rpc mode too, where nothing is stored.
  onVote = (peer: Peer, msg: GovObjVoteMessage): void => {
    const pool = this.opts.pool()
    if (pool == null) return
    const vote = governanceVote(msg.vote, pool.network)
    const ours = this.voteRelay.confirmed(peer, vote.hash)
    if (this.store == null) return
    if (ours?.first) this.keepVote(vote, ours.payload)
    if (ours == null && this.requested.delete(vote.hash)) this.keepVote(vote, msg.vote.bytes())
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
