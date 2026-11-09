import type {Network} from '../../src/types/Network'
import type {GovernanceVote, Proposal} from '../../src/types/Governance'
import type {NetworkMasternode} from '../../src/types/Masternode'
import type {AppliedBlock, AppliedTx, GapExhausted, WalletSyncStatus} from './walletSync'
import type {BroadcastResult} from './broadcast'

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
  listedMasternodes: (network: Network, proTxHashes: string[], askedAt: number) => void
  proposals: (network: Network, proposals: Proposal[]) => void
  proposalVotes: (network: Network, proposalHash: string, votes: GovernanceVote[]) => void
  voteRelayed: (requestId: string, peers: number, errorMessage: string | null) => void
}
