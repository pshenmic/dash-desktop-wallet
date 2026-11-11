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

// The fields every governance object carries, whatever its type.
export interface GovernanceObject {
  hash: string
  type: number
  time: number
  collateralHash: string
  data: string
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

// What a vote signs, before it is signed.
export type UnsignedVote = Omit<GovernanceVote, 'hash' | 'voter'>

// Funding votes, weighted as Core counts them: an evonode's counts four times.
export interface ProposalTally {
  yes: number
  no: number
  abstain: number
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
