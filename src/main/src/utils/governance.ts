import {secp256k1} from '@noble/curves/secp256k1.js'
import {bytesToHex, concatBytes, hexToBytes, utf8ToBytes} from '@noble/hashes/utils.js'
import {utils as sdkUtils} from 'dash-core-sdk'
import {
  DUFFS_PER_DASH,
  GOVERNANCE_PROPOSAL_TYPE,
  MASTERNODE_VOTE_WEIGHT,
  SUPERBLOCK_CYCLE_SECONDS,
  VOTE_OUTCOME_CODE,
  VOTE_SIGNAL_FUNDING,
} from '../constants/chain'
import {DashscanProposal} from '../types/Dashscan'
import {GovernanceObject, GovernanceVote, Proposal, ProposalTally, UnsignedVote, VoteOutcome} from '../types/Governance'
import {MasternodeType, NetworkMasternode} from '../types/Masternode'
import {Network} from '../types/Network'
import {isHash, requireProTxHash, signedMessageHash} from './providerTx'

const {decodeCompactSize, doubleSHA256, encodeCompactSize, getCompactVariableSize, publicKeyHashToAddress, SHA256RIPEMD160} = sdkUtils

// Hashes travel in wire order and are shown reversed.
const wire = (hex: string): Uint8Array => hexToBytes(hex).reverse()
const display = (bytes: Uint8Array): string => bytesToHex(Uint8Array.from(bytes).reverse())

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function varBytes(bytes: Uint8Array, offset: number): {value: Uint8Array; end: number} {
  const length = Number(decodeCompactSize(offset, bytes))
  const start = offset + getCompactVariableSize(length)
  if (start + length > bytes.length) throw new Error('Truncated governance message')
  return {value: bytes.subarray(start, start + length), end: start + length}
}

function withLength(bytes: Uint8Array): Uint8Array {
  return concatBytes(encodeCompactSize(bytes.length), bytes)
}

// Object::GetHash, which is not the serialization: the data goes in as its hex
// string, the type and fee tx stay out, and the outpoint is padded to a CTxIn.
export function governanceObject(bytes: Uint8Array): GovernanceObject {
  const data = varBytes(bytes, 76)
  const outpointAt = data.end + 4
  const outpoint = bytes.subarray(outpointAt, outpointAt + 36)
  const signature = varBytes(bytes, outpointAt + 36)
  const dataHex = bytesToHex(data.value)
  const hash = doubleSHA256(concatBytes(
    bytes.subarray(0, 44), withLength(utf8ToBytes(dataHex)), outpoint, Uint8Array.of(0, 0xff, 0xff, 0xff, 0xff), withLength(signature.value),
  ))
  return {
    hash: display(hash),
    type: view(bytes).getInt32(data.end, true),
    time: Number(view(bytes).getBigInt64(36, true)),
    collateralHash: display(bytes.subarray(44, 76)),
    data: dataHex,
  }
}

// Proposal data is JSON, either bare or wrapped as [["proposal", {...}]] by
// clients older than v0.14.
export function proposalOf(object: GovernanceObject): Proposal | null {
  if (object.type !== GOVERNANCE_PROPOSAL_TYPE) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(hexToBytes(object.data)))
  } catch {
    return null
  }
  const fields = (Array.isArray(parsed) ? parsed[0]?.[1] : parsed) as Record<string, unknown> | undefined
  const {name, url, payment_address: paymentAddress, payment_amount: amount, start_epoch: startEpoch, end_epoch: endEpoch} = fields ?? {}
  if (typeof name !== 'string' || typeof paymentAddress !== 'string' || typeof amount !== 'number'
    || typeof startEpoch !== 'number' || typeof endEpoch !== 'number') return null
  return {
    hash: object.hash,
    name,
    url: typeof url === 'string' ? url : '',
    paymentAddress,
    paymentDuffs: proposalDuffs(amount),
    startEpoch,
    endEpoch,
    createdAt: object.time,
    collateralHash: object.collateralHash,
  }
}

export function dashscanProposal(row: DashscanProposal): Proposal {
  return {
    hash: row.hash,
    name: row.name,
    url: row.url,
    paymentAddress: row.paymentAddress,
    paymentDuffs: proposalDuffs(row.paymentAmount),
    startEpoch: row.startEpoch,
    endEpoch: row.endEpoch,
    createdAt: Math.floor(Date.parse(row.creationTime) / 1000),
    collateralHash: row.collateralHash,
  }
}

// A proposal states its amount as a JSON number of DASH.
function proposalDuffs(amount: number): bigint {
  return BigInt(Math.round(amount * Number(DUFFS_PER_DASH)))
}

