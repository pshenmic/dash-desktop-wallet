import type { MasternodeDto } from '@renderer/api/types'

export interface MasternodesNavigationState {
  fromList: boolean
}

export interface NodeTableRowProps {
  node: MasternodeDto
  onOpen: (proTxHash: string) => void
}

export interface NodeSharesCardProps {
  node: MasternodeDto
}

export interface ManageMasternodeKeysModalProps {
  walletId: string
  open: boolean
  onClose: () => void
}

export interface MasternodeShareSummary {
  totalDuffs: bigint
  ownedDuffs: bigint
  ownedCount: number
  totalCount: number
  ownedRatio: number
}

export interface NodeAccessDisplay {
  primary: string
  secondary: string
}
