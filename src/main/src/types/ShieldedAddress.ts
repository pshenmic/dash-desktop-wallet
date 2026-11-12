export interface ShieldedAddressRow {
  walletId: string
  index: number
  address: string
  isUsed: boolean
  label: string | null
}

export interface ShieldedAddressEntry {
  address: string
  label: string | null
}
