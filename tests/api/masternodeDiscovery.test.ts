import {beforeEach, describe, expect, it, vi} from 'vitest'
import {PrivateKey, Script} from 'dash-core-sdk'
import {MasternodeDAO} from '../../src/main/src/database/MasternodeDAO'
import {Preferences} from '../../src/main/src/preferences'
import {WalletProviderFactory} from '../../src/main/src/providers/WalletProviderFactory'
import {CoreTransactionService} from '../../src/main/src/services/core/CoreTransactionService'
import {MasternodeService} from '../../src/main/src/services/core/MasternodeService'
import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {ListedMasternodes, Masternode, MasternodeKeyFilter, MasternodeKeys, NetworkMasternode} from '../../src/main/src/types/Masternode'
import {UTXO} from '../../src/main/src/types/UTXO'
import {masternodeKeyDeriver} from '../../src/main/src/utils/masternodeKeys'
import {nodeKey} from '../../src/main/src/utils/masternodes'
import {Harness, harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

function node(proTxHash: string, fields: Partial<NetworkMasternode> = {}): NetworkMasternode {
  return {
    proTxHash, type: 'Regular', status: 'ENABLED', posePenaltyScore: 0,
    collateralTxid: proTxHash.repeat(64).slice(0, 64), collateralVout: 0, collateralAddress: 'Xnobody',
    serviceAddress: '1.2.3.4:9999', payeeAddress: 'Xpayee', ownerAddress: 'Xnobody', votingAddress: 'Xnobody',
    operatorPublicKey: 'ff'.repeat(48), platformNodeId: null, platformP2PPort: null, platformHttpPort: null,
    lastPaidBlock: 0, lastPaidTime: 0, registeredHeight: null, ...fields,
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
      return list?.filter(entry => values.includes(nodeKey(filter, entry) ?? '')) ?? null
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
  let masternodes: MasternodeService
  // The lock pool's list; null until one arrives.
  let network: ListedMasternodes | null
  let refreshes: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    wired = await harness()
    walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'mainnet', PASSWORD)
    keys = (await wired.masternodeKeyDAO.getKeys(walletId))!
    const providers = {forWallet: (...args) => current.forWallet(...args)} as WalletProviderFactory
    network = null
    refreshes = vi.fn()
    const walletSync = {getListedMasternodes: () => network, refreshListedMasternodes: refreshes} as unknown as WalletSyncService
    masternodes = new MasternodeService(
      wired.walletDAO, wired.masternodeKeyDAO, new MasternodeDAO(wired.knex), providers,
      wired.addressDAO, new CoreTransactionService(), walletSync, Preferences.default(),
    )
    watched = []
  })

  const key = (chain: MasternodeKeyFilter, index: number): string =>
    masternodeKeyDeriver(keys, 'mainnet', chain).derive(index).address

  async function discover(providers: WalletProviderFactory): Promise<void> {
    current = providers
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
  })

  it('finds a node by an imported key, keeps a key no node carries yet, and forgets a removed one', async () => {
    const voting = PrivateKey.fromBytes(new Uint8Array(32).fill(7), 'mainnet')
    const unregistered = PrivateKey.fromBytes(new Uint8Array(32).fill(8), 'mainnet')
    current = source([node('f', {votingAddress: voting.getAddress()})])

    const found = await masternodes.importKey(walletId, 'voting', ` ${voting.toWIF()}\n`)
    expect(found!.map(({proTxHash, importedRoles}) => [proTxHash, importedRoles])).toEqual([['f', ['voting']]])
    expect(await masternodes.importKey(walletId, 'owner', unregistered.toWIF())).toEqual([])
    expect(await masternodes.getImportedKeys(walletId)).toHaveLength(2)

    await masternodes.removeKey(walletId, {role: 'voting', publicKey: voting.getAddress()})
    expect(await listed()).toEqual([])
    expect(await masternodes.getImportedKeys(walletId)).toEqual([{role: 'owner', publicKey: unregistered.getAddress()}])
  })

  // Not an empty answer: p2p before its first proven list has searched nothing.
  it('answers an import with null while the source has no list, and keeps the key', async () => {
    current = source(null)
    const voting = PrivateKey.fromBytes(new Uint8Array(32).fill(7), 'mainnet')

    expect(await masternodes.importKey(walletId, 'voting', voting.toWIF())).toBeNull()
    expect(await masternodes.getImportedKeys(walletId)).toHaveLength(1)
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

  it('refuses a key that does not parse, and stores nothing for it', async () => {
    current = source([])
    await expect(masternodes.importKey(walletId, 'operator', 'not hex')).rejects.toThrow()
    expect(await masternodes.getImportedKeys(walletId)).toEqual([])
  })
})
