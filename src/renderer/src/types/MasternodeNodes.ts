import type { MasternodeDto, Network } from '@renderer/api/types'
import type { AlertTone } from '@renderer/enums/AlertTone'
import type { PayoutChoiceKind, RegistrarKeyChoiceKind } from '@renderer/enums/Masternodes'

export interface KeyImportNotice {
  tone: AlertTone
  message: string
}

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

export interface AddMasternodeModalProps {
  open: boolean
  importedCount: number
  onClose: () => void
  onSelectRegister: () => void
  onSelectImport: () => void
}

export interface MasternodeFieldInputProps {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  placeholder?: string
  maxLength?: number
  invalid?: boolean
  tabular?: boolean
  disabled?: boolean
  suffix?: string
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
  ownerAddress?: string | null
  votingAddress?: string | null
  operatorPublicKey?: string | null
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
