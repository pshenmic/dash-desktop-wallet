import {PrivateKey, recoverHashSigner, signHash, Transaction, utils as sdkUtils} from 'dash-core-sdk'
import type {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import {hexToBytes} from '@noble/hashes/utils.js'
import {SharedRegistrationShare} from '../types/Masternode'
import {Network} from '../types/Network'

// The digest is displayed byte-reversed like every Dash hash; the signer takes
// the 32 bytes in internal order.
export function sharedRegistrationConsentDigest(tx: Transaction): Uint8Array {
  return hexToBytes(tx.consentHash()).toReversed()
}

export function sharedRegistrationShares(tx: Transaction, network: Network): SharedRegistrationShare[] {
  if (!tx.isSharedRegistration()) throw new Error('Not a shared masternode registration')
  const payload = tx.extraPayload as ProRegTX
  const sdkNetwork = sdkUtils.networkValueToEnumValue(network)
  return (payload.shares ?? []).map((share, index) => ({
    index,
    amountDuffs: share.amount,
    ownerAddress: share.getOwnerAddress(sdkNetwork),
    refundAddress: share.scriptRefund.getAddress(sdkNetwork) ?? null,
    rewardAddress: share.scriptReward.getAddress(sdkNetwork) ?? null,
  }))
}

// Base64 compact signature, the form shared_combine accepts.
export function signSharedRegistrationConsent(tx: Transaction, privateKey: PrivateKey): string {
  return Buffer.from(signHash(sharedRegistrationConsentDigest(tx), privateKey)).toString('base64')
}

export function sharedRegistrationConsentSigner(tx: Transaction, signature: string, network: Network): string {
  return recoverHashSigner(sharedRegistrationConsentDigest(tx), Buffer.from(signature, 'base64'))
    .getAddress(sdkUtils.networkValueToEnumValue(network))
}