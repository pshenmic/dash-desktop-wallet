import type { ReactNode } from 'react'
import type { PlatformAddressDto } from '../api/types'

export interface AddressRowProps {
  address: string
  label?: string | null
  amount: ReactNode
  fiatDuffs?: bigint | null
  leading?: ReactNode
  meta?: ReactNode
  explorerUrl?: string
  onQr?: () => void
  hidden?: boolean
}

export interface PlatformAddressCardProps extends PlatformAddressDto {
  label?: string | null
}
