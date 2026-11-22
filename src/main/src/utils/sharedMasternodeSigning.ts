import {PrivateKey, recoverHashSigner, Script, signHash, Transaction, utils as sdkUtils} from 'dash-core-sdk'
import type {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import {hexToBytes} from '@noble/hashes/utils.js'
import {SharedRegistrationShare} from '../types/Masternode'
import {Network} from '../types/Network'

// The digest is displayed byte-reversed like every Dash hash; the signer takes
// the 32 bytes in internal order.
function sharedRegistrationConsentDigest(tx: Transaction): Uint8Array {
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

// The collateral a shared registration creates, which the share table must add
// up to: a participant who consented to a table that disagrees with it would be
// signing a registration Core rejects.
export function sharedRegistrationCollateralDuffs(tx: Transaction, shares: SharedRegistrationShare[]): bigint {
  const template = Script.sharedCollateral().hex()
  const collateral = tx.outputs.find(output => output.script.hex() === template)
  if (collateral == null) throw new Error('A shared registration pays no collateral output')
  const sum = shares.reduce((total, share) => total + share.amountDuffs, 0n)
  if (sum !== collateral.satoshis) {
    throw new Error(`The share table adds up to ${sum} duffs, not the collateral's ${collateral.satoshis}`)
  }
  return collateral.satoshis
}

// Base64 compact signature, the form shared_combine accepts.
export function signSharedRegistrationConsent(tx: Transaction, privateKey: PrivateKey): string {
  return Buffer.from(signHash(sharedRegistrationConsentDigest(tx), privateKey)).toString('base64')
}

export function sharedRegistrationConsentSigner(tx: Transaction, signature: string, network: Network): string {
  return recoverHashSigner(sharedRegistrationConsentDigest(tx), Buffer.from(signature, 'base64'))
    .getAddress(sdkUtils.networkValueToEnumValue(network))
}