export function requireVoteRequest(proposalHash: string, outcome: VoteOutcome, proTxHashes: string[]): void {
  if (!isHash(proposalHash)) throw new Error('Not a proposal hash: 64 hex characters')
  if (!Object.hasOwn(VOTE_OUTCOME_CODE, outcome)) throw new Error(`Unknown vote outcome: ${outcome}`)
  if (!Array.isArray(proTxHashes) || proTxHashes.length === 0) throw new Error('Name at least one masternode to vote with')
  proTxHashes.forEach(requireProTxHash)
  if (new Set(proTxHashes).size !== proTxHashes.length) throw new Error('A masternode is named twice')
}

// now is unix seconds.
export function isStaleProposal({endEpoch}: Pick<Proposal, 'endEpoch'>, now: number, network: Network): boolean {
  return endEpoch < now - SUPERBLOCK_CYCLE_SECONDS[network]
}

function voteFields({collateralTxid, collateralVout, parentHash, outcome, signal, time}: UnsignedVote): Uint8Array {
  const fields = new Uint8Array(84)
  const writer = view(fields)
  fields.set(wire(collateralTxid), 0)
  writer.setUint32(32, collateralVout, true)
  fields.set(wire(parentHash), 36)
  writer.setInt32(68, outcome, true)
  writer.setInt32(72, signal, true)
  writer.setBigInt64(76, BigInt(time), true)
  return fields
}

export function voteBytes(vote: UnsignedVote, signature: Uint8Array): Uint8Array {
  return concatBytes(voteFields(vote), withLength(signature))
}

// Core checks a vote's signature as a hash on testnet and as a signed message
// everywhere else.
export function voteDigest(vote: UnsignedVote, network: Network): Uint8Array {
  if (network === 'testnet') return doubleSHA256(voteFields(vote))
  const {collateralTxid, collateralVout, parentHash, signal, outcome, time} = vote
  return signedMessageHash(`${collateralTxid}-${collateralVout}|${parentHash}|${signal}|${outcome}|${time}`)
}

// CGovernanceVote::GetHash, which pads the outpoint to a CTxIn and puts the
// signal before the outcome.
export function voteHash(vote: UnsignedVote): string {
  const fields = voteFields(vote)
  return display(doubleSHA256(concatBytes(
    fields.subarray(0, 36), Uint8Array.of(0, 0xff, 0xff, 0xff, 0xff), fields.subarray(36, 68),
    fields.subarray(72, 76), fields.subarray(68, 72), fields.subarray(76, 84),
  )))
}

function recoveredAddress(digest: Uint8Array, signature: Uint8Array, network: Network): string | null {
  const header = signature[0] - 27
  if (signature.length !== 65 || header < 0 || header > 7) return null
  try {
    const point = secp256k1.Signature.fromBytes(signature.subarray(1), 'compact').addRecoveryBit(header & 3).recoverPublicKey(digest)
    return publicKeyHashToAddress(SHA256RIPEMD160(point.toBytes(header >= 4)), network)
  } catch {
    return null
  }
}

export function governanceVote(bytes: Uint8Array, network: Network): GovernanceVote {
  const reader = view(bytes)
  const vote: UnsignedVote = {
    collateralTxid: display(bytes.subarray(0, 32)),
    collateralVout: reader.getUint32(32, true),
    parentHash: display(bytes.subarray(36, 68)),
    outcome: reader.getInt32(68, true),
    signal: reader.getInt32(72, true),
    time: Number(reader.getBigInt64(76, true)),
  }
  const signature = varBytes(bytes, 84).value
  return {...vote, hash: voteHash(vote), voter: recoveredAddress(voteDigest(vote, network), signature, network)}
}

// Core keeps each node's latest vote per signal and drops one whose key is not
// the node's current voting key.
export function proposalTally(votes: GovernanceVote[], masternodes: NetworkMasternode[]): ProposalTally {
  const nodes = new Map(masternodes.map(node => [`${node.collateralTxid}:${node.collateralVout}`, node]))
  const latest = new Map<string, GovernanceVote>()
  for (const vote of votes) {
    const outpoint = `${vote.collateralTxid}:${vote.collateralVout}`
    if (vote.signal !== VOTE_SIGNAL_FUNDING || vote.voter == null || vote.voter !== nodes.get(outpoint)?.votingAddress) continue
    if ((latest.get(outpoint)?.time ?? -1) < vote.time) latest.set(outpoint, vote)
  }
  const tally: ProposalTally = {yes: 0, no: 0, abstain: 0}
  const outcomes = Object.keys(VOTE_OUTCOME_CODE) as VoteOutcome[]
  for (const [outpoint, vote] of latest) {
    const outcome = outcomes.find(name => VOTE_OUTCOME_CODE[name] === vote.outcome)
    if (outcome != null) tally[outcome] += MASTERNODE_VOTE_WEIGHT[nodes.get(outpoint)!.type as MasternodeType] ?? 1
  }
  return tally
}
