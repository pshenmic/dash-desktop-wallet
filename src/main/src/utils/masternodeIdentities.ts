import {sha256} from '@noble/hashes/sha2.js'
import {concatBytes, hexToBytes} from '@noble/hashes/utils.js'
import {base58} from '@scure/base'
import {utils as sdkUtils} from 'dash-core-sdk'
import {MasternodeIdentityRole} from '../types/MasternodeIdentity'

export interface MasternodeIdentityId {
  role: MasternodeIdentityRole
  identifier: string
}

// Platform's create_owner_identifier and create_voter_identifier: the owner
// identity is the proTxHash itself, the voter one sha256(proTxHash ‖ voting key
// hash160). Identifiers are stored in the base58 form Platform serves.
export function masternodeIdentityIds(proTxHash: string, votingAddress: string): MasternodeIdentityId[] {
  const transactionHash = hexToBytes(proTxHash)
  const votingHash = sdkUtils.addressToPublicKeyHash(votingAddress)
  return [
    {role: 'owner', identifier: base58.encode(transactionHash)},
    {role: 'voter', identifier: base58.encode(sha256(concatBytes(transactionHash, votingHash)))},
  ]
}