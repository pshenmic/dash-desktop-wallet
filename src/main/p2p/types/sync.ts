import type {Peer} from 'dash-core-p2p'
import type {Network} from '../../src/types/Network'
import type {GovernanceVote, Proposal} from '../../src/types/Governance'
import type {NetworkMasternode} from '../../src/types/Masternode'
import type {PoolService} from '../net/PoolService'
import type {AppliedBlock, AppliedTx, GapExhausted, WalletSyncStatus} from './walletSync'
import type {BroadcastResult} from './broadcast'

export interface LockWatcherOptions {
  // Read on every call: the lock pool is rebuilt when network or settings change.
  pool: () => PoolService | null
  network: () => Network | null
  events: Pick<SyncServiceEvents, 'incomingTx' | 'txInstantLocked'>
  onBlockAnnounced: (peer: Peer, blockHash: string) => void
  // A sync layer is up to mark txs final, so clsig objects are worth fetching.
  syncActive: () => boolean
}

export interface SyncServiceEvents {
  status: (status: WalletSyncStatus) => void
  blockApplied: (block: AppliedBlock) => void
  cursorAdvanced: (walletId: string, height: number) => void
  cursorReset: (walletId: string, height: number) => void
  chainRewound: (walletId: string, height: number) => void
  incomingTx: (walletId: string, tx: AppliedTx) => void
  gapExhausted: (gap: GapExhausted) => void
  error: (message: string) => void
  broadcastResult: (
    requestId: string,
    ok: boolean,
    result: BroadcastResult,
    errorMessage: string | null,
  ) => void
  txInstantLocked: (txid: string, islockHex: string) => void
  chainLocked: (network: Network, height: number) => void
  evonodeDapiUrls: (network: Network, dapiUrls: string[]) => void
  platformQuorums: (network: Network, keys: Map<string, Uint8Array>) => void
  masternodeList: (network: Network, masternodes: NetworkMasternode[]) => void
  listedMasternodes: (network: Network, proTxHashes: string[], askedAt: number, v24Active: boolean) => void
  proposals: (network: Network, proposals: Proposal[]) => void
  proposalVotes: (network: Network, proposalHash: string, votes: GovernanceVote[]) => void
  voteRelayed: (requestId: string, peers: number, accepted: number, errorMessage: string | null) => void
}
