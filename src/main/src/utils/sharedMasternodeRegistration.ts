import {CollateralShare, Input, Output, Script, Transaction, TransactionType, utils as sdkUtils} from 'dash-core-sdk'
import {Base58Check} from 'dash-core-sdk/src/base58check.js'
import {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import {OutPoint} from 'dash-core-sdk/src/types/OutPoint.js'
import {AddrV2Network, EXT_NET_INFO_VERSION, ExtNetInfo, NetInfoEntryType, NetInfoPurpose} from 'dash-core-sdk/src/types/ExtNetInfo.js'
import {bytesToHex} from '@noble/hashes/utils.js'
import {ADDRESS_DECODED_LENGTH, ADDRESS_PREFIX} from '../constants/addresses'
import {
  DUST_THRESHOLD_DUFFS,
  MASTERNODE_COLLATERAL_DUFFS,
  MASTERNODE_TYPE_CODE,
  MAX_OPERATOR_REWARD,
  SEQUENCE_FINAL,
  SHARED_REGISTRATION_MAX_EARLY_PERIOD_BLOCKS,
  SHARED_REGISTRATION_MAX_SHARES,
  SHARED_REGISTRATION_MIN_SHARE_DUFFS,
  SHARED_REGISTRATION_MIN_SHARES,
} from '../constants/chain'
import {
  SharedRegistrationDraft,
  SharedRegistrationMemberPlan,
  SharedRegistrationOutpoint,
  SharedRegistrationOutput,
  SharedRegistrationPlan,
  SharedRegistrationPrevout,
} from '../types/Masternode'
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

export function sharedRegistrationOutpointKey({txid, vout}: SharedRegistrationOutpoint): string {
  return `${txid.toLowerCase()}:${vout}`
}

function sharedRegistrationNetInfo(serviceAddress: string | null, network: Network): ExtNetInfo {
  if (serviceAddress == null) return new ExtNetInfo()
  const {ip, port} = serviceAddressParts(serviceAddress, network)
  return new ExtNetInfo(EXT_NET_INFO_VERSION, new Map([
    [NetInfoPurpose.CORE_P2P, [{type: NetInfoEntryType.Service, network: AddrV2Network.IPv4, address: ip, port}]],
  ]))
}

export function sharedRegistrationTx(
  draft: SharedRegistrationDraft,
  prevouts: Map<string, SharedRegistrationPrevout>,
  network: Network,
): {tx: Transaction; plan: SharedRegistrationPlan} {
  requireSharedRegistrationDraft(draft, network)

  const inputs: Input[] = []
  const values: SharedRegistrationPrevout[] = []
  for (const member of draft.members) {
    for (const outpoint of member.inputs) {
      const prevout = prevouts.get(sharedRegistrationOutpointKey(outpoint))
      if (prevout == null) throw new Error(`A funding input is not available: ${outpoint.txid}:${outpoint.vout}`)
      inputs.push(new Input(outpoint.txid, outpoint.vout, new Script(), SEQUENCE_FINAL))
      values.push(prevout)
    }
  }

  const shareOfFee = draft.feeDuffs / BigInt(draft.members.length)
  const outputs: Output[] = []
  const members: SharedRegistrationMemberPlan[] = []
  let valueIndex = 0
  for (const [index, member] of draft.members.entries()) {
    const first = valueIndex
    valueIndex += member.inputs.length
    const total = values.slice(first, valueIndex).reduce((sum, prevout) => sum + prevout.satoshis, 0n)
    const change = total - member.amountDuffs - (index === draft.members.length - 1
      ? draft.feeDuffs - shareOfFee * BigInt(draft.members.length - 1)
      : shareOfFee)
    if (change < 0n) throw new Error(`Member ${index + 1} cannot cover its share and fee share`)
    const paid = change >= DUST_THRESHOLD_DUFFS
    if (paid) outputs.push(new Output(change, sharedRegistrationScript(member.changeAddress, network)))
    members.push({
      index,
      amountDuffs: member.amountDuffs,
      feeDuffs: index === draft.members.length - 1 ? draft.feeDuffs - shareOfFee * BigInt(draft.members.length - 1) : shareOfFee,
      changeDuffs: paid ? change : 0n,
      inputIndexes: Array.from({length: member.inputs.length}, (_, offset) => first + offset),
    })
  }

  outputs.push(new Output(MASTERNODE_COLLATERAL_DUFFS.Regular, Script.sharedCollateral()))
  const collateralIndex = outputs.length - 1
  const tx = new Transaction(inputs, outputs, 0, 3, TransactionType.TRANSACTION_PROVIDER_REGISTER)

  const shares = draft.members.map(member => new CollateralShare(
    member.amountDuffs,
    sharedRegistrationScript(member.refundAddress, network),
    member.rewardAddress == null ? new Script() : sharedRegistrationScript(member.rewardAddress, network),
    bytesToHex(sdkUtils.addressToPublicKeyHash(member.ownerAddress)),
  ))
  tx.extraPayload = new ProRegTX(
    3,
    MASTERNODE_TYPE_CODE.Regular,
    0,
    new OutPoint('00'.repeat(32), collateralIndex),
    undefined,
    undefined,
    '00'.repeat(20),
    draft.operatorPublicKey,
    bytesToHex(sdkUtils.addressToPublicKeyHash(draft.votingAddress)),
    draft.operatorReward,
    new Script(),
    tx.providerInputsHash(),
    undefined,
    undefined,
    undefined,
    '',
    {
      netInfo: sharedRegistrationNetInfo(draft.serviceAddress, network),
      payouts: [],
      shares,
      joinSigs: shares.map(() => '00'.repeat(65)),
      earlyPeriodBlocks: draft.earlyPeriodBlocks,
      earlyPenalty: draft.earlyPenaltyDuffs,
    },
  )

  const inputTotal = values.reduce((sum, prevout) => sum + prevout.satoshis, 0n)
  const outputTotal = tx.outputs.reduce((sum, output) => sum + output.satoshis, 0n)
  const collateralScript = Script.sharedCollateral().hex()
  return {
    tx,
    plan: {
      txHex: tx.hex(),
      consentHash: tx.consentHash(),
      collateralIndex,
      collateralDuffs: MASTERNODE_COLLATERAL_DUFFS.Regular,
      actualFeeDuffs: inputTotal - outputTotal,
      members,
      outputs: tx.outputs.map(output => ({
        address: output.getAddress(sdkUtils.networkValueToEnumValue(network)) ?? null,
        amountDuffs: output.satoshis,
        collateral: output.script.hex() === collateralScript,
      } satisfies SharedRegistrationOutput)),
    },
  }
}
