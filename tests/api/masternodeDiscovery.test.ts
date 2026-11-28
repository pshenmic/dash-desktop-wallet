import {beforeEach, describe, expect, it, vi} from 'vitest'
import {PrivateKey, Script} from 'dash-core-sdk'
import {MasternodeDAO} from '../../src/main/src/database/MasternodeDAO'
import {MasternodeIdentityDAO} from '../../src/main/src/database/MasternodeIdentityDAO'
import {Preferences} from '../../src/main/src/preferences'
import {WalletProviderFactory} from '../../src/main/src/providers/WalletProviderFactory'
import {CoreTransactionService} from '../../src/main/src/services/core/CoreTransactionService'
import {MasternodeService} from '../../src/main/src/services/core/MasternodeService'
import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {ListedMasternodes, Masternode, MasternodeKeyFilter, MasternodeKeys, NetworkMasternode} from '../../src/main/src/types/Masternode'
import {UTXO} from '../../src/main/src/types/UTXO'
import {masternodeKeyDeriver} from '../../src/main/src/utils/masternodeKeys'
import {decryptImportedKey} from '../../src/main/src/utils/importedKeyEncryption'
import {withUnlockedWallet} from '../../src/main/src/utils/walletSeed'
import {masternodeIdentityIds} from '../../src/main/src/utils/masternodeIdentities'
import {nodeKeyValues} from '../../src/main/src/utils/masternodes'
import {Harness, harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

function node(proTxHash: string, fields: Partial<NetworkMasternode> = {}): NetworkMasternode {
  return {
    proTxHash, type: 'Regular', status: 'ENABLED', posePenaltyScore: 0,
    collateralTxid: proTxHash.repeat(64).slice(0, 64), collateralVout: 0, collateralAddress: 'Xnobody',
    serviceAddress: '1.2.3.4:9999', payeeAddress: 'Xpayee', ownerAddress: 'Xnobody', votingAddress: 'Xnobody',
    operatorPublicKey: 'ff'.repeat(48), platformNodeId: null, platformP2PPort: null, platformHttpPort: null,
    lastPaidBlock: 0, lastPaidTime: 0, registeredHeight: null, isShared: false, shares: [], ...fields,
  }
}

// Each watchMasternodes call, as [owned, fresh] proTxHashes.
let watched: string[][][] = []

// A masternode list answering the same OR-of-values search the Dashscan filters run.
// `follows` is a source that rescans a fresh node from its registration (p2p),
// rather than reading payouts live (rpc).
function source(list: NetworkMasternode[] | null | Error, utxos: UTXO[] = [], follows = true): WalletProviderFactory {
  const provider = {
    getWalletUtxos: async () => utxos,
    getMasternodes: async (filter: MasternodeKeyFilter, values: string[]) => {
      if (list instanceof Error) throw list
      return list?.filter(entry => nodeKeyValues(filter, entry).some(key => values.includes(key))) ?? null
    },
    watchMasternodes: async (owned: Masternode[], fresh: Masternode[]) => {
      watched.push([owned.map(({proTxHash}) => proTxHash), fresh.map(({proTxHash}) => proTxHash)])
      return follows ? fresh.map(({proTxHash}) => proTxHash) : []
    },
  }
  return {forWallet: () => provider} as unknown as WalletProviderFactory
}

describe('MasternodeService.discover', () => {
  let wired: Harness
  let walletId: string
  let keys: MasternodeKeys
  let current: WalletProviderFactory
  let providers: WalletProviderFactory
  let masternodes: MasternodeService
  let masternodeIdentities: MasternodeIdentityDAO
  // The lock pool's list; null until one arrives.
  let network: ListedMasternodes | null
  let refreshes: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    wired = await harness()
    walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'mainnet', PASSWORD)
    keys = (await wired.masternodeKeyDAO.getKeys(walletId))!
    providers = {forWallet: (...args) => current.forWallet(...args)} as WalletProviderFactory
    network = null
    refreshes = vi.fn()
    masternodes = newService()
    masternodeIdentities = new MasternodeIdentityDAO(wired.knex)
    watched = []
  })

  // A service that shares the database but none of the previous run's memory.
  function newService(): MasternodeService {
    const walletSync = {getListedMasternodes: () => network, refreshListedMasternodes: refreshes} as unknown as WalletSyncService
    return new MasternodeService(
      wired.walletDAO, wired.masternodeKeyDAO, new MasternodeDAO(wired.knex), new MasternodeIdentityDAO(wired.knex), providers,
      wired.addressDAO, new CoreTransactionService(), walletSync, Preferences.default(),
    )
  }

  const key = (chain: MasternodeKeyFilter, index: number): string =>
    masternodeKeyDeriver(keys, 'mainnet', chain).derive(index).address

  async function discover(sourceProviders: WalletProviderFactory): Promise<void> {
    current = sourceProviders
    await masternodes.discover(walletId)
  }

  async function owned(): Promise<Masternode[]> {
    return (await masternodes.getMasternodes(walletId))!
  }

  async function listed(): Promise<string[]> {
    return (await owned()).map(({proTxHash}) => proTxHash).sort()
  }

  async function storedCollaterals(): Promise<string[]> {
    const rows = await wired.knex('masternodes').where('wallet_id', walletId).orderBy('pro_tx_hash')
    return rows.map(row => `${row.pro_tx_hash}:${row.collateral_txid.slice(0, 2)}:${row.collateral_vout}`)
  }

  it('walks each key chain past the first window and stops at the gap', async () => {
    // 55 is past the first window (gapLimit 50) so the walk must widen to find
    // it; 120 is past the gap frontier (55 + 50) the walk stops at.
    await discover(source([
      node('a', {ownerAddress: key('owner', 3)}),
      node('b', {ownerAddress: key('owner', 55)}),
      node('c', {ownerAddress: key('owner', 120)}),
      node('d', {votingAddress: key('voting', 1)}),
    ]))

    expect((await owned()).map(({proTxHash, ownerKeyIndex, votingKeyIndex}) => [proTxHash, ownerKeyIndex, votingKeyIndex]))
      .toEqual([['a', 3, null], ['b', 55, null], ['d', null, 1]])
  })

  it('owns a node by a legacy-encoded operator key or by our collateral outpoint', async () => {
    const legacy = `0${key('operator', 0).slice(1)}`
    const collateral: UTXO = {
      address: 'Xours', satoshis: 400_000_000_000n, script: new Script(), txId: 'e'.repeat(64), vOut: 0,
      height: 1, timestamp: null, confirmations: 1, isLocked: false,
    }
    await discover(source([
      node('a', {operatorPublicKey: legacy}),
      node('e', {type: 'Evo', collateralAddress: 'Xours'}),
    ], [collateral]))

    expect((await owned()).find(({proTxHash}) => proTxHash === 'a')?.operatorKeyIndex).toBe(0)
    expect(await storedCollaterals()).toEqual(['a:aa:0', 'e:ee:0'])
  })

  it('stores the owner and voter identities Platform creates for a discovered evonode', async () => {
    const proTxHash = 'ab'.repeat(32)
    const votingAddress = key('voting', 0)
    await discover(source([node(proTxHash, {type: 'Evo', votingAddress, ownerAddress: key('owner', 0)})]))

    expect(await masternodeIdentities.getByWalletId(walletId)).toEqual(
      masternodeIdentityIds(proTxHash, votingAddress).map(({role, identifier}) => ({walletId, proTxHash, role, identifier})),
    )
  })

  it('stores no identities for a discovered regular node', async () => {
    await discover(source([node('cd'.repeat(32), {ownerAddress: key('owner', 0)})]))
    expect(await masternodeIdentities.getByWalletId(walletId)).toEqual([])
  })

  it('drops the identities of a node the wallet no longer owns', async () => {
    const proTxHash = 'ab'.repeat(32)
    await discover(source([node(proTxHash, {type: 'Evo', votingAddress: key('voting', 0), ownerAddress: key('owner', 0)})]))
    expect(await masternodeIdentities.getByWalletId(walletId)).toHaveLength(2)

    await discover(source([]))

    expect(await masternodeIdentities.getByWalletId(walletId)).toEqual([])
  })

  // DashSync pays a collateral its ProRegTx creates to the reserved 3'/0' chain.
  it('owns a node whose collateral address is on the collateral chain', async () => {
    await discover(source([
      node('h', {collateralAddress: key('collateral', 3)}),
      node('i', {collateralAddress: 'Xnobody'}),
    ]))

    expect(await listed()).toEqual(['h'])
    expect(await storedCollaterals()).toEqual(['h:hh:0'])
  })

  it('answers the stored collaterals, with an address only while the list carries it', async () => {
    const address = key('collateral', 0)
    await discover(source([node('h', {collateralAddress: address})]))
    expect(await masternodes.getCollaterals(walletId)).toEqual([{proTxHash: 'h', txid: 'h'.repeat(64), vout: 0, address}])

    await discover(source([node('h', {collateralAddress: null, collateralTxid: null, collateralVout: null, ownerAddress: key('owner', 0)})]))
    expect(await masternodes.getCollaterals(walletId)).toEqual([{proTxHash: 'h', txid: 'h'.repeat(64), vout: 0, address: null}])
  })

  it('replaces what a previous run found', async () => {
    await discover(source([node('a', {ownerAddress: key('owner', 0)})]))
    await discover(source([node('b', {ownerAddress: key('owner', 0)})]))

    expect(await listed()).toEqual(['b'])
    expect(await storedCollaterals()).toEqual(['b:bb:0'])
  })

  // Dashscan keeps the row of a node whose collateral was spent, frozen in its last state.
  it('drops a node the network list no longer carries, once that list postdates it', async () => {
    const gone = node('a', {ownerAddress: key('owner', 0), status: 'POSE_BANNED'})
    await discover(source([gone, node('b', {ownerAddress: key('owner', 1)})]))
    expect(await listed()).toEqual(['a', 'b'])
    expect(refreshes).toHaveBeenCalled()

    network = {proTxHashes: new Set(['b']), askedAt: Date.now() + 1, v24Active: false}
    await discover(source([gone, node('b', {ownerAddress: key('owner', 1)})]))
    expect(await listed()).toEqual(['b'])
    expect(await storedCollaterals()).toEqual(['b:bb:0'])
  })

  it('keeps a node an older list could not know of, and asks for a newer one', async () => {
    network = {proTxHashes: new Set(), askedAt: 0, v24Active: false}
    await discover(source([node('a', {ownerAddress: key('owner', 0)})]))
    expect(await listed()).toEqual(['a'])
    expect(refreshes).toHaveBeenCalled()
  })

  it('keeps what it knew when the source has no list or fails', async () => {
    await discover(source([node('a', {ownerAddress: key('owner', 0)})]))

    await discover(source(null))
    await expect(discover(source(new Error('offline')))).rejects.toThrow('offline')

    expect(await listed()).toEqual(['a'])
    expect(await storedCollaterals()).toEqual(['a:aa:0'])
  })

  it('answers null, not an empty list, before the first run', async () => {
    expect(await masternodes.getMasternodes(walletId)).toBeNull()
    expect(await masternodes.getMasternodesForDisplay(walletId)).toBeNull()
  })

  it('shows the nodes a previous run stored, unknown, until this run has a list', async () => {
    await discover(source([node('a', {ownerAddress: key('owner', 0)})]))

    const restarted = newService()
    expect((await restarted.getMasternodesForDisplay(walletId))!.map(
      ({proTxHash, type, status, collateralTxid, collateralVout, serviceAddress, importedRoles}) =>
        [proTxHash, type, status, collateralTxid, collateralVout, serviceAddress, importedRoles]))
      .toEqual([['a', 'Unknown', 'Unknown', 'a'.repeat(64), 0, null, []]])
    expect(await restarted.getMasternodes(walletId)).toBeNull()

    await restarted.discover(walletId)
    expect((await restarted.getMasternodesForDisplay(walletId))!.map(({proTxHash, status}) => [proTxHash, status]))
      .toEqual([['a', 'ENABLED']])
  })

  it('finds a node by an imported key, keeps a key no node carries yet, and forgets a removed one', async () => {
    const voting = PrivateKey.fromBytes(new Uint8Array(32).fill(7), 'mainnet')
    const unregistered = PrivateKey.fromBytes(new Uint8Array(32).fill(8), 'mainnet')
    current = source([node('f', {votingAddress: voting.getAddress()})])

    const found = await masternodes.importKey(walletId, 'voting', ` ${voting.toWIF()}\n`, PASSWORD)
    expect(found!.map(({proTxHash, importedRoles}) => [proTxHash, importedRoles])).toEqual([['f', ['voting']]])
    expect(await masternodes.importKey(walletId, 'owner', unregistered.toWIF(), PASSWORD)).toEqual([])
    expect(await masternodes.getImportedKeys(walletId)).toHaveLength(2)
    expect(await masternodes.getImportedKeys(walletId)).toEqual(expect.arrayContaining([
      {role: 'voting', publicKey: voting.getAddress(), hasPrivateKey: true},
      {role: 'owner', publicKey: unregistered.getAddress(), hasPrivateKey: true},
    ]))
    const secret = await masternodes.getImportedKeySecret(walletId, 'voting', voting.getAddress())
    expect(secret).not.toBeNull()
    expect(await withUnlockedWallet(wired.walletDAO, walletId, PASSWORD, async ({seed}) =>
      decryptImportedKey(secret!, seed))).toBe(voting.toWIF())

    await masternodes.removeKey(walletId, {role: 'voting', publicKey: voting.getAddress(), hasPrivateKey: true})
    expect(await listed()).toEqual([])
    expect(await masternodes.getImportedKeys(walletId)).toEqual([{role: 'owner', publicKey: unregistered.getAddress(), hasPrivateKey: true}])
  })

  // Not an empty answer: p2p before its first proven list has searched nothing.
  it('answers an import with null while the source has no list, and keeps the key', async () => {
    current = source(null)
    const voting = PrivateKey.fromBytes(new Uint8Array(32).fill(7), 'mainnet')

    expect(await masternodes.importKey(walletId, 'voting', voting.toWIF(), PASSWORD)).toBeNull()
    expect(await masternodes.getImportedKeys(walletId)).toHaveLength(1)
  })

  // The check behind an import preview: the same search, storing nothing.
  it('finds a node by a pasted key without importing it', async () => {
    const voting = PrivateKey.fromBytes(new Uint8Array(32).fill(7), 'mainnet')
    current = source([node('f', {votingAddress: voting.getAddress(), status: 'POSE_BANNED'})])

    const found = await masternodes.checkKey(walletId, 'voting', ` ${voting.toWIF()}\n`)

    expect(found!.map(({proTxHash, status}) => [proTxHash, status])).toEqual([['f', 'POSE_BANNED']])
    expect(await masternodes.getImportedKeys(walletId)).toEqual([])
  })

  it('finds a shared node by a pasted share owner key', async () => {
    const owner = PrivateKey.fromBytes(new Uint8Array(32).fill(9), 'mainnet')
    current = source([node('s', {
      ownerAddress: null,
      isShared: true,
      shares: [{ownerAddress: owner.getAddress(), amountDuffs: 50000000000n}],
    })])

    const found = await masternodes.checkKey(walletId, 'owner', owner.toWIF())

    expect(found!.map(({proTxHash, isShared}) => [proTxHash, isShared])).toEqual([['s', true]])
    expect(await masternodes.getImportedKeys(walletId)).toEqual([])
  })

  it('answers a check with null while the source has no list', async () => {
    current = source(null)
    const voting = PrivateKey.fromBytes(new Uint8Array(32).fill(7), 'mainnet')

    expect(await masternodes.checkKey(walletId, 'voting', voting.toWIF())).toBeNull()
  })

  it('refuses a check of a key that does not parse, and stores nothing', async () => {
    current = source([])
    await expect(masternodes.checkKey(walletId, 'operator', 'not hex')).rejects.toThrow()
    await expect(masternodes.checkKey(walletId, 'collateral' as never, 'x')).rejects.toThrow('Unknown masternode key role')
    expect(await masternodes.getImportedKeys(walletId)).toEqual([])
  })

  // A node the p2p index has not read the ProRegTx of yet has no outpoint to keep.
  it('lists a node whose collateral is not known yet without storing one', async () => {
    await discover(source([node('g', {votingAddress: key('voting', 0), collateralTxid: null, collateralVout: null})]))

    expect(await listed()).toEqual(['g'])
    expect(await storedCollaterals()).toEqual([])
  })

  // The p2p scan rewinds once per node it has not followed before, never again.
  it('marks a node fresh only until its collateral is stored', async () => {
    await discover(source([node('a', {ownerAddress: key('owner', 0)})]))
    await discover(source([node('a', {ownerAddress: key('owner', 0)}), node('b', {ownerAddress: key('owner', 1)})]))

    expect(watched).toEqual([[['a'], ['a']], [['a', 'b'], ['b']]])
  })

  // Until a node's registration is indexed the p2p list has no collateral for it,
  // and the coin stays locked meanwhile.
  it('keeps a stored collateral while the list cannot give it yet', async () => {
    await discover(source([node('a', {ownerAddress: key('owner', 0)})]))
    await discover(source([node('a', {ownerAddress: key('owner', 0), collateralTxid: null, collateralVout: null})]))

    expect(await storedCollaterals()).toEqual(['a:aa:0'])
  })

  // A node found where payouts are read live (rpc) still needs one rescan from its
  // registration once a p2p scan takes over.
  it('keeps a node fresh until a source that rescans has followed it', async () => {
    await discover(source([node('a', {ownerAddress: key('owner', 0)})], [], false))
    await discover(source([node('a', {ownerAddress: key('owner', 0)})], [], false))
    await discover(source([node('a', {ownerAddress: key('owner', 0)})]))
    await discover(source([node('a', {ownerAddress: key('owner', 0)})]))

    expect(watched.map(([, fresh]) => fresh)).toEqual([['a'], ['a'], ['a'], []])
  })

  it('discovers a shared node by a share owner key on the owner chain', async () => {
    const shareOwner = key('owner', 2)
    await discover(source([node('s', {ownerAddress: null, isShared: true, collateralVout: 3, collateralAddress: null, shares: [
      {ownerAddress: shareOwner, amountDuffs: 20000000000n},
      {ownerAddress: 'Xother', amountDuffs: 80000000000n},
    ]})]))
    const [found] = await owned()
    expect(found).toMatchObject({proTxHash: 's', ownerKeyIndex: 2, isShared: true})
    expect(found.shares).toEqual([
      {ownerAddress: shareOwner, amountDuffs: 20000000000n, keyIndex: 2, imported: false, canSign: true},
      {ownerAddress: 'Xother', amountDuffs: 80000000000n, keyIndex: null, imported: false, canSign: false},
    ])
    expect(await storedCollaterals()).toEqual(['s:ss:3'])
  })

  it('widens the owner walk past a key held as a share', async () => {
    await discover(source([
      node('t', {ownerAddress: null, isShared: true, shares: [
        {ownerAddress: key('owner', 0), amountDuffs: 20000000000n},
        {ownerAddress: 'Xother', amountDuffs: 80000000000n},
      ]}),
      node('s', {ownerAddress: null, isShared: true, shares: [
        {ownerAddress: key('owner', 55), amountDuffs: 20000000000n},
        {ownerAddress: 'Xother', amountDuffs: 80000000000n},
      ]}),
    ]))
    expect((await owned()).map(({proTxHash, ownerKeyIndex}) => [proTxHash, ownerKeyIndex])).toEqual([['t', 0], ['s', 55]])
  })

  it('lists a shared node held by the creator\'s voting key with no share of ours', async () => {
    await discover(source([node('s', {votingAddress: key('voting', 0), ownerAddress: null, isShared: true, shares: [
      {ownerAddress: 'Xother1', amountDuffs: 60000000000n},
      {ownerAddress: 'Xother2', amountDuffs: 40000000000n},
    ]})]))
    const [found] = await owned()
    expect(found).toMatchObject({proTxHash: 's', ownerKeyIndex: null, votingKeyIndex: 0})
    expect(found.shares!.map(({keyIndex, imported}) => [keyIndex, imported])).toEqual([[null, false], [null, false]])
  })

  it('finds a shared node by an imported share owner key', async () => {
    const owner = PrivateKey.fromBytes(new Uint8Array(32).fill(9), 'mainnet')
    current = source([node('s', {ownerAddress: null, isShared: true, shares: [
      {ownerAddress: owner.getAddress(), amountDuffs: 20000000000n},
      {ownerAddress: 'Xother', amountDuffs: 80000000000n},
    ]})])
    const found = await masternodes.importKey(walletId, 'owner', owner.toWIF(), PASSWORD)
    expect(found!.map(({proTxHash, importedRoles}) => [proTxHash, importedRoles])).toEqual([['s', ['owner']]])
    expect(found![0].shares!.map(({keyIndex, imported}) => [keyIndex, imported])).toEqual([[null, true], [null, false]])
  })

  it('finds a shared node by an imported voting key', async () => {
    const voting = PrivateKey.fromBytes(new Uint8Array(32).fill(11), 'mainnet')
    current = source([node('s', {
      votingAddress: voting.getAddress(),
      ownerAddress: null,
      isShared: true,
      shares: [
        {ownerAddress: 'Xother', amountDuffs: 50000000000n},
        {ownerAddress: 'Xanother', amountDuffs: 50000000000n},
      ],
    })])

    const found = await masternodes.importKey(walletId, 'voting', voting.toWIF(), PASSWORD)

    expect(found!.map(({proTxHash, importedRoles, isShared}) => [proTxHash, importedRoles, isShared])).toEqual([['s', ['voting'], true]])
  })

  it('refuses a key that does not parse, and stores nothing for it', async () => {
    current = source([])
    await expect(masternodes.importKey(walletId, 'operator', 'not hex')).rejects.toThrow()
    expect(await masternodes.getImportedKeys(walletId)).toEqual([])
  })

  // A tick, a new list and a key change can all ask at once; each run is a set
  // of list requests, so the second ask joins the first.
  it('answers concurrent discovery asks from one run', async () => {
    current = source([node('a', {ownerAddress: key('owner', 0)})])

    await Promise.all([
      masternodes.discover(walletId),
      masternodes.discover(walletId),
      masternodes.discover(walletId),
    ])

    expect(watched).toHaveLength(1)
    expect(await listed()).toEqual(['a'])
  })

  it('searches a key imported while a run is in flight in the pass behind it', async () => {
    const voting = PrivateKey.fromBytes(new Uint8Array(32).fill(7), 'mainnet')
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const inner = source([node('f', {votingAddress: voting.getAddress()})]).forWallet('w', 'mainnet')
    current = {forWallet: () => ({...inner, getWalletUtxos: async () => { await gate; return [] }})} as unknown as WalletProviderFactory

    const first = masternodes.discover(walletId)
    const importing = masternodes.importKey(walletId, 'voting', voting.toWIF(), PASSWORD)
    release()

    await first
    expect((await importing)!.map(({proTxHash, importedRoles}) => [proTxHash, importedRoles])).toEqual([['f', ['voting']]])
    expect(watched).toHaveLength(2)
  })

  // The panel reads this on open; a run already under way answers shortly.
  it('answers an unmatched-keys read with no list while a run is in flight', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const inner = source([node('a', {ownerAddress: key('owner', 0)})]).forWallet('w', 'mainnet')
    current = {forWallet: () => ({...inner, getWalletUtxos: async () => { await gate; return [] }})} as unknown as WalletProviderFactory

    const first = masternodes.discover(walletId)
    expect(await masternodes.getUnmatchedImportedKeys(walletId)).toBeNull()

    release()
    await first
    expect(await masternodes.getUnmatchedImportedKeys(walletId)).toEqual([])
  })
})
