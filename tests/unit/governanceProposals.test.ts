import { describe, expect, it } from 'vitest'
import type { MasternodeDto, ProposalDto } from '@renderer/api/types'
import { ProposalSegment, ProposalSort, ProposalStatus } from '@renderer/enums/Masternodes'
import {
  classifyVotingMasternodes,
  filterProposals,
  isProposalEndingSoon,
  netProposalVotes,
  proposalStatus,
  safeExternalProposalUrl,
  sortProposals,
  totalProposalVotes,
  totalSelectedVoteWeight,
} from '@renderer/utils/governanceProposals'

const NOW = 1_700_000_000_000
const NOW_SEC = Math.floor(NOW / 1000)

function makeProposal(overrides: Partial<ProposalDto> = {}): ProposalDto {
  return {
    hash: 'a'.repeat(64),
    collateralHash: 'b'.repeat(64),
    name: 'core-team-compensation',
    url: 'https://www.dashcentral.org/p/core-team',
    startEpoch: NOW_SEC - 3600,
    endEpoch: NOW_SEC + 3600,
    paymentAddress: 'Xpayment',
    paymentDuffs: 500_000_000_000n,
    createdAt: NOW_SEC - 7200,
    ...overrides,
  }
}

function makeNode(overrides: Partial<MasternodeDto> = {}): MasternodeDto {
  return {
    proTxHash: 'node-1',
    type: 'Regular',
    status: 'ENABLED',
    posePenaltyScore: 0,
    collateralTxid: 'c'.repeat(64),
    collateralVout: 0,
    collateralAddress: 'Xcollateral',
    serviceAddress: '203.0.113.1:9999',
    payeeAddress: 'Xpayee',
    ownerAddress: 'Xowner',
    votingAddress: 'Xvoting',
    operatorPublicKey: 'd'.repeat(96),
    ownerKeyIndex: 0,
    votingKeyIndex: 0,
    operatorKeyIndex: 0,
    importedRoles: [],
    platformNodeId: null,
    platformP2PPort: null,
    platformHttpPort: null,
    lastPaidBlock: 100,
    lastPaidTime: 1000,
    registeredHeight: 50,
    ...overrides,
  }
}

describe('Governance proposal helpers', () => {
  it('classifies active, ending-soon, upcoming and ended proposals', () => {
    const active = makeProposal({ hash: '1', endEpoch: NOW_SEC + 10 * 86_400 })
    const endingSoon = makeProposal({ hash: '2', endEpoch: NOW_SEC + 3600 })
    const upcoming = makeProposal({ hash: '3', startEpoch: NOW_SEC + 3600, endEpoch: NOW_SEC + 7200 })
    const ended = makeProposal({ hash: '4', startEpoch: NOW_SEC - 7200, endEpoch: NOW_SEC - 60 })
    const all = [active, endingSoon, upcoming, ended]

    expect(proposalStatus(active, NOW)).toBe(ProposalStatus.Active)
    expect(proposalStatus(upcoming, NOW)).toBe(ProposalStatus.Upcoming)
    expect(proposalStatus(ended, NOW)).toBe(ProposalStatus.Ended)
    expect(isProposalEndingSoon(endingSoon, NOW, 'mainnet')).toBe(true)
    expect(isProposalEndingSoon(active, NOW, 'mainnet')).toBe(false)

    expect(filterProposals(all, { query: '', segment: ProposalSegment.Active, now: NOW, network: 'mainnet' })).toEqual([active, endingSoon])
    expect(filterProposals(all, { query: '', segment: ProposalSegment.EndingSoon, now: NOW, network: 'mainnet' })).toEqual([endingSoon])
    expect(filterProposals(all, { query: '', segment: ProposalSegment.Upcoming, now: NOW, network: 'mainnet' })).toEqual([upcoming])
    expect(filterProposals(all, { query: '', segment: ProposalSegment.Ended, now: NOW, network: 'mainnet' })).toEqual([ended])
  })

  it('sorts proposals by ending time, newest, amount and name', () => {
    const small = makeProposal({ hash: '1', name: 'beta', paymentDuffs: 100n, endEpoch: NOW_SEC + 500, createdAt: 10 })
    const large = makeProposal({ hash: '2', name: 'alpha', paymentDuffs: 900n, endEpoch: NOW_SEC + 100, createdAt: 20 })
    expect(sortProposals([small, large], ProposalSort.EndingSoon, ProposalSegment.Active).map(p => p.hash)).toEqual(['2', '1'])
    expect(sortProposals([small, large], ProposalSort.HighestAmount, ProposalSegment.Active).map(p => p.hash)).toEqual(['2', '1'])
    expect(sortProposals([small, large], ProposalSort.Newest, ProposalSegment.Active).map(p => p.hash)).toEqual(['2', '1'])
    expect(sortProposals([small, large], ProposalSort.Name, ProposalSegment.Active).map(p => p.hash)).toEqual(['2', '1'])
  })

  it('computes vote tallies, validates external URLs and classifies voting masternodes', () => {
    expect(totalProposalVotes({ yes: 12, no: 3, abstain: 2 })).toBe(17)
    expect(netProposalVotes({ yes: 12, no: 3, abstain: 2 })).toBe(9)
    expect(safeExternalProposalUrl('https://dash.org/proposal')).toBe('https://dash.org/proposal')
    expect(safeExternalProposalUrl('javascript:alert(1)')).toBeNull()

    const regular = makeNode({ proTxHash: 'reg', type: 'Regular' })
    const evo = makeNode({ proTxHash: 'evo', type: 'Evo' })
    const banned = makeNode({ proTxHash: 'banned', status: 'POSE_BANNED' })
    const external = makeNode({ proTxHash: 'ext', votingKeyIndex: null })
    const unindexed = makeNode({ proTxHash: 'unidx', collateralTxid: null })

    const classified = classifyVotingMasternodes([regular, evo, banned, external, unindexed])
    expect(classified.eligible.map(n => n.proTxHash)).toEqual(['reg', 'evo'])
    expect(classified.ineligible).toHaveLength(3)
    expect(totalSelectedVoteWeight(classified.eligible, new Set(['reg', 'evo']))).toBe(5)
  })
})
