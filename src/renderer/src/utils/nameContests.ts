import type { Network, UsernameDto } from '@renderer/api/types'
import { CONTEST_ROW_COPY, ENDING_SOON_MS, PERCENT_SCALE } from '@renderer/constants/nameContests'
import { UsernameStatus, UsernameVoteOutcome } from '@renderer/enums/DashPay'
import { ContestSegment, ContestSort, ContestStatus } from '@renderer/enums/Masternodes'
import type { ContestDisplayStatus, ContestFilter, ContestLeader, NameContest } from '@renderer/types/NameContests'
import { matchesDpnsLabel, stripDpnsInput } from './dpnsLabel'

export function walletNameContests(usernames: UsernameDto[]): NameContest[] {
  const contests = new Map<string, NameContest>()
  for (const username of usernames) {
    if (!username.isContested || (username.voteOutcome == null && username.status !== UsernameStatus.Voting)) continue
    const existing = contests.get(username.normalizedLabel)
    const walletIdentifiers = [...new Set([...(existing?.walletIdentifiers ?? []), username.identifier])]
    const latest = existing != null && (existing.voteEndsAt ?? 0) > (username.voteEndsAt ?? 0)
      ? existing : username
    contests.set(username.normalizedLabel, { ...latest, walletIdentifiers })
  }
  return [...contests.values()]
}

export function contestStatus(contest: NameContest, now: number): ContestDisplayStatus {
  switch (contest.voteOutcome) {
    case UsernameVoteOutcome.WonByIdentity: return { status: ContestStatus.Awarded, waitingForOutcome: false }
    case UsernameVoteOutcome.Locked: return { status: ContestStatus.Locked, waitingForOutcome: false }
    case UsernameVoteOutcome.NoWinner: return { status: ContestStatus.NoWinner, waitingForOutcome: false }
    default: return { status: ContestStatus.Open, waitingForOutcome: contest.voteEndsAt != null && contest.voteEndsAt <= now }
  }
}

export function isEndingSoon(contest: NameContest, now: number, network: Network | undefined): boolean {
  if (contest.voteOutcome != null || contest.voteEndsAt == null || network == null) return false
  const left = contest.voteEndsAt - now
  return left > 0 && left <= ENDING_SOON_MS[network]
}

export function filterContests(contests: NameContest[], { query, segment, now, network }: ContestFilter): NameContest[] {
  const needle = stripDpnsInput(query)
  return contests.filter(contest => {
    if (needle !== '' && !matchesDpnsLabel([contest.label, contest.normalizedLabel], needle)) return false
    if (segment === ContestSegment.Ended) return contest.voteOutcome != null
    if (segment === ContestSegment.EndingSoon) return isEndingSoon(contest, now, network)
    return contest.voteOutcome == null
  })
}

export function totalContestVotes(contest: NameContest): number {
  return contest.contenders.reduce((sum, contender) => sum + contender.votes, (contest.votesLock ?? 0) + (contest.votesAbstain ?? 0))
}

export function voteShare(votes: number, total: number): number {
  return total > 0 ? votes / total : 0
}

export function formatShare(share: number): string {
  return `${Math.round(share * PERCENT_SCALE)}%`
}

export function contestLeader(contest: NameContest): ContestLeader {
  const choices = [
    ...contest.contenders.map(({ identifier, votes }) => ({ label: identifier, votes })),
    { label: CONTEST_ROW_COPY.lock, votes: contest.votesLock ?? 0 },
    { label: CONTEST_ROW_COPY.abstain, votes: contest.votesAbstain ?? 0 },
  ].sort((a, b) => b.votes - a.votes)
  const [first, second] = choices
  if (first.votes === 0) return { label: null, votes: 0, share: 0 }
  return {
    label: first.votes === second.votes ? CONTEST_ROW_COPY.tie : first.label,
    votes: first.votes,
    share: voteShare(first.votes, totalContestVotes(contest)),
  }
}

export function sortContests(contests: NameContest[], sort: ContestSort, segment: ContestSegment): NameContest[] {
  const direction = segment === ContestSegment.Ended ? -1 : 1
  return [...contests].sort((a, b) => {
    if (sort === ContestSort.MostVotes) {
      const votes = totalContestVotes(b) - totalContestVotes(a)
      if (votes !== 0) return votes
    }
    if (sort === ContestSort.EndingSoon) {
      if (a.voteEndsAt == null && b.voteEndsAt != null) return 1
      if (a.voteEndsAt != null && b.voteEndsAt == null) return -1
      const ends = ((a.voteEndsAt ?? 0) - (b.voteEndsAt ?? 0)) * direction
      if (ends !== 0) return ends
    }
    return a.normalizedLabel.localeCompare(b.normalizedLabel)
  })
}
