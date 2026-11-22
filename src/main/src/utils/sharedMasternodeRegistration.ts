import {Script} from 'dash-core-sdk'
import {Base58Check} from 'dash-core-sdk/src/base58check.js'
import {bytesToHex} from '@noble/hashes/utils.js'
import {ADDRESS_DECODED_LENGTH, ADDRESS_PREFIX} from '../constants/addresses'
import {
  MASTERNODE_COLLATERAL_DUFFS,
  MAX_OPERATOR_REWARD,
  SHARED_REGISTRATION_MAX_EARLY_PERIOD_BLOCKS,
  SHARED_REGISTRATION_MAX_SHARES,
  SHARED_REGISTRATION_MIN_SHARE_DUFFS,
  SHARED_REGISTRATION_MIN_SHARES,
} from '../constants/chain'
import {SharedRegistrationDraft} from '../types/Masternode'
import {Network} from '../types/Network'
import {requireBasicOperatorKey} from './masternodeKeys'
import {serviceAddressParts} from './providerTx'

type AddressType = 'p2pkh' | 'p2sh'

function decodeAddress(address: string, network: Network): {type: AddressType; hash: Uint8Array} {
  let decoded: Uint8Array
  try {
    decoded = Base58Check.decode(address)
  } catch {
    throw new Error(`Invalid address: ${address}`)
  }
  if (decoded.length !== ADDRESS_DECODED_LENGTH) throw new Error(`Invalid address: ${address}`)
  const hash = decoded.slice(1)
  if (decoded[0] === ADDRESS_PREFIX[network].p2pkh) return {type: 'p2pkh', hash}
  if (decoded[0] === ADDRESS_PREFIX[network].p2sh) return {type: 'p2sh', hash}
  throw new Error(`${address} is not a valid ${network} address`)
}

export function sharedRegistrationScript(address: string, network: Network): Script {
  const {type, hash} = decodeAddress(address, network)
  return type === 'p2pkh'
    ? Script.fromHex(`76a914${bytesToHex(hash)}88ac`)
    : Script.fromHex(`a914${bytesToHex(hash)}87`)
}

export function requireSharedRegistrationDraft(draft: SharedRegistrationDraft, network: Network): void {
  const {members} = draft
  if (members.length < SHARED_REGISTRATION_MIN_SHARES || members.length > SHARED_REGISTRATION_MAX_SHARES) {
    throw new Error(`A shared registration has ${SHARED_REGISTRATION_MIN_SHARES} to ${SHARED_REGISTRATION_MAX_SHARES} shares`)
  }

  let total = 0n
  let smallest = members[0].amountDuffs
  for (const member of members) {
    if (member.amountDuffs < SHARED_REGISTRATION_MIN_SHARE_DUFFS) throw new Error('A share must be at least 100 DASH')
    total += member.amountDuffs
    if (member.amountDuffs < smallest) smallest = member.amountDuffs
  }
  if (total !== MASTERNODE_COLLATERAL_DUFFS.Regular) throw new Error('The shares must add up to 1000 DASH')

  const owners = new Set<string>()
  const refunds = new Set<string>()
  for (const member of members) {
    if (owners.has(member.ownerAddress)) throw new Error('A share owner key may appear once')
    owners.add(member.ownerAddress)
    const refund = sharedRegistrationScript(member.refundAddress, network).hex()
    if (refunds.has(refund)) throw new Error('A refund script may appear once')
    refunds.add(refund)
  }

  const ownerScripts = new Set<string>()
  for (const member of members) {
    if (decodeAddress(member.ownerAddress, network).type !== 'p2pkh') {
      throw new Error('The owner key of a share must be a P2PKH address')
    }
    ownerScripts.add(sharedRegistrationScript(member.ownerAddress, network).hex())
    sharedRegistrationScript(member.changeAddress, network)
    if (member.rewardAddress != null) sharedRegistrationScript(member.rewardAddress, network)
  }

  if (decodeAddress(draft.votingAddress, network).type !== 'p2pkh') {
    throw new Error('The voting key must be a P2PKH address')
  }
  const votingScript = sharedRegistrationScript(draft.votingAddress, network).hex()
  for (const member of members) {
    const scripts = [
      sharedRegistrationScript(member.refundAddress, network).hex(),
      ...(member.rewardAddress == null ? [] : [sharedRegistrationScript(member.rewardAddress, network).hex()]),
    ]
    if (scripts.includes(votingScript)) throw new Error('A refund or reward script may not pay the voting key')
    if (scripts.some(script => ownerScripts.has(script))) {
      throw new Error('A refund or reward script may not pay a share owner key')
    }
  }

  requireBasicOperatorKey(draft.operatorPublicKey)
  if (!Number.isInteger(draft.operatorReward) || draft.operatorReward < 0 || draft.operatorReward > MAX_OPERATOR_REWARD) {
    throw new Error(`Operator reward must be a whole number from 0 to ${MAX_OPERATOR_REWARD}`)
  }
  if (draft.serviceAddress != null) serviceAddressParts(draft.serviceAddress, network)

  if (!Number.isInteger(draft.earlyPeriodBlocks) || draft.earlyPeriodBlocks < 0 ||
      draft.earlyPeriodBlocks > SHARED_REGISTRATION_MAX_EARLY_PERIOD_BLOCKS) {
    throw new Error(`An early period is at most ${SHARED_REGISTRATION_MAX_EARLY_PERIOD_BLOCKS} blocks`)
  }
  if (draft.earlyPenaltyDuffs < 0n) throw new Error('An early penalty cannot be negative')
  if (draft.earlyPeriodBlocks === 0 && draft.earlyPenaltyDuffs !== 0n) {
    throw new Error('An early penalty needs an early period')
  }
  if (draft.earlyPenaltyDuffs >= smallest) throw new Error('The early penalty must be below the smallest share')

  if (draft.feeDuffs <= 0n) throw new Error('The registration fee must be positive')

  const seen = new Set<string>()
  for (const member of members) {
    if (member.inputs.length === 0) throw new Error('A member needs at least one funding input')
    for (const input of member.inputs) {
      if (!/^[0-9a-fA-F]{64}$/.test(input.txid) || !Number.isInteger(input.vout) || input.vout < 0) {
        throw new Error('A funding outpoint needs a txid and an output index')
      }
      const key = `${input.txid.toLowerCase()}:${input.vout}`
      if (seen.has(key)) throw new Error('The same funding outpoint appears twice')
      seen.add(key)
    }
  }
}
