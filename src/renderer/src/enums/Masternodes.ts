export enum MasternodesTab {
  Nodes = 'nodes',
  ContestedResources = 'contested-resources',
}

export enum NodeSegment {
  All = 'all',
  VotingKey = 'voting-key',
  NoVotingKey = 'no-voting-key',
  Issues = 'issues',
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
