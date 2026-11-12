import type { Network, VoteOutcome } from '@renderer/api/types'
import { ProposalSegment, ProposalSort, ProposalStatus } from '@renderer/enums/Masternodes'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { SegmentOption } from '@renderer/types/SegmentedControl'
import { DAY_MS, HOUR_MS } from './timeLeft'

export const PROPOSALS_PAGE_SIZE = 50
export const GOVERNANCE_PROPOSALS_NAMESPACE = 'governance-proposals'
export const GOVERNANCE_TALLY_NAMESPACE = 'governance-tally'
export const GOVERNANCE_LOAD_ERROR = 'Failed to load governance proposals'
export const GOVERNANCE_TALLY_ERROR = 'Failed to load proposal vote tally'
export const GOVERNANCE_REFRESH_MS = 30_000

export const PROPOSAL_ENDING_SOON_MS: Record<Network, number> = {
  mainnet: 3 * DAY_MS,
  testnet: 2 * HOUR_MS,
}

export const PROPOSAL_TABLE_GRID = 'grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1fr)_7.5rem_1rem]'
export const PROPOSAL_TABLE_HEADINGS = ['Proposal', 'Amount', 'Window', 'Status'] as const

export const PROPOSAL_STATUS_PILLS = {
  [ProposalStatus.Active]: { tone: StatusPillTone.Success, label: 'Active' },
  [ProposalStatus.Upcoming]: { tone: StatusPillTone.Accent, label: 'Upcoming' },
  [ProposalStatus.Ended]: { tone: StatusPillTone.Inactive, label: 'Ended' },
} as const

export const PROPOSAL_SEGMENT_LABELS: Record<ProposalSegment, string> = {
  [ProposalSegment.Active]: 'Active',
  [ProposalSegment.EndingSoon]: 'Ending soon',
  [ProposalSegment.Upcoming]: 'Upcoming',
  [ProposalSegment.Ended]: 'Ended',
}

export const PROPOSAL_SORT_OPTIONS: SegmentOption<ProposalSort>[] = [
  { value: ProposalSort.EndingSoon, label: 'Ending soonest' },
  { value: ProposalSort.Newest, label: 'Newest first' },
  { value: ProposalSort.HighestAmount, label: 'Highest amount' },
  { value: ProposalSort.Name, label: 'Name A–Z' },
]

export const ENDED_PROPOSAL_SORT_OPTIONS: SegmentOption<ProposalSort>[] = [
  { value: ProposalSort.EndingSoon, label: 'Recently ended' },
  ...PROPOSAL_SORT_OPTIONS.slice(1),
]

export const PROPOSALS_TAB_COPY = {
  description: 'Dash treasury governance proposals and funding votes.',
  searchPlaceholder: 'Search proposal name, hash or address',
  searchLabel: 'Search governance proposals',
  sortLabel: 'Sort proposals',
  segmentsLabel: 'Proposal status',
  noMatch: 'No proposals match',
  clearSearch: 'Clear search',
  menuTitle: 'Proposal',
  open: 'Open',
  copyHash: 'Copy proposal hash',
  openUrl: 'Open proposal URL',
  endsIn: 'Ends in',
  startsIn: 'Starts in',
  ended: 'Ended',
} as const

export const PROPOSAL_SEGMENT_EMPTY: Record<ProposalSegment, string> = {
  [ProposalSegment.Active]: 'No active governance proposals',
  [ProposalSegment.EndingSoon]: 'No proposals ending soon',
  [ProposalSegment.Upcoming]: 'No upcoming governance proposals',
  [ProposalSegment.Ended]: 'No ended governance proposals',
}

export const PROPOSAL_DETAIL_COPY = {
  backShort: 'Back',
  unknown: 'This governance proposal is not available',
  endsIn: 'Ends in',
  startsIn: 'Starts in',
  openUrl: 'Proposal URL',
  voteButton: 'Vote on proposal',
  proposalHash: 'Proposal hash',
  collateralHash: 'Collateral hash',
  paymentAddress: 'Payment address',
  paymentAmount: 'Requested amount',
  startDate: 'Start date',
  endDate: 'End date',
  createdAt: 'Created',
  tallyHeading: 'Funding votes',
  tallyLoading: 'Loading vote tally…',
  netScore: 'Net score',
  yes: 'Yes',
  no: 'No',
  abstain: 'Abstain',
} as const

export const VOTE_OUTCOME_OPTIONS: SegmentOption<VoteOutcome>[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'abstain', label: 'Abstain' },
]

export const VOTE_OUTCOME_LABELS: Record<VoteOutcome, string> = {
  yes: 'Yes',
  no: 'No',
  abstain: 'Abstain',
}

export const VOTE_PROPOSAL_COPY = {
  title: 'Vote on proposal',
  description: 'Cast funding votes with masternodes whose voting keys are derived by this wallet.',
  outcomeLabel: 'Vote outcome',
  nodesLabel: 'Voting masternodes',
  selectAll: 'Select all',
  clearSelection: 'Clear',
  noEligibleNodes: 'This wallet has no active masternodes with a derived voting key and known collateral.',
  weightSuffix: '× weight',
  totalWeightLabel: 'Total voting weight',
  ineligibleSection: 'Unavailable for voting',
  poseBannedReason: 'PoSe banned',
  missingVotingKeyReason: 'Voting key outside wallet',
  missingCollateralReason: 'Collateral pending index',
  review: 'Review vote',
  confirm: 'Sign & relay votes',
  pending: 'Signing and relaying votes…',
  doneHeadline: 'Votes relayed',
  partialHeadline: 'Some votes were not kept by peers',
  proposalLabel: 'Proposal',
  nodesVotedLabel: 'Masternodes voted',
  peersKeptSuffix: 'peers kept vote',
} as const
