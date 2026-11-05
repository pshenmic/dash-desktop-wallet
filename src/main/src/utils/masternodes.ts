import {bytesToHex, hexToBytes} from '@noble/hashes/utils.js'
import {MASTERNODE_KEY_CHAINS} from '../constants/addresses'
import {MASTERNODE_COLLATERAL_DUFFS} from '../constants/chain'
import {DerivedAddress} from '../types/AddressWindow'
import {DashscanMasternode} from '../types/Dashscan'
import {CoreSpendSource, ListedUtxo, SelectableUtxo} from '../types/CoinSelection'
import {
  ImportedMasternodeKey,
  Masternode,
  MasternodeCollateral,
  MasternodeKeyChain,
  MasternodeKeyFilter,
  NetworkMasternode,
} from '../types/Masternode'
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
    registeredHeight: null,
  }
}

// What a derived key is listed as. An operator key may be registered in either
// BLS encoding, so both are searched.
export function masternodeFilterValues(chain: MasternodeKeyChain, address: string): string[] {
  return chain === 'operator' ? [address, bytesToHex(legacyG1(hexToBytes(address)))] : [address]
}

// The value a filter searches the node by. Null where the list does not know it
// yet (p2p, before the registration is indexed), which matches nothing.
export function nodeKey(filter: MasternodeKeyFilter, node: NetworkMasternode): string | null {
  if (filter === 'owner') return node.ownerAddress
  if (filter === 'collateral') return node.collateralAddress
  return filter === 'voting' ? node.votingAddress : node.operatorPublicKey
}

// proTxHash → the index of our key that the node carries for this chain.
export function matchMasternodeKeys(chain: MasternodeKeyChain, derived: DerivedAddress[], nodes: NetworkMasternode[]): Map<string, number> {
  const indexByValue = new Map(derived.flatMap(({index, address}) =>
    masternodeFilterValues(chain, address).map(value => [value, index] as const)))
  const matches = new Map<string, number>()
  for (const node of nodes) {
    const key = nodeKey(chain, node)
    const index = key == null ? undefined : indexByValue.get(key)
    if (index != null) matches.set(node.proTxHash, index)
  }
  return matches
}

export function carriesKey(node: NetworkMasternode, {role, publicKey}: ImportedMasternodeKey): boolean {
  const key = nodeKey(role, node)
  return key != null && masternodeFilterValues(role, publicKey).includes(key)
}

export function collateralUtxos(utxos: UTXO[]): UTXO[] {
  return utxos.filter(utxo => MASTERNODE_COLLATERAL_DUFFS.includes(utxo.satoshis))
}

// What a discovery run stores for each owned node. A p2p list knows a node's
// collateral only once its registration is indexed, so a stored one is kept until
// then; followed, once set, stays set.
export function collateralsToStore(owned: Masternode[], stored: MasternodeCollateral[], followedNow: string[]): MasternodeCollateral[] {
  const storedByProTxHash = new Map(stored.map(row => [row.proTxHash, row]))
  const followed = new Set(followedNow)
  return owned.flatMap(({proTxHash, collateralTxid, collateralVout}) => {
    const row = storedByProTxHash.get(proTxHash)
    const txid = collateralTxid ?? row?.txid
    const vout = collateralVout ?? row?.vout
    if (txid == null || vout == null) return []
    return [{proTxHash, txid, vout, followed: (row?.followed ?? false) || followed.has(proTxHash)}]
  })
}

// By outpoint: another output of the same transaction is an ordinary coin.
function collateralOutpoints(collaterals: MasternodeCollateral[]): Set<string> {
  return new Set(collaterals.map(({txid, vout}) => `${txid}:${vout}`))
}

// A selection never takes a collateral on its own, since spending it drops the
// node; a coin-control pick of one is the user's call and stays.
export function withoutCollaterals(utxos: UTXO[], collaterals: MasternodeCollateral[], source?: CoreSpendSource): UTXO[] {
  if (source?.kind === 'outpoints') return utxos
  const locked = collateralOutpoints(collaterals)
  return utxos.filter(({txId, vOut}) => !locked.has(`${txId}:${vOut}`))
}

export function withCollateralFlag(utxos: SelectableUtxo[], collaterals: MasternodeCollateral[]): ListedUtxo[] {
  const locked = collateralOutpoints(collaterals)
  return utxos.map(utxo => ({...utxo, collateral: locked.has(`${utxo.txid}:${utxo.vout}`)}))
}

// A node is ours when it carries one of our derived or imported keys, or spends
// from one of our collateral outpoints; one listed by several searches appears once.
export function ownedMasternodes(
  nodes: NetworkMasternode[],
  matches: Record<MasternodeKeyChain, Map<string, number>>,
  imported: ImportedMasternodeKey[],
  collateral: UTXO[],
): Masternode[] {
  const outpoints = new Set(collateral.map(({txId, vOut}) => `${txId}:${vOut}`))
  const unique = new Map(nodes.map(node => [node.proTxHash, node]))
  return [...unique.values()]
    .map(node => ({
      ...node,
      ownerKeyIndex: matches.owner.get(node.proTxHash) ?? null,
      votingKeyIndex: matches.voting.get(node.proTxHash) ?? null,
      operatorKeyIndex: matches.operator.get(node.proTxHash) ?? null,
      importedRoles: MASTERNODE_KEY_CHAINS.filter(role => imported.some(key => key.role === role && carriesKey(node, key))),
    }))
    .filter(node => outpoints.has(`${node.collateralTxid}:${node.collateralVout}`)
      || node.importedRoles.length > 0
      || MASTERNODE_KEY_CHAINS.some(chain => matches[chain].has(node.proTxHash)))
}
