import {AmountWithUsd} from "./WalletBalance";
import {IdentityKey} from "./IdentityKeys";

export interface Identity {
  walletId: string
  identityIndex: number
  derivationPath: string
  identifier: string
  assetLockTxid?: string | null
}

export interface IdentityInfo {
  identityIndex: number
  identifier: string
  // Every DPNS name the identity owns on Platform, oldest first.
  usernames: string[]
  keys: IdentityKey[]
  balance: AmountWithUsd
  derivationPath: string
  assetLockTxid: string | null
}

// What Platform serves for one identifier; one it does not know is omitted.
export interface PlatformIdentityInfo {
  identifier: string
  balance: bigint
  usernames: string[]
  keys: IdentityKey[]
}
