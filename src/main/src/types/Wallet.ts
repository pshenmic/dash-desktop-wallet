import { Network } from './Network'

export interface Wallet {
  walletId: string
  network: Network
  label: string | null
  encryptedMnemonic: string
  selected: boolean
  platformXpub: string | null
  coreXpub: string | null
  dashPayXpub: string | null
}

// The wallet list the renderer needs; the mnemonic and xpubs stay in main.
export interface WalletSummary {
  walletId: string
  network: Network
  label: string | null
  selected: boolean
}
