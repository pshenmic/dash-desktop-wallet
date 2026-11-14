export interface Address {
  walletId: string
  accountId: number
  address: string
  derivationPath: string
  index: number
  isChange: boolean
  isUsed: boolean
  label: string | null
  balance?: bigint | null
  txCount?: number | null
}

// One key of this wallet, revealed from the seed.
export interface AddressKeyInfo {
  address: string
  path: string
  publicKey: Uint8Array
  privateKey: Uint8Array
  wif: string
}
