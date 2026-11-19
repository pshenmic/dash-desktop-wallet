import {GovernanceObject as SDKGovernanceObject, GovernanceVote as SDKGovernanceVote, utils as sdkUtils, VoteSignal} from 'dash-core-sdk'
import type {GovernanceProposal} from 'dash-core-sdk'
import {
  DUFFS_PER_DASH,
  GOVERNANCE_UPDATE_MIN_SECONDS,
  MASTERNODE_VOTE_WEIGHT,
  POSE_BANNED_STATUS,
  SUPERBLOCK_CYCLE_SECONDS,
  VOTE_OUTCOME_CODE,
} from '../constants/chain'
import {DashscanProposal} from '../types/Dashscan'
import {GovernanceVote, Proposal, ProposalTally, VoteOutcome, VotingNode} from '../types/Governance'
import {Masternode, MasternodeType, NetworkMasternode} from '../types/Masternode'
import {Network} from '../types/Network'
import {isHash, requireProTxHash} from './providerTx'

// Proposal data is JSON, either bare or wrapped as [["proposal", {...}]] by
// clients older than v0.14.
export function proposalOf(object: SDKGovernanceObject): Proposal | null {
  let fields: GovernanceProposal
  try {
    fields = object.proposal()
  } catch {
    return null
  }
  const {name, url, payment_address: paymentAddress, payment_amount: amount, start_epoch: startEpoch, end_epoch: endEpoch} = fields
  if (typeof name !== 'string' || typeof paymentAddress !== 'string' || typeof amount !== 'number'
    || typeof startEpoch !== 'number' || typeof endEpoch !== 'number') return null
  return {
    hash: object.hash(),
    name,
    url: typeof url === 'string' ? url : '',
    paymentAddress,
    paymentDuffs: proposalDuffs(amount),
    startEpoch,
    endEpoch,
    createdAt: object.time,
    collateralHash: object.collateralHash,
  }
}

export function dashscanProposal(row: DashscanProposal): Proposal {
  return {
    hash: row.hash,
    name: row.name,
    url: row.url,
    paymentAddress: row.paymentAddress,
    paymentDuffs: proposalDuffs(row.paymentAmount),
    startEpoch: row.startEpoch,
    endEpoch: row.endEpoch,
    createdAt: Math.floor(Date.parse(row.creationTime) / 1000),
    collateralHash: row.collateralHash,
  }
}

// A proposal states its amount as a JSON number of DASH.
function proposalDuffs(amount: number): bigint {
  return BigInt(Math.round(amount * Number(DUFFS_PER_DASH)))
}

export function requireVoteRequest(proposalHash: string, outcome: VoteOutcome, proTxHashes: string[]): void {
  if (!isHash(proposalHash)) throw new Error('Not a proposal hash: 64 hex characters')
  if (!Object.hasOwn(VOTE_OUTCOME_CODE, outcome)) throw new Error(`Unknown vote outcome: ${outcome}`)
  if (!Array.isArray(proTxHashes) || proTxHashes.length === 0) throw new Error('Name at least one masternode to vote with')
  proTxHashes.forEach(requireProTxHash)
  if (new Set(proTxHashes).size !== proTxHashes.length) throw new Error('A masternode is named twice')
}

// now is unix seconds.
export function isStaleProposal({endEpoch}: Pick<Proposal, 'endEpoch'>, now: number, network: Network): boolean {
  return endEpoch < now - SUPERBLOCK_CYCLE_SECONDS[network]
}

// The vote as main and the renderer read it, with the address its signature
// recovers to under the network's rule; null for a signature that recovers to no key.
export function governanceVote(vote: SDKGovernanceVote, network: Network): GovernanceVote {
  let voter: string | null = null
  try {
    voter = vote.recoverSigner(network).getAddress(sdkUtils.networkValueToEnumValue(network))
  } catch {
    voter = null
  }
  return {
    hash: vote.hash(),
    collateralTxid: vote.masternodeOutpoint.txId,
    collateralVout: vote.masternodeOutpoint.vOut,
    parentHash: vote.parentHash,
    outcome: vote.outcome,
    signal: vote.signal,
    time: vote.time,
    voter,
  }
}

// The node's latest funding vote that its current voting key signed, which is
// the one Core holds a new vote against.
export function lastVoteTime(votes: GovernanceVote[], {collateralTxid, collateralVout, votingAddress}: NetworkMasternode): number | null {
  const own = votes.filter(vote => vote.signal === VoteSignal.FUNDING && vote.voter === votingAddress
    && vote.collateralTxid === collateralTxid && vote.collateralVout === collateralVout)
  return own.length === 0 ? null : Math.max(...own.map(({time}) => time))
}

// The checks Core's own wallet runs before relaying. `votes` is null where the
// source has none to check the hour against; `time` is the new vote's, unix seconds.
export function requireVotingNode(owned: Masternode[], proTxHash: string, votes: GovernanceVote[] | null, time: number): VotingNode {
  const node = owned.find(candidate => candidate.proTxHash === proTxHash)
  if (node == null) throw new Error(`Masternode ${proTxHash} is not one of this wallet's`)
  if (node.status === POSE_BANNED_STATUS) throw new Error(`Masternode ${proTxHash} is PoSe-banned`)
  const {votingKeyIndex, votingAddress, collateralTxid, collateralVout} = node
  if (votingKeyIndex == null) throw new Error(`Masternode ${proTxHash} carries a voting key this wallet does not derive`)
  if (collateralTxid == null || collateralVout == null) throw new Error(`Masternode ${proTxHash} has no known collateral yet`)
  const last = votes == null ? null : lastVoteTime(votes, node)
  if (last != null && last > time - GOVERNANCE_UPDATE_MIN_SECONDS) {
    throw new Error(`Masternode ${proTxHash} voted on this proposal at ${new Date(last * 1000).toISOString()}; Core drops another vote within the hour`)
  }
  return {proTxHash, votingKeyIndex, votingAddress, collateralTxid, collateralVout}
}

// Core keeps each node's latest vote per signal and drops one whose key is not
// the node's current voting key.
export function proposalTally(votes: GovernanceVote[], masternodes: NetworkMasternode[]): ProposalTally {
  const nodes = new Map(masternodes.map(node => [`${node.collateralTxid}:${node.collateralVout}`, node]))
  const latest = new Map<string, GovernanceVote>()
  for (const vote of votes) {
    const outpoint = `${vote.collateralTxid}:${vote.collateralVout}`
    if (vote.signal !== VoteSignal.FUNDING || vote.voter == null || vote.voter !== nodes.get(outpoint)?.votingAddress) continue
    if ((latest.get(outpoint)?.time ?? -1) < vote.time) latest.set(outpoint, vote)
  }
  const tally: ProposalTally = {yes: 0, no: 0, abstain: 0}
  const outcomes = Object.keys(VOTE_OUTCOME_CODE) as VoteOutcome[]
  for (const [outpoint, vote] of latest) {
    const outcome = outcomes.find(name => VOTE_OUTCOME_CODE[name] === vote.outcome)
    if (outcome != null) tally[outcome] += MASTERNODE_VOTE_WEIGHT[nodes.get(outpoint)!.type as MasternodeType] ?? 1
  }
  return tally
}
