import { MasternodesTab, NodeSegment } from '@renderer/enums/Masternodes'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'

export const MASTERNODES_ROUTE = '/masternodes'

export const MASTERNODE_PARAMS = {
  tab: 'tab',
  segment: 'segment',
  contest: 'contest',
  node: 'node',
  proposal: 'proposal',
} as const

export const MASTERNODES_TAB_LABELS: Record<MasternodesTab, string> = {
  [MasternodesTab.Nodes]: 'Nodes',
  [MasternodesTab.Proposals]: 'Proposals',
  [MasternodesTab.ContestedResources]: 'Contested Resources',
}

export const MASTERNODES_PAGE_SIZE = 50
export const MASTERNODE_CACHE_NAMESPACE = 'masternodes'
export const MASTERNODE_IMPORTED_KEYS_NAMESPACE = 'masternode-imported-keys'
export const MASTERNODE_COLLATERALS_NAMESPACE = 'masternode-collaterals'
export const MASTERNODE_LOAD_ERROR = 'Failed to load masternodes'
export const MASTERNODE_IMPORTED_KEYS_ERROR = 'Failed to load imported masternode keys'
export const MASTERNODE_REFRESH_MS = 15_000

export const MASTERNODE_TABLE_GRID = 'grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_1rem]'

export const MASTERNODE_STATUS_PILLS = new Map([
  ['ENABLED', { tone: StatusPillTone.Success, label: 'Active' }],
  ['POSE_BANNED', { tone: StatusPillTone.Danger, label: 'PoSe banned' }],
])

export const ENABLED_MASTERNODE_STATUS = 'ENABLED'
export const POSE_BANNED_MASTERNODE_STATUS = 'POSE_BANNED'
export const REGULAR_MASTERNODE_TYPE = 'Regular'
export const EVO_MASTERNODE_TYPE = 'Evo'
export const UNASSIGNED_SERVICE_ADDRESS = '0.0.0.0:0'

export const MASTERNODE_COLLATERAL_DUFFS = {
  Regular: 100_000_000_000n,
  Evo: 400_000_000_000n,
} as const

export const MASTERNODE_VOTE_WEIGHT: Record<string, number> = {
  Regular: 1,
  Evo: 4,
}

export const MAX_OPERATOR_REWARD_BPS = 10_000
export const MAINNET_CORE_PORT = 9999
export const MAINNET_PLATFORM_P2P_PORT = 26656
export const MAINNET_PLATFORM_HTTP_PORT = 443
export const TESTNET_DEFAULT_CORE_PORT = 19999
export const TESTNET_DEFAULT_PLATFORM_P2P_PORT = 36656
export const TESTNET_DEFAULT_PLATFORM_HTTP_PORT = 1443

export const NODE_SEGMENT_LABELS: Record<NodeSegment, string> = {
  [NodeSegment.All]: 'All',
  [NodeSegment.VotingKey]: 'Voting key in wallet',
  [NodeSegment.NoVotingKey]: 'No voting key in wallet',
  [NodeSegment.Issues]: 'Issues',
}
