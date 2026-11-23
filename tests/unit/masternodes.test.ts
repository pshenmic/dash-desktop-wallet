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
  unusedKeyIndex,
  masternodeFilterValues,
  matchMasternodeKeys,
  networkMasternode,
  ownedCollaterals,
  ownedMasternodes,
  ownerNode,
  operatedNode,
  requireCollateral,
  requirePayout,
  revocableNode,
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
    lastPaidBlock: 0, lastPaidTime: 0, registeredHeight: null, isShared: false, shares: [], ...fields,
  }
}

function utxo(txId: string, vOut: number, satoshis: bigint): UTXO {
  return {address: 'Xcollateral', satoshis, script: new Script(), txId, vOut, height: 1, timestamp: null, confirmations: 1, isLocked: false}
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
      isShared: false, shares: null,
    })
  })

  it('reads a comma-joined owner list as shared, without amounts', () => {
    const row: DashscanMasternode = {
      proTxHash: 'p', address: '[::]:0', payee: 'ypayee1, ypayee2', status: 'POSE_BANNED', type: 'Regular', posPenaltyScore: 0,
      lastPaidTime: '1970-01-01T00:00:00.000Z', lastPaidBlock: 0, ownerAddress: 'yowner1, yowner2', votingAddress: 'yvoting',
      collateralAddress: 'UNKNOWN', pubKeyOperator: 'A73D', outpoint: `${'ab'.repeat(32)}-3`,
      platformNodeId: null, platformP2PPort: null, platformHTTPPort: null,
    }
    expect(networkMasternode(row)).toMatchObject({isShared: true, ownerAddress: null, payeeAddress: null, shares: null})
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

  it('matches an owner key held as a share of a shared registration', () => {
    const owner = masternodeKeyDeriver(keys, 'mainnet', 'owner').derive(2)
    const shared = node('a', {ownerAddress: null, isShared: true, shares: [
      {ownerAddress: owner.address, amountDuffs: 20000000000n},
      {ownerAddress: 'Xother', amountDuffs: 80000000000n},
    ]})
    expect([...matchMasternodeKeys('owner', [owner], [shared])]).toEqual([['a', 2]])
  })
})

