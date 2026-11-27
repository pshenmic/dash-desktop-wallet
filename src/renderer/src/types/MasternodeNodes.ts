import type { ImportedMasternodeKeyDto, MasternodeDto, MasternodeKeyRole, Network } from '@renderer/api/types'
import type { AlertTone } from '@renderer/enums/AlertTone'
import type { MasternodeViewMode, PayoutChoiceKind, RegistrarKeyChoiceKind } from '@renderer/enums/Masternodes'

export interface MasternodeViewSwitchProps {
  value: MasternodeViewMode
  onChange: (next: MasternodeViewMode) => void
}

export type NodeRoleOrigin = 'wallet' | 'imported' | 'watch-only' | 'external'

export interface NodeRolePill {
  role: MasternodeKeyRole
  label: string
  origin: NodeRoleOrigin
  originLabel: string
  inWallet: boolean
  canSign: boolean
}

export interface NodeCardProps {
  node: MasternodeDto
  labelsByAddress?: ReadonlyMap<string, string>
  onOpen: (proTxHash: string) => void
}

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
  onClose: () => void
  onSelectRegister: () => void
  onSelectImport: () => void
}

export interface RemoveImportedKeysModalProps {
  walletId: string
  node: MasternodeDto
  matchedKeys: ImportedMasternodeKeyDto[]
  open: boolean
  onClose: () => void
  onNodeRemoved: () => void
}

export interface UnmatchedImportedKeysModalProps {
  walletId: string
  unmatchedKeys: ImportedMasternodeKeyDto[]
  open: boolean
  onClose: () => void
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
