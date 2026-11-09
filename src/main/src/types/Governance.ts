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

// A vote as a peer relayed it. voter is the address its signature recovers to,
// null when it recovers to none; it counts only where it is the voting key of
// the node holding the collateral. Codes are Core's.
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

// peers is how many asked for the vote after its announcement.
export interface VoteResult {
  proTxHash: string
  peers: number
}
