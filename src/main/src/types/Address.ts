export interface Address {
  walletId: string
  accountId: number
  address: string
  derivationPath: string
  index: number
  isChange: boolean
  isUsed: boolean
  // Locked by the user: no coin on this address may be spent until unlocked.
  isLocked: boolean
  label: string | null
  balance?: bigint | null
  usdBalance?: string | null
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
