import {describe, expect, it} from 'vitest'
import {hexToBytes} from '@noble/hashes/utils.js'
import {Script} from 'dash-core-sdk'
import {DashscanMasternode} from '../../src/main/src/types/Dashscan'
import {Masternode, NetworkMasternode} from '../../src/main/src/types/Masternode'
import {UTXO} from '../../src/main/src/types/UTXO'
import {masternodeKeyDeriver, masternodeKeys} from '../../src/main/src/utils/masternodeKeys'
import {
  collateralUtxos,
  existingMasternodes,
  masternodeFilterValues,
  matchMasternodeKeys,
  networkMasternode,
  ownedCollaterals,
  ownedMasternodes,
  collateralsToStore,
  withCollateralFlag,
  withoutCollaterals,
} from '../../src/main/src/utils/masternodes'

const SEED = hexToBytes('5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4')
const OPERATOR_0 = '878cad04aae29eb76171937eb7101452b401b026efbc27db840f130374e6a9ec8443d917277f8921e0ba6678a7709875'
const OPERATOR_0_LEGACY = '078cad04aae29eb76171937eb7101452b401b026efbc27db840f130374e6a9ec8443d917277f8921e0ba6678a7709875'

function node(proTxHash: string, fields: Partial<NetworkMasternode> = {}): NetworkMasternode {
  return {
    proTxHash, type: 'Regular', status: 'ENABLED', posePenaltyScore: 0,
    collateralTxid: 'c'.repeat(64), collateralVout: 0, collateralAddress: 'Xcollateral',
    serviceAddress: '1.2.3.4:9999', payeeAddress: 'Xpayee', ownerAddress: 'Xowner', votingAddress: 'Xvoting',
    operatorPublicKey: 'ff'.repeat(48), platformNodeId: null, platformP2PPort: null, platformHttpPort: null,
    lastPaidBlock: 0, lastPaidTime: 0, registeredHeight: null, ...fields,
  }
}

function utxo(txId: string, vOut: number, satoshis: bigint): UTXO {
  return {address: 'Xcollateral', satoshis, script: new Script(), txId, vOut, height: 1, timestamp: null, confirmations: 1}
}

describe('networkMasternode', () => {
  it('splits the collateral outpoint and reads an unpaid node as never paid', () => {
    const row: DashscanMasternode = {
      proTxHash: 'p', address: '1.2.3.4:19999', payee: 'ypayee', status: 'ENABLED', type: 'Evo', posPenaltyScore: 3,
      lastPaidTime: '1970-01-01T00:00:00.000Z', lastPaidBlock: 0, ownerAddress: 'yowner', votingAddress: 'yvoting',
      collateralAddress: 'ycollateral', pubKeyOperator: 'A73D', outpoint: `${'ab'.repeat(32)}-1`,
      platformNodeId: '71b5', platformP2PPort: 22821, platformHTTPPort: 22822,
    }
    expect(networkMasternode(row)).toMatchObject({
      collateralTxid: 'ab'.repeat(32), collateralVout: 1, lastPaidTime: 0, operatorPublicKey: 'a73d',
      serviceAddress: '1.2.3.4:19999', payeeAddress: 'ypayee', platformHttpPort: 22822,
    })
  })
})