describe('ownedMasternodes', () => {
  const none = {owner: new Map(), voting: new Map(), operator: new Map(), collateral: new Map()}

  it('flags a collateral by its outpoint, not by its amount or address', () => {
    const coin = (txid: string, vout: number) =>
      ({txid, vout, satoshis: 100_000_000_000n, address: 'Xcollateral', height: 1, timestamp: null, confirmations: 1, isLocked: false})
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
      {...node('a', {collateralTxid: null, collateralVout: null}), ownerKeyIndex: 0, votingKeyIndex: null, operatorKeyIndex: null, importedRoles: [], importedSigningRoles: [], shares: []},
      {...node('b'), ownerKeyIndex: 0, votingKeyIndex: null, operatorKeyIndex: null, importedRoles: [], importedSigningRoles: [], shares: []},
      {...node('c', {collateralTxid: null, collateralVout: null}), ownerKeyIndex: 1, votingKeyIndex: null, operatorKeyIndex: null, importedRoles: [], importedSigningRoles: [], shares: []},
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
    const owned = ownedMasternodes([ours, sameAddress], none, [], [utxo('aa', 1, 100_000_000_000n)], new Map())
    expect(owned.map(({proTxHash}) => proTxHash)).toEqual(['ours'])
    expect(owned[0]).toMatchObject({ownerKeyIndex: null, votingKeyIndex: null, operatorKeyIndex: null, importedRoles: []})
  })

  it('records each matched key index once per node and drops unmatched nodes', () => {
    const matches = {owner: new Map([['a', 2]]), voting: new Map([['a', 4]]), operator: new Map(), collateral: new Map()}
    const owned = ownedMasternodes([node('a'), node('a'), node('b')], matches, [], [], new Map())
    expect(owned).toHaveLength(1)
    expect(owned[0]).toMatchObject({proTxHash: 'a', ownerKeyIndex: 2, votingKeyIndex: 4, operatorKeyIndex: null})
  })

  it('owns a node by a collateral-chain address the wallet holds no coin of', () => {
    const owned = ownedMasternodes([node('a'), node('b')], {...none, collateral: new Map([['a', 0]])}, [], [], new Map())
    expect(owned.map(({proTxHash}) => proTxHash)).toEqual(['a'])
  })

  it('owns a node by an imported key, in either operator encoding, only in that role', () => {
    const owned = ownedMasternodes([
      node('a', {votingAddress: 'Ximported'}),
      node('b', {operatorPublicKey: OPERATOR_0_LEGACY}),
      node('c', {ownerAddress: 'Xother'}),
    ], none, [
      {role: 'voting', publicKey: 'Ximported', hasPrivateKey: true},
      {role: 'owner', publicKey: OPERATOR_0, hasPrivateKey: false},
      {role: 'operator', publicKey: OPERATOR_0, hasPrivateKey: false},
    ], [], new Map())
    expect(owned.map(({proTxHash, importedRoles, importedSigningRoles}) => [proTxHash, importedRoles, importedSigningRoles]))
      .toEqual([['a', ['voting'], ['voting']], ['b', ['operator'], []]])
  })

  it('marks every share our keys hold, even two under different keys', () => {
    const shared = node('a', {ownerAddress: null, isShared: true, shares: [
      {ownerAddress: 'Xfirst', amountDuffs: 20000000000n},
      {ownerAddress: 'Xsecond', amountDuffs: 30000000000n},
      {ownerAddress: 'Xother', amountDuffs: 50000000000n},
    ]})
    const owned = ownedMasternodes([shared], {...none, owner: new Map([['a', 1]])}, [], [], new Map([['Xfirst', 1], ['Xsecond', 6]]))
    expect(owned[0].shares!.map(({keyIndex, canSign}) => [keyIndex, canSign])).toEqual([[1, true], [6, true], [null, false]])
  })

  it('owns a shared node by an imported share owner key, and marks that share', () => {
    const shared = node('a', {ownerAddress: null, isShared: true, shares: [
      {ownerAddress: 'Ximported', amountDuffs: 30000000000n},
      {ownerAddress: 'Xother', amountDuffs: 70000000000n},
    ]})
    const owned = ownedMasternodes([shared], none, [{role: 'owner', publicKey: 'Ximported', hasPrivateKey: false}], [], new Map())
    expect(owned.map(({proTxHash, importedRoles}) => [proTxHash, importedRoles])).toEqual([['a', ['owner']]])
    expect(owned[0].shares!.map(({keyIndex, imported, canSign}) => [keyIndex, imported, canSign])).toEqual([[null, true, false], [null, false, false]])
  })

  it('lets a stored imported share owner key sign where a watch-only one cannot', () => {
    const shared = node('a', {ownerAddress: null, isShared: true, shares: [
      {ownerAddress: 'Xstored', amountDuffs: 30000000000n},
      {ownerAddress: 'Xwatch', amountDuffs: 70000000000n},
    ]})
    const owned = ownedMasternodes([shared], none, [
      {role: 'owner', publicKey: 'Xstored', hasPrivateKey: true},
      {role: 'owner', publicKey: 'Xwatch', hasPrivateKey: false},
    ], [], new Map())
    expect(owned[0].shares!.map(({canSign}) => canSign)).toEqual([true, false])
  })

  it('names a stored collateral by the address the list gives that outpoint', () => {
    const [listed] = ownedMasternodes([node('a', {collateralAddress: 'Xheld'})], {...none, owner: new Map([['a', 0]])}, [], [], new Map())
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

describe('unusedKeyIndex', () => {
  const owned = (ownerKeyIndex: number | null, votingKeyIndex: number | null): Masternode =>
    ({...node('aa'), ownerKeyIndex, votingKeyIndex, operatorKeyIndex: null, importedRoles: [], importedSigningRoles: [], shares: []})

  it('is the lowest index of the chain no node carries', () => {
    expect(unusedKeyIndex([owned(0, null), owned(2, 0)], 'owner')).toBe(1)
    expect(unusedKeyIndex([], 'voting')).toBe(0)
  })

  it('skips an index any of several chains carries', () => {
    expect(unusedKeyIndex([owned(null, 0), owned(1, null)], 'owner', 'voting', 'operator')).toBe(2)
  })
})

describe('requireCollateral', () => {
  const DASH = 100_000_000n
  const coin = (satoshis: bigint, height = 10): UTXO => ({txId: 'aa'.repeat(32), vOut: 1, satoshis, height, address: 'Xcoin'}) as UTXO
  const wanted = {type: 'Regular' as const, collateral: {txid: 'aa'.repeat(32), vout: 1}}

  it('answers the confirmed coin of the type\'s exact amount', () => {
    const utxo = coin(1_000n * DASH)
    expect(requireCollateral([utxo], [], wanted)).toBe(utxo)
  })

  it('refuses a coin that is missing, unconfirmed, of another amount or already a collateral', () => {
    expect(() => requireCollateral([], [], wanted)).toThrow('not an unspent coin')
    expect(() => requireCollateral([coin(1_000n * DASH, 0)], [], wanted)).toThrow('needs a confirmation')
    expect(() => requireCollateral([coin(4_000n * DASH)], [], wanted)).toThrow('exactly 1000 DASH')
    const taken = [{proTxHash: 'bb', txid: 'aa'.repeat(32), vout: 1, followed: false}]
    expect(() => requireCollateral([coin(1_000n * DASH)], taken, wanted)).toThrow('already a masternode collateral')
  })
})

describe('requirePayout', () => {
  it('answers a payout that pays neither the owner nor the voting key', () => {
    expect(requirePayout('Xpayout', 'Xowner', 'Xvoting')).toBe('Xpayout')
  })

  it('refuses an unknown payout, and one paying the owner or voting key', () => {
    expect(() => requirePayout(null, 'Xowner', 'Xvoting')).toThrow('not known yet')
    expect(() => requirePayout('Xowner', 'Xowner', 'Xvoting')).toThrow('may not pay')
    expect(() => requirePayout('Xvoting', 'Xowner', 'Xvoting')).toThrow('may not pay')
  })
})

describe('ownerNode', () => {
  const owned = (proTxHash: string, ownerKeyIndex: number | null): Masternode =>
    ({...node(proTxHash), ownerKeyIndex, votingKeyIndex: null, operatorKeyIndex: null, importedRoles: [], importedSigningRoles: [], shares: []})

  it('answers a node whose owner key the wallet derives, and refuses any other', () => {
    expect(ownerNode([owned('aa', 3)], 'aa').ownerKeyIndex).toBe(3)
    expect(() => ownerNode([owned('aa', null)], 'aa')).toThrow('does not derive')
    expect(() => ownerNode([], 'aa')).toThrow('Not a masternode')
  })

  it('refuses a shared node, whose updates need every share owner', () => {
    const shared = {...owned('aa', 3), isShared: true, shares: [
      {ownerAddress: 'Xours', amountDuffs: 20000000000n, keyIndex: 3, imported: false, canSign: true},
      {ownerAddress: 'Xother', amountDuffs: 80000000000n, keyIndex: null, imported: false, canSign: false},
    ]}
    expect(() => ownerNode([shared], 'aa')).toThrow('every share owner')
  })
})

describe('operatedNode', () => {
  const operated = (proTxHash: string, operatorKeyIndex: number | null): Masternode =>
    ({...node(proTxHash), ownerKeyIndex: null, votingKeyIndex: null, operatorKeyIndex, importedRoles: [], importedSigningRoles: [], shares: []})
  const shared = (): Masternode => {
    const shares = [{ownerAddress: 'Xother1', amountDuffs: 60000000000n}, {ownerAddress: 'Xother2', amountDuffs: 40000000000n}]
    return {...operated('aa', 0), isShared: true, shares: shares.map(share => ({...share, keyIndex: null, imported: false, canSign: false}))}
  }

  it('answers the node whether its operator key is derived or imported', () => {
    expect(operatedNode([operated('aa', 0)], 'aa').operatorKeyIndex).toBe(0)
    expect(operatedNode([operated('bb', null)], 'bb').operatorKeyIndex).toBeNull()
    expect(operatedNode([shared()], 'aa').operatorKeyIndex).toBe(0)
  })

  it('refuses a node that is not this wallet\'s', () => {
    expect(() => operatedNode([], 'aa')).toThrow('Not a masternode')
  })
})

describe('revocableNode', () => {
  const operated = (proTxHash: string, operatorKeyIndex: number): Masternode =>
    ({...node(proTxHash), ownerKeyIndex: null, votingKeyIndex: null, operatorKeyIndex, importedRoles: [], importedSigningRoles: [], shares: []})

  it('answers a solo node', () => {
    expect(revocableNode([operated('aa', 0)], 'aa').operatorKeyIndex).toBe(0)
  })

  it('refuses a shared node, which every share owner would have to restore', () => {
    const shares = [{ownerAddress: 'Xother1', amountDuffs: 60000000000n}]
    const shared = {...operated('aa', 0), isShared: true, shares: shares.map(share => ({...share, keyIndex: null, imported: false, canSign: false}))}
    expect(() => revocableNode([shared], 'aa')).toThrow('every share owner')
  })
})

describe('existingMasternodes', () => {
  const owned = (proTxHash: string): Masternode =>
    ({...node(proTxHash), ownerKeyIndex: 0, votingKeyIndex: null, operatorKeyIndex: null, importedRoles: [], importedSigningRoles: [], shares: []})
  const firstSeen = new Map([['aa', 100], ['bb', 100]])
  const listed = (askedAt: number, ...proTxHashes: string[]) => ({proTxHashes: new Set(proTxHashes), askedAt, v24Active: false})

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
