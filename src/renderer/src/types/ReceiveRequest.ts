import type { ReactNode } from 'react'
import type { WalletAddressDto } from '../api/types'

export type ReceiveRequestKind = 'core' | 'platform' | 'shielded'

export interface ReceiveRequestDto {
  id: number
  walletId: string
  kind: ReceiveRequestKind
  address: string
  label: string | null
  amountDuffs: bigint | null
  createdAt: number
}

export interface StoredReceiveRequest {
  id: number
  walletId: string
  kind: ReceiveRequestKind
  address: string
  label: string | null
  amountDuffs: string | null
  createdAt: number
}

export interface ReceiveRequestFormProps {
  address: string
  kind: ReceiveRequestKind
  label: string
  amount: string
  busy?: boolean
  error?: string | null
  headerExtra?: ReactNode
  extraFields?: ReactNode
  note?: ReactNode
  submitDisabled?: boolean
  submitLabel?: string
  onLabelChange: (label: string) => void
  onAmountChange: (amount: string) => void
  onClear: () => void
  onSubmit: () => void
}

export interface ReceiveRequestsTableProps {
  requests: ReceiveRequestDto[]
  loading?: boolean
  error?: string | null
  onSelect: (request: ReceiveRequestDto) => void
  onDelete: (request: ReceiveRequestDto) => void
  onRetry?: () => void
}

export interface ReceiveRequestModalProps {
  request: ReceiveRequestDto | null
  onClose: () => void
}

export interface ReceiveAddressCardProps {
  walletId: string | undefined
  addresses: WalletAddressDto[]
  defaultAddress: string | null
}

export interface PlatformReceiveCardProps {
  walletId: string | undefined
}

export interface ShieldedReceiveCardProps {
  walletId: string | undefined
}
