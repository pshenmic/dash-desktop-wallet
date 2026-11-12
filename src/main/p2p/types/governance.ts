import type {Inventory, Message, Peer} from 'dash-core-p2p'
import type {PoolService} from '../net/PoolService'
import type {ChainStore} from '../store/ChainStore'
import type {SyncServiceEvents} from './sync'

export interface GovernanceOptions {
  // Read on every call, like the masternode list's: pool and chain.db outlive each other.
  pool: () => PoolService | null
  chain: () => ChainStore | null
  events: Pick<SyncServiceEvents, 'proposals' | 'proposalVotes' | 'voteRelayed'>
}

export type InventoryMessage = Message & {inventory?: Array<{type: number; hash: Uint8Array}>}
export type PayloadMessage = Message & {payload: Uint8Array}

// A vote of ours on its way out: the peers that asked for it, those then asked
// to serve it back, and those that did.
export interface RelayedVote {
  payload: Uint8Array
  peers: Set<Peer>
  askedBack: Set<Peer>
  accepted: Set<Peer>
}

// The factories addGovernanceMessages registers, beside the built-ins sent with them.
export interface GovernanceMessages {
  GovSync: (arg: {payload: Uint8Array}) => Message
  GovObjVote: (arg: {payload: Uint8Array}) => Message
  Inventory: (items: Inventory[]) => Message
  GetData: (items: Array<{type: number; hash: Uint8Array}>) => Message
}
