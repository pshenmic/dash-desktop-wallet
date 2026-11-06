import { NodeSegment } from '@renderer/enums/Masternodes'
import { SURFACE_PANEL } from './surfaces'

export const SUMMARY_STRIP_CLASS = `mb-4 grid grid-cols-2 divide-x divide-dash-primary-dark-blue/8 dark:divide-white/12 ${SURFACE_PANEL}`
export const SUMMARY_CELL_CLASS = 'flex min-w-0 flex-col gap-1 px-4 first:pl-1.5'
export const SUMMARY_SKELETON_CLASS = 'mx-2 h-14 rounded-[.625rem] animate-pulse bg-dash-primary-dark-blue/8 dark:bg-white/8'
export const SUMMARY_FOOTER_CLASS = 'flex min-w-0 flex-wrap items-baseline gap-x-1'
export const SUMMARY_LINK_CLASS = 'inline-flex items-baseline text-left cursor-pointer rounded-md hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40'

export const SUMMARY_COPY = {
  nodes: 'Nodes',
  openContests: 'Open contests',
  active: 'active',
  withVotingKey: 'with a voting key',
  endingSoon: 'ending soon',
  unavailable: '—',
  separator: ' · ',
} as const

export const NODES_TAB_COPY = {
  searchPlaceholder: 'ProTxHash or service address',
  searchLabel: 'Search nodes',
  segmentsLabel: 'Node filter',
  emptyTitle: 'No masternodes discovered',
  emptyDescription: 'Masternodes linked to this wallet’s keys or collateral appear here after discovery.',
  rpcDiscovery: 'Masternode discovery is available in RPC connection mode.',
  noMatch: 'No nodes match',
  clearSearch: 'Clear search',
} as const

export const NODE_TABLE_COLUMNS = ['Node', 'Status', 'Voting key'] as const

export const NODE_SEGMENT_EMPTY: Record<NodeSegment, string> = {
  [NodeSegment.All]: 'No nodes',
  [NodeSegment.VotingKey]: 'No nodes with a voting key in this wallet',
  [NodeSegment.NoVotingKey]: 'All discovered nodes have a voting key in this wallet',
  [NodeSegment.Issues]: 'No issues',
}

export const NODE_ROW_COPY = {
  menuTitle: 'Node',
  open: 'Open',
  copy: 'Copy ProTxHash',
} as const

export const NODE_DETAIL_COPY = {
  typeTitle: 'Masternode',
  proTxHash: 'ProTxHash',
  type: 'Type',
  status: 'Status',
  service: 'Service',
  votingKey: 'Voting key',
  votingKeyStored: 'In this wallet',
  votingKeyMissing: 'Outside this wallet',
  lastPaid: 'Last paid block',
  neverPaid: 'Never',
  payoutAddress: 'Payout address',
  collateral: 'Collateral',
  pose: 'PoSe',
  heightPrefix: '#',
  unknownNode: 'This node hasn’t been discovered in this wallet',
  back: 'Back',
} as const

export const NODE_DETAIL_ROW_CLASS = 'flex min-w-0 items-center gap-[.625rem]'
export const NODE_DETAIL_ICON_CLASS = 'dash-text-primary'
