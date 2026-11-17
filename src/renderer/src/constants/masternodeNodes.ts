import type { MasternodeKeyRole } from '@renderer/api/types'
import { NodeSegment } from '@renderer/enums/Masternodes'
import type { SegmentOption } from '@renderer/types/SegmentedControl'
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
  shared: 'shared',
  withVotingKey: 'with a voting key',
  endingSoon: 'ending soon',
  unavailable: '—',
  separator: ' · ',
} as const

export const NODES_TAB_COPY = {
  searchPlaceholder: 'ProTxHash, service or owner address',
  searchLabel: 'Search nodes',
  segmentsLabel: 'Node filter',
  emptyTitle: 'No masternodes discovered',
  emptyDescription: 'Masternodes and shared masternode shares linked to this wallet’s keys or collateral appear here after discovery.',
  p2pSyncing: 'Waiting for the network masternode list to sync…',
  noMatch: 'No nodes match',
  clearSearch: 'Clear search',
  importedKeysButton: 'Imported keys',
} as const

export const NODE_TABLE_COLUMNS = ['Node', 'Status', 'Roles & Stake'] as const

export const NODE_SEGMENT_EMPTY: Record<NodeSegment, string> = {
  [NodeSegment.All]: 'No nodes',
  [NodeSegment.Shared]: 'No shared masternodes in this wallet',
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
  unassignedService: 'Unassigned',
  pendingIndex: 'Pending index',
  unavailable: '—',
  votingKey: 'Voting key',
  votingKeyStored: 'In this wallet',
  votingKeyImported: 'Imported key',
  votingKeyMissing: 'Outside this wallet',
  lastPaid: 'Last paid block',
  registeredHeight: 'Registered block',
  neverPaid: 'Never',
  payoutAddress: 'Payout address',
  sharedPayoutValue: 'Distributed per share',
  ownerAddress: 'Owner address',
  votingAddress: 'Voting address',
  operatorPublicKey: 'Operator public key',
  collateral: 'Collateral',
  platformNodeId: 'Platform Node ID',
  platformPorts: 'Platform ports',
  pose: 'PoSe',
  heightPrefix: '#',
  unknownNode: 'This node hasn’t been discovered in this wallet',
  back: 'Back',
  sharedBadge: 'Shared',
  sharedRegistration: 'Shared collateral',
  soloRegistration: 'Solo collateral',
  walletKeyBadge: 'Wallet key',
  importedKeyBadge: 'Imported',
  externalKeyBadge: 'External',
} as const

export const NODE_SHARES_FORMS = { one: 'share', other: 'shares' } as const

export const NODE_SHARES_COPY = {
  title: 'Collateral shares',
  yourStake: 'Your stake',
  totalCollateral: 'Total collateral',
  noOwnedShares: 'No shares held in this wallet',
  ofShares: 'of',
  sharedCollateral: 'Shared collateral',
  rpcSharesUnavailable: 'Individual share amounts and owner addresses are indexed from the on-chain registration in P2P connection mode.',
  p2pSharesPending: 'Indexing the on-chain registration to load share owners and collateral amounts…',
} as const

export const MASTERNODE_KEY_ROLE_LABELS: Record<MasternodeKeyRole, string> = {
  owner: 'Owner',
  voting: 'Voting',
  operator: 'Operator',
}

export const MASTERNODE_KEY_ROLE_HINTS: Record<MasternodeKeyRole, string> = {
  owner: 'WIF private key (solo or shared share owner)',
  voting: 'WIF private key (voting address)',
  operator: 'BLS secret key (64 hex characters)',
}

export const MASTERNODE_KEY_ROLE_OPTIONS: SegmentOption<MasternodeKeyRole>[] = [
  { value: 'owner', label: MASTERNODE_KEY_ROLE_LABELS.owner },
  { value: 'voting', label: MASTERNODE_KEY_ROLE_LABELS.voting },
  { value: 'operator', label: MASTERNODE_KEY_ROLE_LABELS.operator },
]

export const NODE_MATCHED_FORMS = { one: 'node matched', other: 'nodes matched' } as const

export const MANAGE_KEYS_COPY = {
  title: 'Imported masternode keys',
  description: 'Import an external owner, share-owner, voting or operator private key to track its masternodes in this wallet.',
  roleLabel: 'Key role',
  privateKeyLabel: 'Private key',
  importButton: 'Import key',
  importing: 'Importing…',
  importedTitle: 'Imported keys',
  noImportedKeys: 'No external masternode keys imported yet.',
  remove: 'Remove',
  close: 'Done',
  keyImportedToast: 'Masternode key imported',
  keyRemovedToast: 'Masternode key removed',
} as const

export const NODE_DETAIL_ROW_CLASS = 'flex min-w-0 items-center gap-[.625rem]'
export const NODE_DETAIL_ICON_CLASS = 'dash-text-primary'
