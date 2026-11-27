import type { ReactNode } from 'react'

export interface WizardStep {
  label: string
  content: ReactNode
  canAdvance?: boolean
}

export interface TransferWizardProps {
  steps: WizardStep[]
  onSubmit: () => void
  submitLabel?: string
  submitDisabled?: boolean
  submitBusy?: boolean
  currentStep?: number
  allowStepClick?: boolean
  footerNotice?: ReactNode
  onStepChange?: (index: number) => void
}
