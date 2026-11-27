import type { Network } from '@renderer/api/types'
import type { ContestSegment, ContestSort, ProposalSegment, ProposalSort } from '@renderer/enums/Masternodes'

export interface MasternodesPageProps {
  walletId: string
}

export interface NodesTabProps extends MasternodesPageProps {
  query: string
  onQueryChange: (query: string) => void
  visibleCount: number
  onShowMore: () => void
  onOpenNode: (proTxHash: string) => void
  onRegister: () => void
  onImportKeys: () => void
}

export interface NodeDetailProps extends MasternodesPageProps {
  proTxHash: string
  onBack: () => void
}

export interface ProposalsTabProps extends MasternodesPageProps {
  network: Network | undefined
  now: number
  segment: ProposalSegment
  onSegmentChange: (segment: ProposalSegment) => void
  query: string
  onQueryChange: (query: string) => void
  sort: ProposalSort
  onSortChange: (sort: ProposalSort) => void
  visibleCount: number
  onShowMore: () => void
  onOpenProposal: (hash: string) => void
}

export interface ProposalDetailProps extends MasternodesPageProps {
  now: number
  proposalHash: string
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
