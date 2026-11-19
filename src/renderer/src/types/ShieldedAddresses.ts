import type {
  PaymentRequestDto,
  ShieldedNoteInfo,
  ShieldedNotesInfo,
  ShieldedSyncState,
} from '../api/types'

export interface CachedShieldedAddresses {
  walletId: string
  addresses: string[] | null
}

export interface UseShieldedAddressesResult {
  addresses: string[] | null
  loading: boolean
}

export interface ShieldedAddressPoolApi {
  getShieldedAddresses: (walletId: string, password?: string) => Promise<string[] | null>
  addShieldedAddress: (walletId: string, password: string) => Promise<string[]>
  getPaymentRequests: (walletId: string) => Promise<PaymentRequestDto[]>
  startShieldedSync: (walletId: string, password: string) => Promise<ShieldedSyncState>
  getShieldedSyncState: (walletId: string) => Promise<ShieldedSyncState>
  getShieldedNotesInfo: (walletId: string) => Promise<ShieldedNotesInfo>
}

export interface EnsureShieldedAddressPoolParams {
  walletId: string
  password: string
  notes: ShieldedNoteInfo[]
  minPool?: number
  batchSize?: number
  api?: Pick<ShieldedAddressPoolApi, 'getShieldedAddresses' | 'addShieldedAddress' | 'getPaymentRequests'>
}
