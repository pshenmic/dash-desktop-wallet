import {Inventory} from 'dash-core-p2p'
import type {Peer} from 'dash-core-p2p'
import {GovernanceVote as SDKGovernanceVote} from 'dash-core-sdk'
import {INV_GOVERNANCE_VOTE, VOTE_CONFIRM_WINDOW_MS, VOTE_RELAY_WINDOW_MS} from '../constants'
import type {GovernanceOptions, InventoryMessage, RelayedVote} from '../types/governance'
import {displayHexToWire, wireToDisplayHex} from '../utils/byteOrder'
import {governanceVote} from '../../src/utils/governance'
import {Logger} from '../../src/utils/logger'

const log = new Logger('governance')

// Sends our own votes out and learns which peers kept them. Runs on the lock
// pool alone, so in rpc mode too.
export class VoteRelay {
  private relays = new Map<string, RelayedVote>()

  constructor(private readonly opts: Pick<GovernanceOptions, 'pool' | 'events'>) {}

  // A relay waiting on the old pool can no longer be asked for.
  resetPool(): void {
    this.relays.clear()
  }

  // Core accepts a vote only from a peer that announced it or was asked for it,
  // so it goes out as an inv and is handed over on getdata.
  relay(requestId: string, payload: Uint8Array): void {
    const pool = this.opts.pool()
    if (pool == null || pool.readyPeers.size === 0) {
      this.opts.events.voteRelayed(requestId, 0, 0, 'No peer is connected')
      return
    }
    const messages = pool.messages
    const vote = governanceVote(SDKGovernanceVote.fromBytes(payload), pool.network)
    const relay: RelayedVote = {payload, peers: new Set(), askedBack: new Set(), accepted: new Set()}
    this.relays.set(vote.hash, relay)
    const inv = messages.Inventory([Inventory.forItem(INV_GOVERNANCE_VOTE, vote.hash)])
    for (const peer of pool.readyPeers) peer.sendMessage(inv)

    // Core serves a vote on getdata only from the votes it kept, so asking the
    // peers that took it is what tells a kept vote from a silently dropped one.
    const askBack = (): void => {
      const getData = messages.GetData([{type: INV_GOVERNANCE_VOTE, hash: displayHexToWire(vote.hash)}])
      for (const peer of relay.peers) {
        if (!pool.readyPeers.has(peer)) continue
        relay.askedBack.add(peer)
        peer.sendMessage(getData)
      }
      setTimeout(report, VOTE_CONFIRM_WINDOW_MS).unref?.()
    }
    const report = (): void => {
      if (this.relays.get(vote.hash) === relay) this.relays.delete(vote.hash)
      log.info(`vote ${vote.hash} on ${vote.parentHash}: ${relay.peers.size} peer(s) asked for it, ${relay.accepted.size} kept it`)
      this.opts.events.voteRelayed(requestId, relay.peers.size, relay.accepted.size, null)
    }
    setTimeout(askBack, VOTE_RELAY_WINDOW_MS).unref?.()
  }

  onGetData = (peer: Peer, msg: InventoryMessage): void => {
    const pool = this.opts.pool()
    if (pool == null) return
    for (const item of msg.inventory ?? []) {
      const relay = item.type === INV_GOVERNANCE_VOTE ? this.relays.get(wireToDisplayHex(item.hash)) : undefined
      if (relay == null || relay.peers.has(peer)) continue
      relay.peers.add(peer)
      peer.sendMessage(pool.messages.GovObjVote(SDKGovernanceVote.fromBytes(relay.payload)))
    }
  }

  // Null unless `peer` was asked back for this vote of ours. Serving it is the
  // proof the peer kept it; `first` is the first peer to give that proof.
  confirmed(peer: Peer, voteHash: string): {payload: Uint8Array; first: boolean} | null {
    const relay = this.relays.get(voteHash)
    if (relay == null || !relay.askedBack.has(peer)) return null
    const first = relay.accepted.size === 0
    relay.accepted.add(peer)
    return {payload: relay.payload, first}
  }
}
