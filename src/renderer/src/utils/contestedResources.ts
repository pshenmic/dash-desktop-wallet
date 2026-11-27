import type {
  ContestedResourceDto,
  ContestedResourceVoteChoice,
  MasternodeDto,
  UsernameDto,
} from '@renderer/api/types'
import { VOTE_CONTEST_COPY } from '@renderer/constants/dao'
import { DPNS_PARENT_DOMAIN } from '@renderer/constants/dpns'
import { VOTE_PROPOSAL_COPY } from '@renderer/constants/governanceProposals'
import { POSE_BANNED_MASTERNODE_STATUS, REGISTERING_MASTERNODE_STATUS } from '@renderer/constants/masternodes'
import { UsernameStatus, UsernameVoteOutcome } from '@renderer/enums/DashPay'
import type { MergedNameContest, PlatformVotingEligibility } from '@renderer/types/Dao'
import { walletNameContests } from './nameContests'

function mapResourceOutcome(outcome: ContestedResourceDto['vote']['outcome']): UsernameVoteOutcome | null {
  switch (outcome) {
    case 'WonByIdentity': return UsernameVoteOutcome.WonByIdentity
    case 'Locked': return UsernameVoteOutcome.Locked
    case 'NoWinner': return UsernameVoteOutcome.NoWinner
    default: return null
  }
}

export function contestDisplayNameFromResource(
  resource: ContestedResourceDto,
): { label: string; normalizedLabel: string } | null {
  if (
    resource.documentTypeName === 'domain'
    && resource.indexValuesText.length >= 2
    && resource.indexValuesText[0] != null
    && resource.indexValuesText[1] != null
  ) {
    const parent = resource.indexValuesText[0]
    const normalizedLabel = resource.indexValuesText[1]
    const label = parent === DPNS_PARENT_DOMAIN ? normalizedLabel : `${normalizedLabel}.${parent}`
    return { label, normalizedLabel }
  }
  if (resource.indexValuesText.some(value => value == null)) return null
  const joined = (resource.indexValuesText as string[]).join('/')
  if (joined === '') return null
  return { label: joined, normalizedLabel: joined }
}

export function mergeContestedResources(
  networkResources: ContestedResourceDto[],
  walletUsernames: UsernameDto[],
  walletIdentityIds: ReadonlySet<string>,
): MergedNameContest[] {
  const byKey = new Map<string, MergedNameContest>()

  for (const contest of walletNameContests(walletUsernames)) {
    const walletIdentifiers = [...new Set([
      ...contest.walletIdentifiers,
      ...contest.contenders.map(c => c.identifier).filter(id => walletIdentityIds.has(id)),
    ])]
    byKey.set(contest.normalizedLabel, {
      ...contest,
      walletIdentifiers,
      voteRequest: null,
    })
  }

  for (const resource of networkResources) {
    const display = contestDisplayNameFromResource(resource)
    if (display == null) continue
    const existing = byKey.get(display.normalizedLabel)
    const walletIdentifiers = [...new Set([
      ...(existing?.walletIdentifiers ?? []),
      ...resource.vote.contenders.map(c => c.identifier).filter(id => walletIdentityIds.has(id)),
    ])]
    byKey.set(display.normalizedLabel, {
      identifier: existing?.identifier ?? resource.vote.contenders[0]?.identifier ?? '',
      label: existing?.label ?? display.label,
      normalizedLabel: display.normalizedLabel,
      isContested: true,
      status: existing?.status ?? UsernameStatus.Voting,
      documentId: existing?.documentId ?? null,
      votesLock: resource.vote.lockVotes,
      votesAbstain: resource.vote.abstainVotes,
      voteEndsAt: resource.endsAt,
      voteOutcome: mapResourceOutcome(resource.vote.outcome),
      voteWinner: resource.vote.winner,
      contenders: resource.vote.contenders,
      walletIdentifiers,
      voteRequest: {
        contractId: resource.contractId,
        documentTypeName: resource.documentTypeName,
        indexName: resource.indexName,
        indexValues: resource.indexValues,
      },
    })
  }

  return [...byKey.values()]
}

export function classifyPlatformVotingMasternodes(nodes: MasternodeDto[]): PlatformVotingEligibility {
  const eligible: MasternodeDto[] = []
  const ineligible: Array<{ node: MasternodeDto; reason: string }> = []
  for (const node of nodes) {
    if (node.status === REGISTERING_MASTERNODE_STATUS) {
      ineligible.push({ node, reason: VOTE_PROPOSAL_COPY.pendingRegistrationReason })
    } else if (node.votingKeyIndex == null && !node.importedSigningRoles.includes('voting')) {
      ineligible.push({
        node,
        reason: node.importedRoles.includes('voting')
          ? VOTE_PROPOSAL_COPY.watchOnlyVotingKeyReason
          : VOTE_PROPOSAL_COPY.missingVotingKeyReason,
      })
    } else if (node.status === POSE_BANNED_MASTERNODE_STATUS) {
      ineligible.push({ node, reason: VOTE_PROPOSAL_COPY.poseBannedReason })
    } else {
      eligible.push(node)
    }
  }
  return { eligible, ineligible }
}

export function contestVoteChoiceLabel(choice: ContestedResourceVoteChoice): string {
  switch (choice.kind) {
    case 'towardsIdentity': return choice.identifier
    case 'lock': return VOTE_CONTEST_COPY.lockOption
    case 'abstain': return VOTE_CONTEST_COPY.abstainOption
  }
}
