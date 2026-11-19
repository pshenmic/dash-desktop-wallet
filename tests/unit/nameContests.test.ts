import { describe, expect, it } from 'vitest'
import type { UsernameDto } from '@renderer/api/types'
import { UsernameStatus, UsernameVoteOutcome } from '@renderer/enums/DashPay'
import { ContestSegment, ContestStatus } from '@renderer/enums/Masternodes'
import { contestLeader, contestStatus, filterContests, walletNameContests } from '@renderer/utils/nameContests'

const votingName: UsernameDto = {
  identifier: 'first',
  label: 'Alice',
  normalizedLabel: 'a11ce',
  isContested: true,
  status: UsernameStatus.Voting,
  documentId: null,
  votesLock: 10,
  votesAbstain: 5,
  voteEndsAt: 100,
  voteOutcome: null,
  voteWinner: null,
  contenders: [{ identifier: 'first', votes: 12 }, { identifier: 'second', votes: 3 }],
}

describe('Wallet contested resources', () => {
  it('groups wallet entries for the same resource and excludes names without a vote', () => {
    const contests = walletNameContests([
      votingName,
      { ...votingName, identifier: 'second' },
      { ...votingName, normalizedLabel: 'other', status: UsernameStatus.Registered, voteEndsAt: null },
    ])
    expect(contests).toHaveLength(1)
    expect(contests[0].walletIdentifiers).toEqual(['first', 'second'])
    expect(contestLeader(contests[0])).toEqual({ label: 'first', votes: 12, share: 0.4 })
  })

  it('preserves the backend outcome and keeps elapsed polls without outcomes pending', () => {
    const [pending, ended] = walletNameContests([
      votingName,
      {
        ...votingName,
        label: 'Locked',
        normalizedLabel: '10cked',
        status: UsernameStatus.Locked,
        voteOutcome: UsernameVoteOutcome.Locked,
      },
    ])
    expect(contestStatus(pending, 100)).toEqual({ status: ContestStatus.Open, waitingForOutcome: true })
    expect(contestStatus(ended, 100)).toEqual({ status: ContestStatus.Locked, waitingForOutcome: false })
    expect(filterContests([pending, ended], { query: '', segment: ContestSegment.Ended, now: 100, network: 'testnet' })).toEqual([ended])
  })
})
