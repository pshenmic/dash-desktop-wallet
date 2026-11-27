import {Username, UsernameCheck, UsernameVote} from '../types/Username'

// A poll's end date is fixed when its first contender lands, so the earliest
// contender document dates it.
export function scheduledVoteEnd(createdAts: number[], durationMs: number): number | null {
  return createdAts.length > 0 ? Math.min(...createdAts) + durationMs : null
}

// A name known from a contest poll or a domain document, kept listed when its
// status read fails so a transient Platform error cannot hide it.
export function unverifiedUsername(
  identifier: string,
  label: string,
  normalizedLabel: string,
  contested: boolean,
): Username {
  return {
    identifier,
    label,
    normalizedLabel,
    status: contested ? 'voting' : 'registered',
    isContested: contested,
    documentId: null,
    votesLock: null,
    votesAbstain: null,
    voteEndsAt: null,
    voteOutcome: null,
    voteWinner: null,
    contenders: [],
  }
}

// A contested name has no domain document until its vote awards it, so the
// contest is consulted only when the document is absent.
export function usernameStatusOf(
  identifier: string,
  domainOwner: string | null,
  vote: UsernameVote | null,
): UsernameCheck['status'] {
  if (domainOwner != null) return domainOwner === identifier ? 'registered' : 'taken'
  if (vote == null) return 'missing'

  switch (vote.outcome) {
    case 'WonByIdentity': return vote.winner === identifier ? 'registered' : 'taken'
    case 'Locked': return 'locked'
    case 'NoWinner': return 'missing'
    case null: return vote.contenders.some(contender => contender.identifier === identifier) ? 'voting' : 'missing'
  }
}
