import type { MasternodeDto, Network, ProposalDto, ProposalTally } from '@renderer/api/types'
import {
  PROPOSAL_ENDING_SOON_MS,
  VOTE_PROPOSAL_COPY,
} from '@renderer/constants/governanceProposals'
import {
  MASTERNODE_VOTE_WEIGHT,
  POSE_BANNED_MASTERNODE_STATUS,
} from '@renderer/constants/masternodes'
import { ProposalSegment, ProposalSort, ProposalStatus } from '@renderer/enums/Masternodes'
import type { ProposalFilterOptions, VotingNodeEligibility } from '@renderer/types/GovernanceProposals'

export function proposalStartMs(proposal: Pick<ProposalDto, 'startEpoch'>): number {
  return proposal.startEpoch * 1000
}

export function proposalEndMs(proposal: Pick<ProposalDto, 'endEpoch'>): number {
  return proposal.endEpoch * 1000
}

export function proposalStatus(proposal: Pick<ProposalDto, 'startEpoch' | 'endEpoch'>, nowMs: number): ProposalStatus {
  if (proposalEndMs(proposal) <= nowMs) return ProposalStatus.Ended
  if (proposalStartMs(proposal) > nowMs) return ProposalStatus.Upcoming
  return ProposalStatus.Active
}

export function isProposalEndingSoon(
  proposal: Pick<ProposalDto, 'startEpoch' | 'endEpoch'>,
  nowMs: number,
  network: Network | undefined,
): boolean {
  if (network == null || proposalStatus(proposal, nowMs) !== ProposalStatus.Active) return false
  const remaining = proposalEndMs(proposal) - nowMs
  return remaining > 0 && remaining <= PROPOSAL_ENDING_SOON_MS[network]
}

export function filterProposals(proposals: ProposalDto[], { query, segment, now, network }: ProposalFilterOptions): ProposalDto[] {
  const needle = query.trim().toLowerCase()
  return proposals.filter(proposal => {
    if (needle !== '' && ![proposal.name, proposal.hash, proposal.paymentAddress].some(field => field.toLowerCase().includes(needle))) {
      return false
    }
    const status = proposalStatus(proposal, now)
    switch (segment) {
      case ProposalSegment.Ended: return status === ProposalStatus.Ended
      case ProposalSegment.Upcoming: return status === ProposalStatus.Upcoming
      case ProposalSegment.EndingSoon: return isProposalEndingSoon(proposal, now, network)
      case ProposalSegment.Active: return status === ProposalStatus.Active
    }
  })
}

export function sortProposals(proposals: ProposalDto[], sort: ProposalSort, segment: ProposalSegment): ProposalDto[] {
  const direction = segment === ProposalSegment.Ended ? -1 : 1
  return [...proposals].sort((a, b) => {
    if (sort === ProposalSort.HighestAmount) {
      if (b.paymentDuffs !== a.paymentDuffs) return b.paymentDuffs > a.paymentDuffs ? 1 : -1
    }
    if (sort === ProposalSort.Newest) {
      const created = b.createdAt - a.createdAt
      if (created !== 0) return created
    }
    if (sort === ProposalSort.EndingSoon) {
      const ends = (a.endEpoch - b.endEpoch) * direction
      if (ends !== 0) return ends
    }
    return a.name.localeCompare(b.name)
  })
}

export function totalProposalVotes(tally: ProposalTally | null): number {
  if (tally == null) return 0
  return tally.yes + tally.no + tally.abstain
}

export function netProposalVotes(tally: ProposalTally | null): number {
  if (tally == null) return 0
  return tally.yes - tally.no
}

export function safeExternalProposalUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.toString()
    return null
  } catch {
    return null
  }
}

export function masternodeVoteWeight(node: Pick<MasternodeDto, 'type'>): number {
  return MASTERNODE_VOTE_WEIGHT[node.type] ?? 1
}

export function totalSelectedVoteWeight(nodes: MasternodeDto[], selectedHashes: ReadonlySet<string>): number {
  return nodes
    .filter(node => selectedHashes.has(node.proTxHash))
    .reduce((sum, node) => sum + masternodeVoteWeight(node), 0)
}

export function classifyVotingMasternodes(nodes: MasternodeDto[]): VotingNodeEligibility {
  const eligible: MasternodeDto[] = []
  const ineligible: Array<{ node: MasternodeDto; reason: string }> = []
  for (const node of nodes) {
    if (node.votingKeyIndex == null) {
      ineligible.push({ node, reason: VOTE_PROPOSAL_COPY.missingVotingKeyReason })
    } else if (node.status === POSE_BANNED_MASTERNODE_STATUS) {
      ineligible.push({ node, reason: VOTE_PROPOSAL_COPY.poseBannedReason })
    } else if (node.collateralTxid == null || node.collateralVout == null) {
      ineligible.push({ node, reason: VOTE_PROPOSAL_COPY.missingCollateralReason })
    } else {
      eligible.push(node)
    }
  }
  return { eligible, ineligible }
}