describe('masternode key matching', () => {
  const keys = masternodeKeys(SEED, 'mainnet')

  it('searches an operator key in both BLS encodings', () => {
    expect(masternodeFilterValues('operator', OPERATOR_0)).toEqual([OPERATOR_0, OPERATOR_0_LEGACY])
    expect(masternodeFilterValues('owner', 'Xowner')).toEqual(['Xowner'])
  })

  it('matches a node registered with the legacy operator key to its index', () => {
    const derived = [0, 1].map(index => masternodeKeyDeriver(keys, 'mainnet', 'operator').derive(index))
    expect(derived[0].address).toBe(OPERATOR_0)
    const matches = matchMasternodeKeys('operator', derived, [node('a', {operatorPublicKey: OPERATOR_0_LEGACY}), node('b')])
    expect([...matches]).toEqual([['a', 0]])
  })

  it('matches owner and voting keys by their own address', () => {
    const owner = masternodeKeyDeriver(keys, 'mainnet', 'owner').derive(3)
    const voting = masternodeKeyDeriver(keys, 'mainnet', 'voting').derive(3)
    expect(owner.address).not.toBe(voting.address)
    expect(owner.derivationPath).toBe("m/9'/5'/3'/2'/3")
    const listed = [node('a', {ownerAddress: owner.address, votingAddress: owner.address})]
    expect([...matchMasternodeKeys('owner', [owner], listed)]).toEqual([['a', 3]])
    expect([...matchMasternodeKeys('voting', [voting], listed)]).toEqual([])
  })

  // The p2p list knows an owner only once the ProRegTx is indexed.
  it('matches nothing by an owner key not known yet', () => {
    const owner = masternodeKeyDeriver(keys, 'mainnet', 'owner').derive(0)
    expect([...matchMasternodeKeys('owner', [owner], [node('a', {ownerAddress: null})])]).toEqual([])
  })
})

describe('ownedMasternodes', () => {
  const none = {owner: new Map(), voting: new Map(), operator: new Map(), collateral: new Map()}

  it('flags a collateral by its outpoint, not by its amount or address', () => {
    const coin = (txid: string, vout: number) =>
      ({txid, vout, satoshis: 100_000_000_000n, address: 'Xcollateral', height: 1, timestamp: null, confirmations: 1})
    expect(withCollateralFlag([coin('aa', 0), coin('aa', 1)], [{proTxHash: 'p', txid: 'aa', vout: 0, followed: false}]).map(({collateral}) => collateral))
      .toEqual([true, false])
  })

  // An automatic send that took it would drop the masternode.
  it('keeps a collateral out of a selection unless coin control picked it', () => {
    const coins = [utxo('aa', 0, 100_000_000_000n), utxo('aa', 1, 5n)]
    const collaterals = [{proTxHash: 'p', txid: 'aa', vout: 0, followed: false}]
    expect(withoutCollaterals(coins, collaterals).map(({vOut}) => vOut)).toEqual([1])
    expect(withoutCollaterals(coins, collaterals, {kind: 'address', address: 'Xcollateral'}).map(({vOut}) => vOut)).toEqual([1])
    expect(withoutCollaterals(coins, collaterals, {kind: 'outpoints', outpoints: [{txid: 'aa', vout: 0}]})).toHaveLength(2)
  })

  // A p2p list knows a node's collateral only once its registration is indexed.
  it('keeps a stored collateral the list cannot give yet, and never unsets followed', () => {
    const stored = [
      {proTxHash: 'a', txid: 'aa', vout: 0, followed: true},
      {proTxHash: 'b', txid: 'bb', vout: 1, followed: false},
    ]
    const owned = [
      {...node('a', {collateralTxid: null, collateralVout: null}), ownerKeyIndex: 0, votingKeyIndex: null, operatorKeyIndex: null, importedRoles: []},
      {...node('b'), ownerKeyIndex: 0, votingKeyIndex: null, operatorKeyIndex: null, importedRoles: []},
      {...node('c', {collateralTxid: null, collateralVout: null}), ownerKeyIndex: 1, votingKeyIndex: null, operatorKeyIndex: null, importedRoles: []},
    ]
    expect(collateralsToStore(owned, stored, ['b'])).toEqual([
      {proTxHash: 'a', txid: 'aa', vout: 0, followed: true},
      {proTxHash: 'b', txid: 'c'.repeat(64), vout: 0, followed: true},
    ])
  })

  it('keeps only regular and evo collateral amounts', () => {
    const coins = [utxo('a', 0, 100_000_000_000n), utxo('b', 0, 400_000_000_000n), utxo('c', 0, 100_000_000_001n)]
    expect(collateralUtxos(coins).map(({txId}) => txId)).toEqual(['a', 'b'])
  })

  it('owns a node by collateral outpoint, not by collateral address alone', () => {
    const ours = node('ours', {collateralTxid: 'aa', collateralVout: 1})
    const sameAddress = node('theirs', {collateralTxid: 'aa', collateralVout: 2})
    const owned = ownedMasternodes([ours, sameAddress], none, [], [utxo('aa', 1, 100_000_000_000n)])
    expect(owned.map(({proTxHash}) => proTxHash)).toEqual(['ours'])
    expect(owned[0]).toMatchObject({ownerKeyIndex: null, votingKeyIndex: null, operatorKeyIndex: null, importedRoles: []})
  })

  it('records each matched key index once per node and drops unmatched nodes', () => {
    const matches = {owner: new Map([['a', 2]]), voting: new Map([['a', 4]]), operator: new Map(), collateral: new Map()}
    const owned = ownedMasternodes([node('a'), node('a'), node('b')], matches, [], [])
    expect(owned).toHaveLength(1)
    expect(owned[0]).toMatchObject({proTxHash: 'a', ownerKeyIndex: 2, votingKeyIndex: 4, operatorKeyIndex: null})
  })

  it('owns a node by a collateral-chain address the wallet holds no coin of', () => {
    const owned = ownedMasternodes([node('a'), node('b')], {...none, collateral: new Map([['a', 0]])}, [], [])
    expect(owned.map(({proTxHash}) => proTxHash)).toEqual(['a'])
  })

  it('owns a node by an imported key, in either operator encoding, only in that role', () => {
    const owned = ownedMasternodes([
      node('a', {votingAddress: 'Ximported'}),
      node('b', {operatorPublicKey: OPERATOR_0_LEGACY}),
      node('c', {ownerAddress: 'Xother'}),
    ], none, [
      {role: 'voting', publicKey: 'Ximported'},
      {role: 'owner', publicKey: OPERATOR_0},
      {role: 'operator', publicKey: OPERATOR_0},
    ], [])
    expect(owned.map(({proTxHash, importedRoles}) => [proTxHash, importedRoles])).toEqual([['a', ['voting']], ['b', ['operator']]])
  })

  it('names a stored collateral by the address the list gives that outpoint', () => {
    const [listed] = ownedMasternodes([node('a', {collateralAddress: 'Xheld'})], {...none, owner: new Map([['a', 0]])}, [], [])
    const stored = [
      {proTxHash: 'a', txid: 'c'.repeat(64), vout: 0, followed: true},
      {proTxHash: 'b', txid: 'c'.repeat(64), vout: 1, followed: false},
    ]
    expect(ownedCollaterals(stored, [listed])).toEqual([
      {proTxHash: 'a', txid: 'c'.repeat(64), vout: 0, address: 'Xheld'},
      {proTxHash: 'b', txid: 'c'.repeat(64), vout: 1, address: null},
    ])
  })
})

