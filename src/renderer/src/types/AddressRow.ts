import type { ReactNode } from 'react'

export interface ResolvedAddressLabel {
  label: string | null
  lockedByReceive: boolean
}

export interface AddressRowProps {
  address: string
  label?: string | null
  labelLocked?: boolean
  labelLockedTooltip?: string
  onSaveLabel?: (label: string) => Promise<void>
  amount: ReactNode
  fiatDuffs?: bigint | null
  leading?: ReactNode
  meta?: ReactNode
  explorerUrl?: string
  onQr?: () => void
  onExportKey?: () => void
  hidden?: boolean
}
