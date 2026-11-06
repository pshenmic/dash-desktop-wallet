import type { Network } from '@renderer/api/types'
import type { ContestSegment, ContestSort, NodeSegment } from '@renderer/enums/Masternodes'

export interface MasternodesPageProps {
  walletId: string
}

export interface SummaryStripProps extends MasternodesPageProps {
  network: Network | undefined
  now: number
  onSelectNodes: (segment: NodeSegment) => void
  onSelectContests: (segment: ContestSegment) => void
}

export interface NodesTabProps extends MasternodesPageProps {
  segment: NodeSegment
  onSegmentChange: (segment: NodeSegment) => void
  query: string
  onQueryChange: (query: string) => void
  visibleCount: number
  onShowMore: () => void
  onOpenNode: (proTxHash: string) => void
}

export interface NodeDetailProps extends MasternodesPageProps {
  proTxHash: string
  onBack: () => void
}

export interface ContestsTabProps extends MasternodesPageProps {
  network: Network | undefined
  now: number
  segment: ContestSegment
  onSegmentChange: (segment: ContestSegment) => void
  query: string
  onQueryChange: (query: string) => void
  sort: ContestSort
  onSortChange: (sort: ContestSort) => void
  visibleCount: number
  onShowMore: () => void
  onOpenContest: (normalizedLabel: string) => void
}

export interface ContestDetailProps extends MasternodesPageProps {
  now: number
  normalizedLabel: string
  onBack: () => void
}
