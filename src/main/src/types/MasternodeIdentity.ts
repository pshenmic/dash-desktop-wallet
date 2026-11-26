import {AmountWithUsd} from './WalletBalance'
import {IdentityKey} from './IdentityKeys'

export type MasternodeIdentityRole = 'owner' | 'voter'

// Platform's owner identity receives the node's rewards, its voter identity
// signs contested-resource votes; neither derives from the wallet seed.
export interface MasternodeIdentity {
  walletId: string
  proTxHash: string
  role: MasternodeIdentityRole
  identifier: string
}

export type MasternodeIdentityRow = Pick<MasternodeIdentity, 'proTxHash' | 'role' | 'identifier'>

export interface MasternodeIdentityTableRow {
  wallet_id: string
  pro_tx_hash: string
  role: MasternodeIdentityRole
  identifier: string
}

export interface MasternodeIdentityInfo {
  proTxHash: string
  role: MasternodeIdentityRole
  identifier: string
  usernames: string[]
  keys: IdentityKey[]
  balance: AmountWithUsd
}
