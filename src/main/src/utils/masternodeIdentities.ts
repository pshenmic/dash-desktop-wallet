import {sha256} from '@noble/hashes/sha2.js'
import {concatBytes, hexToBytes} from '@noble/hashes/utils.js'
import {base58} from '@scure/base'
import {utils as sdkUtils} from 'dash-core-sdk'
import type {Masternode} from '../types/Masternode'
import {MasternodeIdentityRole, MasternodeIdentityRow} from '../types/MasternodeIdentity'

export interface MasternodeIdentityId {
  role: MasternodeIdentityRole
  identifier: string
}

// Platform's owner identity is the proTxHash, the voter one
// sha256(proTxHash ‖ voting key hash160), both base58 as Platform serves them.
export function masternodeIdentityIds(proTxHash: string, votingAddress: string): MasternodeIdentityId[] {
  const transactionHash = hexToBytes(proTxHash)
  const votingHash = sdkUtils.addressToPublicKeyHash(votingAddress)
  return [
    {role: 'owner', identifier: base58.encode(transactionHash)},
    {role: 'voter', identifier: base58.encode(sha256(concatBytes(transactionHash, votingHash)))},
  ]
}

// Platform creates an identity pair for an evonode alone.
export function masternodeIdentityRows(
  nodes: Array<Pick<Masternode, 'proTxHash' | 'type' | 'votingAddress'>>,
): MasternodeIdentityRow[] {
  return nodes.filter(({type}) => type === 'Evo').flatMap(({proTxHash, votingAddress}) =>
    masternodeIdentityIds(proTxHash, votingAddress).map(({role, identifier}) => ({proTxHash, role, identifier})))
}
