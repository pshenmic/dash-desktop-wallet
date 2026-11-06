import {bytesToHex, hexToBytes} from '@noble/hashes/utils.js'
import {MASTERNODE_KEY_CHAINS} from '../constants/addresses'
import {MASTERNODE_COLLATERAL_DUFFS} from '../constants/chain'
import {DerivedAddress} from '../types/AddressWindow'
import {DashscanMasternode} from '../types/Dashscan'
import {Masternode, MasternodeKeyChain, NetworkMasternode} from '../types/Masternode'
import {UTXO} from '../types/UTXO'
import {legacyG1} from './masternodeKeys'

export function networkMasternode(row: DashscanMasternode): NetworkMasternode {
  const [collateralTxid, collateralVout] = row.outpoint.split('-')
  return {
    proTxHash: row.proTxHash,
    type: row.type,
    status: row.status,
    posePenaltyScore: row.posPenaltyScore,
    collateralTxid,
    collateralVout: Number(collateralVout),
    collateralAddress: row.collateralAddress,
    serviceAddress: row.address,
    payeeAddress: row.payee,
    ownerAddress: row.ownerAddress,
    votingAddress: row.votingAddress,
    operatorPublicKey: row.pubKeyOperator.toLowerCase(),
    platformNodeId: row.platformNodeId,
    platformP2PPort: row.platformP2PPort,
    platformHttpPort: row.platformHTTPPort,
    lastPaidBlock: row.lastPaidBlock,
    lastPaidTime: Math.floor(Date.parse(row.lastPaidTime) / 1000),
  }
}

// What a derived key is listed as. An operator key may be registered in either
// BLS encoding, so both are searched.
export function masternodeFilterValues(chain: MasternodeKeyChain, address: string): string[] {
  return chain === 'operator' ? [address, bytesToHex(legacyG1(hexToBytes(address)))] : [address]
}

function nodeKey(chain: MasternodeKeyChain, node: NetworkMasternode): string {
  if (chain === 'owner') return node.ownerAddress
  return chain === 'voting' ? node.votingAddress : node.operatorPublicKey
}

// proTxHash → the index of our key that the node carries for this chain.
export function matchMasternodeKeys(chain: MasternodeKeyChain, derived: DerivedAddress[], nodes: NetworkMasternode[]): Map<string, number> {
  const indexByValue = new Map(derived.flatMap(({index, address}) =>
    masternodeFilterValues(chain, address).map(value => [value, index] as const)))
  const matches = new Map<string, number>()
  for (const node of nodes) {
    const index = indexByValue.get(nodeKey(chain, node))
    if (index != null) matches.set(node.proTxHash, index)
  }
  return matches
}

export function collateralUtxos(utxos: UTXO[]): UTXO[] {
  return utxos.filter(utxo => MASTERNODE_COLLATERAL_DUFFS.includes(utxo.satoshis))
}

// A node is ours when it carries one of our keys or spends from one of our
// collateral outpoints; one listed by several searches appears once.
export function ownedMasternodes(
  nodes: NetworkMasternode[],
  matches: Record<MasternodeKeyChain, Map<string, number>>,
  collateral: UTXO[],
): Masternode[] {
  const outpoints = new Set(collateral.map(({txId, vOut}) => `${txId}:${vOut}`))
  const unique = new Map(nodes.map(node => [node.proTxHash, node]))
  return [...unique.values()]
    .filter(node => outpoints.has(`${node.collateralTxid}:${node.collateralVout}`)
      || MASTERNODE_KEY_CHAINS.some(chain => matches[chain].has(node.proTxHash)))
    .map(node => ({
      ...node,
      ownerKeyIndex: matches.owner.get(node.proTxHash) ?? null,
      votingKeyIndex: matches.voting.get(node.proTxHash) ?? null,
      operatorKeyIndex: matches.operator.get(node.proTxHash) ?? null,
    }))
}
