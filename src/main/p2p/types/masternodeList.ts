import type {FinalCommitment} from 'dash-core-p2p'
import type {PoolService} from '../net/PoolService'
import type {ChainStore} from '../store/ChainStore'
import type {SyncServiceEvents} from './sync'

export interface MasternodeListOptions {
  // Read on every call: the lock pool and chain.db each outlive the other.
  pool: () => PoolService | null
  chain: () => ChainStore | null
  events: Pick<SyncServiceEvents, 'evonodeDapiUrls' | 'platformQuorums' | 'masternodeList'>
}

// What a list entry lacks and only the ProRegTx carries. Fixed at registration
// except the payout, which each ProUpRegTx may replace. collateralAddress is null
// for a collateral created outside the ProRegTx.
export interface ProviderRegistration {
  height: number
  // A banned evonode's list entry falls back to version 1, which has no type.
  isEvo: boolean
  collateralTxid: string
  collateralVout: number
  collateralAddress: string | null
  ownerAddress: string
  // The ProRegTx's payout, then each change in height order; the last one is
  // current. Kept whole so a rewind drops only the changes above the fork.
  payouts: Array<{height: number; address: string | null}>
  // An evonode's, which a list entry older than ExtAddr does not carry.
  platformP2PPort: number | null
}

// The payout a ProUpRegTx set for a watched node, found by the wallet's filter scan.
export interface PayoutUpdate {
  proTxHash: string
  payoutAddress: string | null
  height: number
}

export interface QuorumSet {
  blockHash: string
  height: number
  commitments: FinalCommitment[]
}
