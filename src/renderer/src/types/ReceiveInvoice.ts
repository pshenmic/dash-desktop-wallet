import type { ReactNode } from 'react'
import type { Network, WalletAddressDto } from '../api/types'
import type { ReceivePageType } from '../constants/receivePage'

export interface ReceiveInvoice {
  addressLabel: string
  address: string
  label?: string | null
  amount: string | null
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

export interface ReceiveAddressPanelProps {
  address: string
  wideAddress?: boolean
  title?: string
  addressLabel: string
  addressBadge?: ReactNode
  label?: string | null
  amount?: string | null
  paymentLink?: string
  children?: ReactNode
}

export interface ReceiveAddressCardProps {
  addresses: WalletAddressDto[]
  defaultAddress: string
  data: ReceivePageType['receiveAddressCard']
}
