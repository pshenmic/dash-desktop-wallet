import type { SharedRegistrationStage } from '@renderer/enums/Masternodes'
import type { NodesTabProps } from './MasternodeScreens'

export type SharedTabProps = NodesTabProps

export interface AddSharedMasternodeModalProps {
  open: boolean
  onClose: () => void
  onSelectParticipate: () => void
  onSelectImport: () => void
}

export interface ParticipateSharedWizardProps {
  walletId: string
  onBack: () => void
}

export interface SharedStageEligibility {
  canSign: boolean
  reason: string | null
  initialStage?: SharedRegistrationStage
}
