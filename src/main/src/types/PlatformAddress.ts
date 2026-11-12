export interface PlatformAddressRow {
  walletId: string
  index: number
  address: string
  derivationPath: string
  isUsed: boolean
  label: string | null
}

export interface PlatformAddressEntry {
  platformAddress: string
  balanceCredits: bigint
  nonce: number
  label: string | null
}
