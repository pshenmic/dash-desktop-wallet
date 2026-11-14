import {UTXO} from '../types/UTXO'
import {AddressInfo} from '../types/AddressInfo'
import {Transaction} from '../types/Transaction'
import {TxLockStatus} from '../types/TxLockStatus'
import {AddressUsage} from '../types/AddressDiscovery'
import {ConnectionStatus} from '../types/ConnectionStatus'
import {GovernanceVote, Proposal, ProposalTally} from '../types/Governance'
import {Masternode, MasternodeKeyFilter, NetworkMasternode} from '../types/Masternode'

// Read side only: where a wallet's history, balances and UTXOs come from.
// Putting a tx on the network and observing its lock belongs to
// WalletSyncService, which owns the p2p transport in both connection modes.
export interface WalletProvider {
  // One transaction usually touches several owned addresses, so collapsing
  // per-address results is the provider's job rather than every caller's.
  getWalletTransactions(): Promise<Transaction[]>
  // Both fields come off one lookup, so anything needing either per address
  // goes through here rather than a call per address. Order is preserved.
  getAddressInfos(addresses: string[]): Promise<AddressInfo[]>
  getWalletBalance(): Promise<bigint>
  getBalance(address: string | string[]): Promise<bigint>
  getTransactionByHash(txId: string): Promise<Transaction>
  // The source decides the address set, not the caller.
  getWalletUtxos(): Promise<UTXO[]>
  getTxLockStatus(txid: string): Promise<TxLockStatus>
  ensureReady(): Promise<void>
  // Listing tolerates a stable paused snapshot; spending does not.
  ensureReadyToList(): Promise<void>
  getConnectionStatus(): Promise<ConnectionStatus>
  // "Unused" is whatever the provider's own source of truth says: chain state
  // over the API, or the local SPV store.
  nextUnusedAddress(exclude?: Set<string>): Promise<string>
  getUsedAddresses(addresses: string[]): Promise<string[]>
  // Null means the source cannot run the gap walk itself, and the caller has to
  // widen the window round by round through getUsedAddresses.
  scanAddressUsage(gapLimit: number): Promise<AddressUsage[] | null>
  // Every listed masternode carrying any of the values for that key. Null when
  // the source has no masternode list.
  getMasternodes(filter: MasternodeKeyFilter, values: string[]): Promise<NetworkMasternode[] | null>
  // Keeps the source following the wallet's nodes for the updates its list
  // does not carry; `fresh` are ones it has never followed. Answers the
  // proTxHashes it now follows from their registration on.
  watchMasternodes(owned: Masternode[], fresh: Masternode[]): Promise<string[]>
  // Proposals some superblock can still pay. Null while the source has none to
  // give yet: p2p before chain.db opens and the index answers.
  getProposals(): Promise<Proposal[] | null>
  // Null while the votes or the masternode list they are checked against arrive.
  getProposalTally(proposalHash: string): Promise<ProposalTally | null>
  // Each vote with the address it recovers to. Null where the source has no votes
  // to give: rpc, whose list carries only counts, or p2p while they arrive.
  getProposalVotes(proposalHash: string): Promise<GovernanceVote[] | null>
  // Fetches what the three reads above answer from: the proposal list, and the
  // votes of `proposalHash` when given. The reads themselves never fetch.
  refreshGovernance(proposalHash?: string): Promise<void>
}