describe('existingMasternodes', () => {
  const owned = (proTxHash: string): Masternode =>
    ({...node(proTxHash), ownerKeyIndex: 0, votingKeyIndex: null, operatorKeyIndex: null, importedRoles: []})
  const firstSeen = new Map([['aa', 100], ['bb', 100]])
  const listed = (askedAt: number, ...proTxHashes: string[]) => ({proTxHashes: new Set(proTxHashes), askedAt})

  it('drops a node a list asked for after it was first seen does not carry', () => {
    const {existing, unsettled} = existingMasternodes([owned('aa'), owned('bb')], listed(200, 'aa'), firstSeen)
    expect(existing.map(({proTxHash}) => proTxHash)).toEqual(['aa'])
    expect(unsettled).toBe(false)
  })

  it('keeps a node missing from an older list, and asks for a newer one', () => {
    const {existing, unsettled} = existingMasternodes([owned('aa'), owned('bb')], listed(50, 'aa'), firstSeen)
    expect(existing.map(({proTxHash}) => proTxHash)).toEqual(['aa', 'bb'])
    expect(unsettled).toBe(true)
  })

  it('keeps every node until any list has arrived', () => {
    const {existing, unsettled} = existingMasternodes([owned('aa')], null, firstSeen)
    expect(existing).toHaveLength(1)
    expect(unsettled).toBe(true)
  })

  it('is settled when every node is listed', () => {
    expect(existingMasternodes([owned('aa')], listed(50, 'aa'), firstSeen).unsettled).toBe(false)
  })
})
