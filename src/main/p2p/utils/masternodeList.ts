import {FinalCommitment, MnListDiff, MnType, NetInfoPurpose, NetInfoType} from 'dash-core-p2p'
import type {NetAddress, SimplifiedMNListEntry} from 'dash-core-p2p'
import {TransactionType, utils as sdkUtils} from 'dash-core-sdk'
import type {Transaction} from 'dash-core-sdk'
import type {ProRegTX} from 'dash-core-sdk/src/types/ExtraPayload/ProRegTX.js'
import type {ProUpRegTx} from 'dash-core-sdk/src/types/ExtraPayload/ProUpRegTx.js'
import {hexToBytes} from '@noble/hashes/utils.js'
import type {NetworkMasternode} from '../../src/types/Masternode'
import type {Network} from '../../src/types/Network'
import type {PayoutUpdate, ProviderRegistration} from '../types/masternodeList'
import {wireToDisplayHex} from './byteOrder'
import {hashHeaderRaw} from './pow'

// Null when the entries do not hash to the merkleRootMNList the coinbase commits to.
export function evonodeDapiUrls(diff: MnListDiff): string[] | null {
  if (diff.merkleRootMNList !== MnListDiff.calcMerkleRootMNList(diff.mnList)) return null
  const urls = diff.mnList
    .filter(entry => entry.nType === MnType.Evo && entry.isValid)
    .flatMap(({address, platformHTTPPort}) => {
      if (address?.host == null || platformHTTPPort == null) return []
      const host = address.host.includes(':') ? `[${address.host}]` : address.host
      return [`https://${host}:${platformHTTPPort}`]
    })
  return [...new Set(urls)]
}

// The platform worker builds the same key from a proof; the type is part of it
// because two types can share a hash.
export function quorumKey({llmqType, quorumHash}: {llmqType: number; quorumHash: string}): string {
  return `${llmqType}:${quorumHash}`
}

// The quorum set after applying `diff` to `previous`, or null unless `header`
// proves the diff's coinbase and that coinbase's merkleRootQuorums covers the set.
export function committedQuorums(diff: MnListDiff, header: Uint8Array, previous: FinalCommitment[]): FinalCommitment[] | null {
  const deleted = new Set(diff.deletedQuorums.map(quorumKey))
  const quorums = [...previous.filter(quorum => !deleted.has(quorumKey(quorum))), ...diff.newQuorums]
  return MnListDiff.calcMerkleRootQuorums(quorums) === diff.merkleRootQuorums &&
    diff.calcBlockMerkleRoot() === wireToDisplayHex(header.subarray(36, 68)) ? quorums : null
}

// A full list (zero base) is trusted only when `header`, the block at its
// coinbase height on our own chain, proves the coinbase and that coinbase's
// merkleRootMNList covers every entry.
export function listCommitted(diff: MnListDiff, header: Uint8Array): boolean {
  return !/[^0]/.test(diff.baseBlockHash) &&
    hashHeaderRaw(header) === diff.blockHash &&
    diff.calcBlockMerkleRoot() === wireToDisplayHex(header.subarray(36, 68)) &&
    diff.merkleRootMNList === MnListDiff.calcMerkleRootMNList(diff.mnList)
}

// Null unless `tx` is the ProRegTx of `proTxHash`. A null collateral outpoint
// names an output of the ProRegTx itself, the only case its address is known.
export function providerRegistration(tx: Transaction, proTxHash: string, height: number, network: Network): ProviderRegistration | null {
  if (tx.type !== TransactionType.TRANSACTION_PROVIDER_REGISTER || tx.hash() !== proTxHash) return null
  const payload = tx.extraPayload as ProRegTX
  const {txId, vOut} = payload.collateralOutpoint
  const internal = !/[^0]/.test(txId)
  return {
    height,
    isEvo: payload.type === MnType.Evo,
    collateralTxid: internal ? proTxHash : txId,
    collateralVout: vOut,
    collateralAddress: internal ? tx.outputs[vOut]?.getAddress(network) ?? null : null,
    ownerAddress: payload.getOwnerAddress(network),
    payouts: [{height, address: payload.getPayoutAddress(network) ?? null}],
    platformP2PPort: payload.platformP2PPort ?? null,
  }
}

// The payout a ProUpRegTx for one of `watched` (display-order proTxHashes) sets.
export function payoutUpdate(tx: Transaction, watched: Set<string>, height: number, network: Network): PayoutUpdate | null {
  if (tx.type !== TransactionType.TRANSACTION_PROVIDER_UPDATE_REGISTRAR) return null
  const payload = tx.extraPayload as ProUpRegTx
  if (!watched.has(payload.proTxHash)) return null
  return {proTxHash: payload.proTxHash, payoutAddress: payload.getPayoutAddress(network) ?? null, height}
}

function hostPort({host, port}: NetAddress): string | null {
  if (host == null) return null
  return host.includes(':') ? `[${host}]:${port}` : `${host}:${port}`
}

// The list carries no PoSe score or payments, and tells a banned node from a
// valid one but not from a revoked one.
export function listedMasternode(entry: SimplifiedMNListEntry, registration: ProviderRegistration | undefined, network: Network): NetworkMasternode {
  const platformP2P = entry.netInfo?.entries[NetInfoPurpose.PLATFORM_P2P]?.find(info => info.type === NetInfoType.Service)
  return {
    proTxHash: entry.proRegTxHash,
    type: (registration?.isEvo ?? entry.nType === MnType.Evo) ? 'Evo' : 'Regular',
    status: entry.isValid ? 'ENABLED' : 'POSE_BANNED',
    posePenaltyScore: null,
    collateralTxid: registration?.collateralTxid ?? null,
    collateralVout: registration?.collateralVout ?? null,
    collateralAddress: registration?.collateralAddress ?? null,
    serviceAddress: entry.address == null ? null : hostPort(entry.address),
    payeeAddress: registration?.payouts.at(-1)?.address ?? null,
    ownerAddress: registration?.ownerAddress ?? null,
    votingAddress: sdkUtils.publicKeyHashToAddress(hexToBytes(entry.keyIDVoting), network),
    operatorPublicKey: entry.pubKeyOperator.toLowerCase(),
    platformNodeId: entry.platformNodeID ?? null,
    platformP2PPort: platformP2P?.type === NetInfoType.Service ? platformP2P.service.port : registration?.platformP2PPort ?? null,
    platformHttpPort: entry.platformHTTPPort ?? null,
    lastPaidBlock: null,
    lastPaidTime: null,
    registeredHeight: registration?.height ?? null,
  }
}
