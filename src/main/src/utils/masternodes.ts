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
  MasternodeKeyFilter,
  NetworkMasternode,
  OwnedCollateral,
} from '../types/Masternode'
import {UTXO} from '../types/UTXO'
import {legacyG1} from './masternodeKeys'

export function networkMasternode(row: DashscanMasternode): NetworkMasternode {
  const [collateralTxid, collateralVout] = row.outpoint.split('-')
  // A shared node's owner and payee are comma-joined share lists; no amounts are served.
  const shared = row.ownerAddress.includes(',')
  return {
    proTxHash: row.proTxHash,
    type: row.type,
    status: row.status,
    posePenaltyScore: row.posPenaltyScore,
    collateralTxid,
    collateralVout: Number(collateralVout),
    collateralAddress: row.collateralAddress,
    serviceAddress: row.address,
    payeeAddress: shared ? null : row.payee,
    ownerAddress: shared ? null : row.ownerAddress,
    votingAddress: row.votingAddress,
    operatorPublicKey: row.pubKeyOperator.toLowerCase(),
    platformNodeId: row.platformNodeId,
    platformP2PPort: row.platformP2PPort,
    platformHttpPort: row.platformHTTPPort,
    lastPaidBlock: row.lastPaidBlock,
    lastPaidTime: Math.floor(Date.parse(row.lastPaidTime) / 1000),
    registeredHeight: null,
    isShared: shared,
    shares: null,
  }
}

// What a derived key is listed as. An operator key may be registered in either
// BLS encoding, so both are searched.
export function masternodeFilterValues(chain: MasternodeKeyFilter, address: string): string[] {
  return chain === 'operator' ? [address, bytesToHex(legacyG1(hexToBytes(address)))] : [address]
}

// The values a filter searches the node by. The owner chain also searches the
// share table: a shared registration has no top-level owner key.
export function nodeKeyValues(filter: MasternodeKeyFilter, node: NetworkMasternode): string[] {
  switch (filter) {
    case 'owner':
      return [node.ownerAddress, ...(node.shares ?? []).map(({ownerAddress}) => ownerAddress)]
        .filter((address): address is string => address != null)
    case 'collateral':
      return node.collateralAddress == null ? [] : [node.collateralAddress]
    case 'voting':
      return [node.votingAddress]
    case 'operator':
      return [node.operatorPublicKey]
  }
}

// proTxHash → the index of our key that the node carries for this chain.
export function matchMasternodeKeys(chain: MasternodeKeyFilter, derived: DerivedAddress[], nodes: NetworkMasternode[]): Map<string, number> {
  const indexByValue = new Map(derived.flatMap(({index, address}) =>
    masternodeFilterValues(chain, address).map(value => [value, index] as const)))
  const matches = new Map<string, number>()
  for (const node of nodes) {
    for (const key of nodeKeyValues(chain, node)) {
      const index = indexByValue.get(key)
      if (index != null) {
        matches.set(node.proTxHash, index)
        break
      }
    }
  }
  return matches
}

export function carriesKey(node: NetworkMasternode, {role, publicKey}: ImportedMasternodeKey): boolean {
  const values = masternodeFilterValues(role, publicKey)
  return nodeKeyValues(role, node).some(key => values.includes(key))
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

// By outpoint, so a node whose collateral moved since the list was read keeps no stale address.
export function ownedCollaterals(stored: MasternodeCollateral[], listed: Masternode[]): OwnedCollateral[] {
  const addresses = new Map(listed.map(node => [`${node.collateralTxid}:${node.collateralVout}`, node.collateralAddress]))
  return stored.map(({proTxHash, txid, vout}) => ({proTxHash, txid, vout, address: addresses.get(`${txid}:${vout}`) ?? null}))
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
// from one of our collateral outpoints or collateral-chain addresses; one listed
// by several searches appears once.
export function ownedMasternodes(
  nodes: NetworkMasternode[],
  matches: Record<MasternodeKeyFilter, Map<string, number>>,
  imported: ImportedMasternodeKey[],
  collateral: UTXO[],
  ownerIndexes: Map<string, number>,
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
      shares: node.shares?.map(share => ({
        ...share,
        keyIndex: ownerIndexes.get(share.ownerAddress) ?? null,
        imported: imported.some(key => key.role === 'owner' && key.publicKey === share.ownerAddress),
      })) ?? null,
    }))
    .filter(node => outpoints.has(`${node.collateralTxid}:${node.collateralVout}`)
      || node.importedRoles.length > 0
      || Object.values(matches).some(chainMatches => chainMatches.has(node.proTxHash)))
}
