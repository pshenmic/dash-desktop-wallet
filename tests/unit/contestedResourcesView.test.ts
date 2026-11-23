import { describe, expect, it } from 'vitest'
import type { ContestedResourceDto, MasternodeDto, UsernameDto } from '@renderer/api/types'
import { UsernameStatus, UsernameVoteOutcome } from '@renderer/enums/DashPay'
import {
  classifyPlatformVotingMasternodes,
  contestDisplayNameFromResource,
  contestVoteChoiceLabel,
  mergeContestedResources,
} from '@renderer/utils/contestedResources'

function makeResource(overrides: Partial<ContestedResourceDto> = {}): ContestedResourceDto {
  return {
    contractId: 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec',
    documentTypeName: 'domain',
    indexName: 'parentNameAndLabel',
    indexValues: ['EgRkYXNo', 'EgRhbGljZQ=='],
    indexValuesText: ['dash', 'a11ce'],
    endsAt: 2_000_000,
    vote: {
      contenders: [
        { identifier: 'id-own', votes: 3 },
        { identifier: 'id-other', votes: 1 },
      ],
      lockVotes: 2,
      abstainVotes: 0,
      outcome: null,
      winner: null,
    },
    ...overrides,
  }
}

function makeNode(overrides: Partial<MasternodeDto> = {}): MasternodeDto {
  return {
    proTxHash: 'node-1',
    type: 'Regular',
    status: 'ENABLED',
    posePenaltyScore: 0,
    collateralTxid: null,
    collateralVout: null,
    collateralAddress: null,
    serviceAddress: '203.0.113.1:9999',
    payeeAddress: null,
    ownerAddress: null,
    votingAddress: 'Xvoting',
    operatorPublicKey: 'aa'.repeat(48),
    ownerKeyIndex: null,
    votingKeyIndex: 0,
    operatorKeyIndex: null,
    importedRoles: [],
    importedSigningRoles: [],
    platformNodeId: null,
    platformP2PPort: null,
    platformHttpPort: null,
    lastPaidBlock: null,
    lastPaidTime: null,
    registeredHeight: null,
    isShared: false,
    shares: null,
    ...overrides,
  }
}

describe('contestedResources view helpers', () => {
  it('decodes DPNS domain poll index values and rejects non-text contests', () => {
    expect(contestDisplayNameFromResource(makeResource())).toEqual({
      label: 'a11ce',
      normalizedLabel: 'a11ce',
    })
    expect(contestDisplayNameFromResource(makeResource({
      indexValuesText: ['other', 'foo'],
    }))).toEqual({
      label: 'foo.other',
      normalizedLabel: 'foo',
    })
    expect(contestDisplayNameFromResource(makeResource({
      documentTypeName: 'otherDoc',
      indexValuesText: ['alpha', 'beta'],
    }))).toEqual({
      label: 'alpha/beta',
      normalizedLabel: 'alpha/beta',
    })
    expect(contestDisplayNameFromResource(makeResource({
      indexValuesText: ['dash', null],
    }))).toBeNull()
  })

  it('merges network contested resources with wallet DashPay usernames while preserving mixed-case labels and ended wallet contests', () => {
    const walletVoting: UsernameDto = {
      identifier: 'id-own',
      label: 'Alice',
      normalizedLabel: 'a11ce',
      isContested: true,
      status: UsernameStatus.Voting,
      documentId: 'doc-1',
      votesLock: 0,
      votesAbstain: 0,
      voteEndsAt: 1_999_000,
      voteOutcome: null,
      voteWinner: null,
      contenders: [{ identifier: 'id-own', votes: 1 }],
    }
    const walletEnded: UsernameDto = {
      identifier: 'id-own',
      label: 'Bob',
      normalizedLabel: 'b0b',
      isContested: true,
      status: UsernameStatus.Locked,
      documentId: 'doc-2',
      votesLock: 10,
      votesAbstain: 2,
      voteEndsAt: 1_000_000,
      voteOutcome: UsernameVoteOutcome.Locked,
      voteWinner: null,
      contenders: [{ identifier: 'id-own', votes: 4 }],
    }
    const networkOnly = makeResource({
      indexValues: ['EgRkYXNo', 'EgR0ZXN0'],
      indexValuesText: ['dash', 'testname'],
      vote: {
        contenders: [{ identifier: 'id-wallet-2', votes: 5 }],
        lockVotes: 1,
        abstainVotes: 0,
        outcome: null,
        winner: null,
      },
    })

    const merged = mergeContestedResources(
      [makeResource(), networkOnly],
      [walletVoting, walletEnded],
      new Set(['id-own', 'id-wallet-2']),
    )

    expect(merged).toHaveLength(3)
    const alice = merged.find(item => item.normalizedLabel === 'a11ce')!
    expect(alice.label).toBe('Alice')
    expect(alice.documentId).toBe('doc-1')
    expect(alice.votesLock).toBe(2)
    expect(alice.walletIdentifiers).toEqual(['id-own'])
    expect(alice.voteRequest).toEqual({
      contractId: 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec',
      documentTypeName: 'domain',
      indexName: 'parentNameAndLabel',
      indexValues: ['EgRkYXNo', 'EgRhbGljZQ=='],
    })

    const bob = merged.find(item => item.normalizedLabel === 'b0b')!
    expect(bob.voteOutcome).toBe(UsernameVoteOutcome.Locked)
    expect(bob.voteRequest).toBeNull()

    const netOnly = merged.find(item => item.normalizedLabel === 'testname')!
    expect(netOnly.walletIdentifiers).toEqual(['id-wallet-2'])
    expect(netOnly.voteRequest?.indexValues).toEqual(['EgRkYXNo', 'EgR0ZXN0'])
  })

  it('classifies masternodes for Platform voting without requiring collateral outpoints', () => {
    const derivedNoCollateral = makeNode({ proTxHash: 'derived', votingKeyIndex: 1 })
    const importedSignable = makeNode({
      proTxHash: 'imported',
      votingKeyIndex: null,
      importedRoles: ['voting'],
      importedSigningRoles: ['voting'],
    })
    const watchOnly = makeNode({
      proTxHash: 'watch',
      votingKeyIndex: null,
      importedRoles: ['voting'],
      importedSigningRoles: [],
    })
    const banned = makeNode({ proTxHash: 'banned', status: 'POSE_BANNED' })
    const pending = makeNode({ proTxHash: 'pending', status: 'REGISTERING' })

    const res = classifyPlatformVotingMasternodes([
      derivedNoCollateral,
      importedSignable,
      watchOnly,
      banned,
      pending,
    ])
    expect(res.eligible.map(n => n.proTxHash)).toEqual(['derived', 'imported'])
    expect(res.ineligible.map(item => item.node.proTxHash)).toEqual(['watch', 'banned', 'pending'])
    expect(contestVoteChoiceLabel({ kind: 'towardsIdentity', identifier: 'id-1' })).toBe('id-1')
    expect(contestVoteChoiceLabel({ kind: 'lock' })).toBe('Lock name')
    expect(contestVoteChoiceLabel({ kind: 'abstain' })).toBe('Abstain')
  })
})
