import type {
  MasternodeRegistrationDto,
  MasternodeRegistrationResult,
  Network,
  SelectableUtxo,
} from '@renderer/api/types'
import type { DropdownFieldOption } from './DropdownField'

export type MasternodeType = MasternodeRegistrationDto['type']

export type RegistrationKeySource = 'wallet' | 'external'
export type RegistrationCollateralSource = 'wallet' | 'manual'
export type RegistrationFeeSource = 'auto' | 'address'
export type RegistrationServiceMode = 'now' | 'later'

export interface RegisterWizardDraft {
  type: MasternodeType
  collateralSource: RegistrationCollateralSource
  selectedCollateral: string
  manualTxid: string
  manualVout: string
  feeSourceMode: RegistrationFeeSource
  feeSourceAddress: string
  payoutAddress: string
  ownerMode: RegistrationKeySource
  ownerAddress: string
  votingMode: RegistrationKeySource
  votingAddress: string
  operatorMode: RegistrationKeySource
  operatorPublicKey: string
  operatorRewardPercent: string
  operatorPayoutAddress: string
  serviceMode: RegistrationServiceMode
  serviceIp: string
  servicePort: string
  platformNodeId: string
  platformP2PPort: string
  platformHttpPort: string
}

export interface RegisterWizardProps {
  walletId: string
  onBack: () => void
  onOpenNode: (proTxHash: string) => void
}

export interface RegisterWizardStepMeta {
  id: string
  label: string
}

export interface RegisterWizardValidation {
  step1Error: string | null
  step2Error: string | null
  step3Error: string | null
  dto: MasternodeRegistrationDto | null
  customKeyRoles: string[]
  selectedCoin: SelectableUtxo | null
  manualOutpointMissingFromWallet: boolean
}

export interface RegisterStepSharedProps {
  draft: RegisterWizardDraft
  updateDraft: (patch: Partial<RegisterWizardDraft>) => void
  validation: RegisterWizardValidation
  network: Network | null
  addressOptions: DropdownFieldOption[]
  badgeFor: (address: string) => string | undefined
  addressesLoading: boolean
  addressesError: string | null
  onRetryAddresses: () => void
}

export interface RegisterStepCollateralProps extends RegisterStepSharedProps {
  collateralOptions: DropdownFieldOption[]
  activeCollateral: string
  utxosLoading: boolean
  utxosError: string | null
  onRetryUtxos: () => void
}

export interface RegisterStepAddressesProps extends RegisterStepSharedProps {
  onResetWalletKeys: () => void
}

export interface RegisterStepReviewProps extends RegisterStepSharedProps {
  activeCollateral: string
  password: string
  onPasswordChange: (value: string) => void
  passwordInvalid: boolean
  broadcastError: string | null
  busy: boolean
  canBroadcast: boolean
  onResetWalletKeys: () => void
  onSubmit: () => void
}

export interface RegisterWizardDoneProps {
  result: MasternodeRegistrationResult
  type: MasternodeType
  network: Network | null
  onViewNode: (proTxHash: string) => void
  onDone: () => void
}
