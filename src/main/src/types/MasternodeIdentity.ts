import {AmountWithUsd} from './WalletBalance'
import {IdentityKey} from './IdentityKeys'

export type MasternodeIdentityRole = 'owner' | 'voter'

// An identity Platform created for a node from its ProRegTx: the owner one
// receives the node's Platform rewards, the voter one signs contested-resource
// votes. Neither derives from the wallet seed.
export interface MasternodeIdentity {
  walletId: string
  proTxHash: string
  role: MasternodeIdentityRole
  identifier: string
}

// One node identity as the wallet lists it, with what Platform serves for it.
export interface MasternodeIdentityInfo {
  proTxHash: string
  role: MasternodeIdentityRole
  identifier: string
  usernames: string[]
  keys: IdentityKey[]
  balance: AmountWithUsd
}