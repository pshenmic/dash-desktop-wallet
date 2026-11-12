export enum MasternodesTab {
  Nodes = 'nodes',
  Proposals = 'proposals',
  ContestedResources = 'contested-resources',
}

export enum NodeSegment {
  All = 'all',
  VotingKey = 'voting-key',
  NoVotingKey = 'no-voting-key',
  Issues = 'issues',
}

export enum MasternodeDetailModal {
  UpdateRegistrar = 'update-registrar',
  UpdateService = 'update-service',
  Revoke = 'revoke',
}

export enum RegistrarKeyChoiceKind {
  Keep = 'keep',
  Wallet = 'wallet',
  External = 'external',
}

export enum PayoutChoiceKind {
  Keep = 'keep',
  Custom = 'custom',
}

export enum ProposalStatus {
  Active = 'active',
  Upcoming = 'upcoming',
  Ended = 'ended',
}

export enum ProposalSegment {
  Active = 'active',
  EndingSoon = 'ending-soon',
  Upcoming = 'upcoming',
  Ended = 'ended',
}

export enum ProposalSort {
  EndingSoon = 'ending-soon',
  Newest = 'newest',
  HighestAmount = 'highest-amount',
  Name = 'name',
}

export enum ContestStatus {
  Open = 'open',
  Awarded = 'awarded',
  Locked = 'locked',
  NoWinner = 'no-winner',
}

export enum ContestSegment {
  Open = 'open',
  EndingSoon = 'ending-soon',
  Ended = 'ended',
}

export enum ContestSort {
  EndingSoon = 'ending-soon',
  MostVotes = 'most-votes',
  Name = 'name',
}
