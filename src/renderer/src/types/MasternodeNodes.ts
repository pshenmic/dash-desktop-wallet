import type { MasternodeDto, Network } from '@renderer/api/types'
import type { PayoutChoiceKind, RegistrarKeyChoiceKind } from '@renderer/enums/Masternodes'

export interface MasternodesNavigationState {
  fromList: boolean
}

export interface NodeTableRowProps {
  node: MasternodeDto
  onOpen: (proTxHash: string) => void
}

export interface ManageMasternodeKeysModalProps {
  walletId: string
  open: boolean
  onClose: () => void
}

export interface RegisterMasternodeModalProps {
  walletId: string
  open: boolean
  onClose: () => void
}

export interface UpdateRegistrarModalProps {
  walletId: string
  node: MasternodeDto
  open: boolean
  onClose: () => void
}

export interface UpdateServiceModalProps {
  walletId: string
  node: MasternodeDto
  open: boolean
  onClose: () => void
}

export interface RevokeMasternodeModalProps {
  walletId: string
  node: MasternodeDto
  open: boolean
  onClose: () => void
}

export interface RegisterMasternodeFormInput {
  type: 'Regular' | 'Evo'
  collateralOutpoint: string
  payoutAddress: string
  serviceAddress: string
  operatorRewardPercent: string
  platformNodeId: string
  platformP2PPort: string
  platformHttpPort: string
  network: Network | null
}

export interface UpdateRegistrarFormInput {
  payoutChoice: PayoutChoiceKind
  payoutAddress: string
  currentPayeeAddress: string | null
  operatorChoice: RegistrarKeyChoiceKind
  operatorPublicKey: string
  votingChoice: RegistrarKeyChoiceKind
  votingAddress: string
}

export interface UpdateServiceFormInput {
  type: string
  serviceAddress: string
  operatorPayoutAddress: string
  platformNodeId: string
  platformP2PPort: string
  platformHttpPort: string
  network: Network | null
}
