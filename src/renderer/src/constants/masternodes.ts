import { MasternodesTab, NodeSegment } from '@renderer/enums/Masternodes'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'

export const MASTERNODES_ROUTE = '/masternodes'

export const MASTERNODE_PARAMS = {
  tab: 'tab',
  segment: 'segment',
  node: 'node',
  register: 'register',
} as const

export const MASTERNODES_TAB_LABELS: Record<MasternodesTab, string> = {
  [MasternodesTab.Nodes]: 'Nodes',
}

export const MASTERNODES_PAGE_SIZE = 50
export const MASTERNODE_CACHE_NAMESPACE = 'masternodes'
export const MASTERNODE_IMPORTED_KEYS_NAMESPACE = 'masternode-imported-keys'
export const MASTERNODE_COLLATERALS_NAMESPACE = 'masternode-collaterals'
export const MASTERNODE_LOAD_ERROR = 'Failed to load masternodes'
export const MASTERNODE_IMPORTED_KEYS_ERROR = 'Failed to load imported masternode keys'
export const MASTERNODE_REFRESH_MS = 15_000

export const MASTERNODE_TABLE_GRID = 'grid-cols-[minmax(0,2.25fr)_5.75rem_minmax(0,0.85fr)_minmax(0,1.1fr)_1rem]'

export const MASTERNODE_STATUS_PILLS = new Map([
  ['ENABLED', { tone: StatusPillTone.Success, label: 'Active' }],
  ['POSE_BANNED', { tone: StatusPillTone.Danger, label: 'PoSe banned' }],
  ['REGISTERING', { tone: StatusPillTone.Warning, label: 'Registering' }],
])

export const ENABLED_MASTERNODE_STATUS = 'ENABLED'
export const POSE_BANNED_MASTERNODE_STATUS = 'POSE_BANNED'
export const REGISTERING_MASTERNODE_STATUS = 'REGISTERING'
export const PENDING_MASTERNODES_STORAGE_PREFIX = 'masternodes.pending'
export const PENDING_MASTERNODE_TTL_MS = 24 * 60 * 60 * 1000
export const REGULAR_MASTERNODE_TYPE = 'Regular'
export const EVO_MASTERNODE_TYPE = 'Evo'
export const UNASSIGNED_SERVICE_ADDRESS = '0.0.0.0:0'
export const PUBLIC_IPV4_SAMPLE = '45.67.89.10'
export const NON_ROUTABLE_IPV4_PREFIXES: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['255.255.255.255', 32],
]
export const SHARE_BASIS_POINTS = 10_000n
export const SHARE_BASIS_DIVISOR = 10_000
export const SHARE_PERCENT_SCALE = 100

export const MASTERNODE_COLLATERAL_DUFFS = {
  Regular: 100_000_000_000n,
  Evo: 400_000_000_000n,
} as const

export const MASTERNODE_VOTE_WEIGHT: Record<string, number> = {
  Regular: 1,
  Evo: 4,
}

export const MAX_OPERATOR_REWARD_BPS = 10_000
export const PROREG_DUST_THRESHOLD_DUFFS = 546n
export const PROREG_SEQUENCE_FINAL = 0xffffffff
export const MAINNET_CORE_PORT = 9999
export const MAINNET_PLATFORM_P2P_PORT = 26656
export const MAINNET_PLATFORM_HTTP_PORT = 443
export const TESTNET_DEFAULT_CORE_PORT = 19999
export const TESTNET_DEFAULT_PLATFORM_P2P_PORT = 36656
export const TESTNET_DEFAULT_PLATFORM_HTTP_PORT = 1443

export const NODE_SEGMENT_LABELS: Record<NodeSegment, string> = {
  [NodeSegment.All]: 'All',
  [NodeSegment.Shared]: 'Shared',
  [NodeSegment.VotingKey]: 'Voting key in wallet',
  [NodeSegment.NoVotingKey]: 'No voting key in wallet',
  [NodeSegment.Banned]: 'Banned',
}
