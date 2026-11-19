import type { Network } from '@renderer/api/types'
import { ContestSegment, ContestSort, ContestStatus } from '@renderer/enums/Masternodes'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { SegmentOption } from '@renderer/types/SegmentedControl'
import { DAY_MS, MINUTE_MS } from './timeLeft'
import { PROGRESS_FILL, PROGRESS_TRACK } from './progressBar'
import { SURFACE_ROW } from './surfaces'

export const CONTESTS_PAGE_SIZE = 50
export const ENDING_SOON_MS: Record<Network, number> = { mainnet: DAY_MS, testnet: 15 * MINUTE_MS }
export const CONTEST_TABLE_GRID = 'grid-cols-[minmax(0,1.2fr)_7rem_minmax(0,1.4fr)_7rem_1rem]'
export const CONTEST_TABLE_HEADINGS = ['Name', 'Contenders', 'Leading', 'Status'] as const

export const CONTEST_STATUS_PILLS = {
  [ContestStatus.Open]: { tone: StatusPillTone.Accent, label: 'Open' },
  [ContestStatus.Awarded]: { tone: StatusPillTone.Success, label: 'Awarded' },
  [ContestStatus.Locked]: { tone: StatusPillTone.Danger, label: 'Locked' },
  [ContestStatus.NoWinner]: { tone: StatusPillTone.Inactive, label: 'No winner' },
} as const

export const CONTEST_SEGMENT_LABELS: Record<ContestSegment, string> = {
  [ContestSegment.Open]: 'Open',
  [ContestSegment.EndingSoon]: 'Ending soon',
  [ContestSegment.Ended]: 'Ended',
}

export const CONTEST_SORT_OPTIONS: SegmentOption<ContestSort>[] = [
  { value: ContestSort.EndingSoon, label: 'Ending soonest' },
  { value: ContestSort.MostVotes, label: 'Most votes' },
  { value: ContestSort.Name, label: 'Name A–Z' },
]

export const ENDED_CONTEST_SORT_OPTIONS: SegmentOption<ContestSort>[] = [
  { value: ContestSort.EndingSoon, label: 'Recently ended' },
  ...CONTEST_SORT_OPTIONS.slice(1),
]

export const CONTESTS_TAB_COPY = {
  description: 'DPNS contests involving identities in this wallet.',
  searchPlaceholder: 'Search name',
  searchLabel: 'Search contested resources',
  sortLabel: 'Sort contests',
  segmentsLabel: 'Contest status',
  noMatch: 'No contests match',
  clearSearch: 'Clear search',
} as const

export const CONTEST_SEGMENT_EMPTY: Record<ContestSegment, string> = {
  [ContestSegment.Open]: 'No open contests for this wallet',
  [ContestSegment.EndingSoon]: 'No contests ending soon',
  [ContestSegment.Ended]: 'No ended contests for this wallet',
}

export const CONTEST_ROW_COPY = {
  tie: 'Tie',
  none: '—',
  pending: 'Awaiting outcome',
  lock: 'Lock',
  abstain: 'Abstain',
} as const

export const CONTEST_VOTE_FORMS = { one: 'vote', other: 'votes' }
export const CONTEST_LIST_SEPARATOR = ' · '
export const CONTEST_AVATAR_LIMIT = 3
export const PERCENT_SCALE = 100
export const CONTEST_AVATAR_CLASS = 'ml-1 first:ml-0 rounded-full'
export const CONTEST_ROW_CHEVRON_CLASS = 'shrink-0 -rotate-90 dash-text-default'
export const SHARE_BAR_TRACK_CLASS = PROGRESS_TRACK
export const SHARE_BAR_FILL_CLASS = PROGRESS_FILL

export const CONTEST_DETAIL_COPY = {
  backShort: 'Back',
  endsIn: 'Ends in',
  contenders: 'Contenders',
  noContenders: 'No contender tallies available',
  searchContenders: 'Search contenders',
  leading: 'Leading',
  yourIdentity: 'Your identity',
  openInDashPay: 'Open in DashPay',
  otherChoices: 'Other tallies',
  lock: 'Lock',
  abstain: 'Abstain',
  noContenderMatch: 'No contenders match',
  unknown: 'This contest isn’t available for this wallet',
  winner: 'Winning identity',
} as const

export const CONTENDER_SEARCH_MIN = 8
export const CONTENDER_ROW_CLASS = `flex min-w-0 items-center gap-3 ${SURFACE_ROW}`
