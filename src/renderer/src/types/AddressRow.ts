import type { ReactNode } from 'react'

export interface AddressRowProps {
  address: string
  label?: string | null
  amount: ReactNode
  fiatDuffs?: bigint | null
  leading?: ReactNode
  meta?: ReactNode
  explorerUrl?: string
  onQr?: () => void
  onExportKey?: () => void
  hidden?: boolean
}
