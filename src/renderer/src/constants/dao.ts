import { DaoTab } from '@renderer/enums/Dao'

export const DAO_ROUTE = '/dao'

export const DAO_PARAMS = {
  tab: 'tab',
  segment: 'segment',
  proposal: 'proposal',
  contest: 'contest',
} as const

export const DAO_TAB_LABELS: Record<DaoTab, string> = {
  [DaoTab.Proposals]: 'Proposals',
  [DaoTab.ContestedResources]: 'Contested Resources',
}

export const CONTESTED_RESOURCES_NAMESPACE = 'contested-resources'
export const CONTESTED_RESOURCES_ERROR = 'Failed to load contested resources'
export const CONTESTED_RESOURCES_REFRESH_MS = 30_000

export const VOTE_CONTEST_COPY = {
  voteButton: 'Vote',
  title: 'Vote on contested resource',
  description: 'Cast a Dash Platform contested resource vote signed with each selected masternode’s voting key.',
  choiceLabel: 'Vote choice',
  contenderVoteHint: 'Award name to this contender',
  lockOption: 'Lock name',
  lockHint: 'Block this contested name from being awarded',
  abstainOption: 'Abstain',
  abstainHint: 'Register an abstention without backing a contender',
  nodesLabel: 'Voting masternodes',
  selectAll: 'Select all',
  clearSelection: 'Clear',
  noEligibleNodes: 'This wallet has no active masternodes with a stored voting key.',
  resourceLabel: 'Contested resource',
  summaryChoiceLabel: 'Selected choice',
  nodesVotedLabel: 'Masternodes voting',
  totalWeightLabel: 'Total voting weight',
  review: 'Review vote',
  confirm: 'Sign & broadcast votes',
  pending: 'Signing and broadcasting votes…',
  doneHeadline: 'Contested resource votes broadcast',
  partialHeadline: 'Some contested resource votes failed',
  stHashLabel: 'State transition',
  stHashAccepted: 'Broadcast',
} as const
