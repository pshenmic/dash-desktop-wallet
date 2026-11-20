export type VoteOutcome = 'yes' | 'no' | 'abstain'

// A governance proposal as its object's data states it. Epochs and createdAt
// are unix seconds.
export interface Proposal {
  hash: string
  name: string
  url: string
  paymentAddress: string
  paymentDuffs: bigint
  startEpoch: number
  endEpoch: number
  createdAt: number
  collateralHash: string
}

// A vote as a peer relayed it, with Core's codes. voter is the address its signature
// recovers to (null for none); it counts only as the collateral's node's voting key.
export interface GovernanceVote {
  hash: string
  collateralTxid: string
  collateralVout: number
  parentHash: string
  outcome: number
  signal: number
  time: number
  voter: string | null
}

// What signing a node's vote needs, once the node passed the checks before relaying.
// votingKeyIndex is null when an imported key signs instead.
export interface VotingNode {
  proTxHash: string
  votingKeyIndex: number | null
  votingAddress: string
  collateralTxid: string
  collateralVout: number
}

// Funding votes, weighted as Core counts them: an evonode's counts four times.
export interface ProposalTally {
  yes: number
  no: number
  abstain: number
}

// Platform's ContestedDocumentVotePollWinnerInfo variants.
export type ContestedResourceOutcome = 'WonByIdentity' | 'Locked' | 'NoWinner'

// The tally of one Platform vote poll. A contender is an identity that has a
// document contending for the resource; lock and abstain are the two other choices.
export interface ContestedResourceVote {
  contenders: Array<{identifier: string; votes: number}>
  lockVotes: number
  abstainVotes: number
  outcome: ContestedResourceOutcome | null
  winner: string | null
}

// One open Platform vote poll. Index values stay base64 of their serialized
// form because that is what a vote transition carries; only the contract knows
// how to read them as a label or a number.
export interface ContestedResource {
  contractId: string
  documentTypeName: string
  indexName: string
  indexValues: string[]
  endsAt: number
  vote: ContestedResourceVote
}

// peers asked for the vote after its announcement; accepted is how many of them
// then served it back, which Core does only for a vote it kept.
export interface VoteRelay {
  peers: number
  accepted: number
}

export interface VoteResult extends VoteRelay {
  proTxHash: string
}
