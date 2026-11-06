import { MasternodesTab, NodeSegment } from '@renderer/enums/Masternodes'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'

export const MASTERNODES_ROUTE = '/masternodes'

export const MASTERNODE_PARAMS = {
  tab: 'tab',
  segment: 'segment',
  contest: 'contest',
  node: 'node',
} as const

export const MASTERNODES_TAB_LABELS: Record<MasternodesTab, string> = {
  [MasternodesTab.Nodes]: 'Nodes',
  [MasternodesTab.ContestedResources]: 'Contested Resources',
}

export const MASTERNODES_PAGE_SIZE = 50
export const MASTERNODE_CACHE_NAMESPACE = 'masternodes'
export const MASTERNODE_LOAD_ERROR = 'Failed to load masternodes'
export const MASTERNODE_REFRESH_MS = 15_000

export const MASTERNODE_TABLE_GRID = 'grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_1rem]'

export const MASTERNODE_STATUS_PILLS = new Map([
  ['ENABLED', { tone: StatusPillTone.Success, label: 'Active' }],
  ['POSE_BANNED', { tone: StatusPillTone.Danger, label: 'PoSe banned' }],
])

export const ENABLED_MASTERNODE_STATUS = 'ENABLED'
export const REGULAR_MASTERNODE_TYPE = 'Regular'
export const EVO_MASTERNODE_TYPE = 'Evo'

export const NODE_SEGMENT_LABELS: Record<NodeSegment, string> = {
  [NodeSegment.All]: 'All',
  [NodeSegment.VotingKey]: 'Voting key in wallet',
  [NodeSegment.NoVotingKey]: 'No voting key in wallet',
  [NodeSegment.Issues]: 'Issues',
}
