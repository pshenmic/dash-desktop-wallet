import type { ReactNode } from 'react'
import type { Network, WalletAddressDto } from '../api/types'
import type { ReceivePageType } from '../constants/receivePage'

export interface ReceiveInvoice {
  addressLabel: string
  address: string
  amount: string | null
  paymentLink: string | null
  network: Network | null
}

export interface ReceiveInvoiceQr {
  path: string
  modules: number
}

export interface ReceiveQrProps {
  value: string
  invoice: ReceiveInvoice
}

export interface ReceiveAddressOption {
  address: string
  balance: bigint
}

export interface ReceiveAddressSelectProps {
  addresses: ReceiveAddressOption[]
  selected: ReceiveAddressOption
  onSelect: (address: string) => void
}

export interface ReceiveAddressPanelProps extends ReceiveAddressSelectProps {
  addressLabel: string
  addressBadge?: ReactNode
  amount?: string | null
  paymentLink?: string
  children?: ReactNode
}

export interface ReceiveAddressCardProps {
  addresses: WalletAddressDto[]
  defaultAddress: string
  data: ReceivePageType['receiveAddressCard']
}
