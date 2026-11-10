import type {Inventory, Message} from 'dash-core-p2p'
import type {PoolService} from '../net/PoolService'
import type {ChainStore} from '../store/ChainStore'
import type {SyncServiceEvents} from './sync'

export interface GovernanceOptions {
  // Read on every call, like the masternode list's: pool and chain.db outlive each other.
  pool: () => PoolService | null
  chain: () => ChainStore | null
  events: Pick<SyncServiceEvents, 'proposals' | 'proposalVotes' | 'voteRelayed'>
}

// The factories addGovernanceMessages registers, beside the built-ins sent with them.
export interface GovernanceMessages {
  GovSync: (arg: {payload: Uint8Array}) => Message
  GovObjVote: (arg: {payload: Uint8Array}) => Message
  Inventory: (items: Inventory[]) => Message
  GetData: (items: Array<{type: number; hash: Uint8Array}>) => Message
}
