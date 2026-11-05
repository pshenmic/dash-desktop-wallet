import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {MnListDiff, MnType, SimplifiedMNListEntry} from 'dash-core-p2p'
import {Transaction} from 'dash-core-sdk'
import {ProviderRegistry} from '../../src/main/p2p/sync/providerRegistry'
import type {ChainStore} from '../../src/main/p2p/store/ChainStore'
import type {PoolService} from '../../src/main/p2p/net/PoolService'
import type {ProviderRegistration} from '../../src/main/p2p/types/masternodeList'
import type {NetworkMasternode} from '../../src/main/src/types/Masternode'
import {displayHexToWire} from '../../src/main/p2p/utils/byteOrder'
import {hashHeaderRaw} from '../../src/main/p2p/utils/pow'

// The proof of the list is listCommitted's own test; here the list is taken as proven.
vi.mock('../../src/main/p2p/utils/masternodeList', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/main/p2p/utils/masternodeList')>(),
  listCommitted: () => true,
}))

const EVO = '8e11eb784883d3dc9d0d74a74633f067dc61c408dfdee49b8f93bb161f2916c0'
const EVO_TX = '03000100016ebca7f8c2852d1034b37fa4e464d6710dd952acad4f252752d9fb703bed2928200000006a47304402202ec687b9f4e8f8047690521d18196644b33b8310f64f854c0b05d2a2d90010380220120fefc98587fc0fe66a89727b1b9bb3880f7fd382148bd35be25e09d2287f760121020a25e4e16b91a17a5ef5627755d9cb81f1cd6d84026262f94ce0f4a4f2cb829dfeffffff01307af505000000001976a914f53e3ff160dab7ec3cc2a6b0afa6dd8d36e3879488ac00000000fd2a01020001000000593aaec65459ca9a97bd34b2657c8201ae83952d062715ba3af0d4255e54e86c2000000000000000000000000000ffff34599a304e1f0063eb51fcfd121e6c3eae23b90b26cd1100217b8160877a911d8bb7d1e75e2320e98cc3233c1f6972cb642424bfcec7c182c56d2c0ebb59e45f788f4d5dbfa2ebff3e3a0063eb51fcfd121e6c3eae23b90b26cd1100217b00001976a914c69a0bda7daaae481be8def95e5f347a1d00a4b488acddb1df193e8da1e028e7985d096ac11e8f38e5f85df16508487ff4ec434af2ae357cb7f558f264c99460327d48066e197c70576d308fa305412084722e83388b959b26cca1ef4aef3106b849f91e1d345c620cafece7b97426164dce31a56ca0736608b0b8ba6969a6c91e763d13db90bd9b213f7bd2a36f8ea5'
const REGISTERED = 850334
const CONFIRMED_HASH = 'ab'.repeat(32)
const TIP = 900000

const headerAt = (height: number): Uint8Array => new Uint8Array(80).fill(height % 251)

class FakeStore {
  readonly network = 'testnet' as const
  registrations = new Map<string, ProviderRegistration>()
  getHeaderByHeight = async (height: number): Promise<Uint8Array | null> => headerAt(height)
  // Testnet confirms one block above the registration.
  findHeights = async (hashes: Set<string>): Promise<Map<string, number>> => {
    const wire = Buffer.from(displayHexToWire(CONFIRMED_HASH)).toString('hex')
    return new Map(hashes.has(wire) ? [[wire, REGISTERED + 1]] : [])
  }
  getRegistrations = async (): Promise<Map<string, ProviderRegistration>> => new Map(this.registrations)
  writeRegistrations = async (put: Map<string, ProviderRegistration>, del: string[] = []): Promise<void> => {
    put.forEach((registration, proTxHash) => this.registrations.set(proTxHash, registration))
    for (const proTxHash of del) this.registrations.delete(proTxHash)
  }
}

const peer = {host: 'peer', port: 19999, sent: [] as unknown[], sendMessage(msg: unknown) { this.sent.push(msg) }}
const pool = {
  readyPeers: new Set([peer]),
  messages: {GetData: (items: unknown) => ({command: 'getdata', items})},
}

const entry = (proRegTxHash: string, confirmedHash: string): SimplifiedMNListEntry => ({
  nVersion: 2, proRegTxHash, confirmedHash, service: new Uint8Array(18),
  address: {networkId: 1, addr: new Uint8Array(4), host: '52.89.154.48', port: 19999},
  pubKeyOperator: '81'.repeat(48), keyIDVoting: '00'.repeat(20), isValid: true, nType: MnType.Evo,
  platformHTTPPort: 1443, platformNodeID: '6d'.repeat(20),
})

const fullList = (mnList: SimplifiedMNListEntry[]): MnListDiff => {
  const diff = Object.assign(new MnListDiff(), {mnList, baseBlockHash: '00'.repeat(32), blockHash: hashHeaderRaw(headerAt(TIP))})
  Object.defineProperty(diff, 'coinbaseHeight', {value: TIP})
  return diff
}

// The block confirmedHash points below: one transaction, so the merkle root is its txid.
const registrationBlock = () => {
  const tx = Transaction.fromHex(EVO_TX)
  return {hash: () => hashHeaderRaw(headerAt(REGISTERED)), txs: [tx], blockHeader: {merkleRoot: tx.hash()}}
}

describe('provider registry', () => {
  let store: FakeStore
  let lists: NetworkMasternode[][]
  let registry: ProviderRegistry

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    store = new FakeStore()
    lists = []
    peer.sent = []
    registry = new ProviderRegistry({
      pool: () => pool as unknown as PoolService,
      chain: () => store as unknown as ChainStore,
      events: {masternodeList: (_network, masternodes) => lists.push(masternodes), evonodeDapiUrls: () => undefined, platformQuorums: () => undefined},
    })
  })
  afterEach(() => {
    registry.resetPool()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('reads a new node\'s ProRegTx from the block below its confirmedHash, then lists it', async () => {
    await registry.offer(fullList([entry(EVO, CONFIRMED_HASH)]))
    expect(lists).toEqual([])
    expect(peer.sent).toHaveLength(1)

    expect(registry.onBlock(peer as never, {block: registrationBlock()} as never)).toBe(true)
    await vi.waitFor(() => expect(lists).toHaveLength(1))

    expect(lists[0][0]).toMatchObject({proTxHash: EVO, ownerAddress: 'yLMWYiFxCpPwim9YuosKAozkqsGf283XCa', registeredHeight: REGISTERED})
    expect(store.registrations.get(EVO)?.collateralVout).toBe(32)
  })

  it('lists at once, with no block asked, a node already indexed', async () => {
    await registry.offer(fullList([entry(EVO, CONFIRMED_HASH)]))
    registry.onBlock(peer as never, {block: registrationBlock()} as never)
    await vi.waitFor(() => expect(lists).toHaveLength(1))

    const restarted = new ProviderRegistry({
      pool: () => pool as unknown as PoolService,
      chain: () => store as unknown as ChainStore,
      events: {masternodeList: (_network, masternodes) => lists.push(masternodes), evonodeDapiUrls: () => undefined, platformQuorums: () => undefined},
    })
    peer.sent = []
    await restarted.offer(fullList([entry(EVO, CONFIRMED_HASH)]))

    expect(peer.sent).toEqual([])
    expect(lists[1][0].ownerAddress).toBe('yLMWYiFxCpPwim9YuosKAozkqsGf283XCa')
  })

  // A node registered moments ago would otherwise show without owner and collateral for an hour.
  it('asks again within minutes while a node is not confirmed yet, and hourly once all are indexed', async () => {
    await registry.offer(fullList([entry('cd'.repeat(32), '00'.repeat(32))]))
    vi.advanceTimersByTime(60_000)
    expect(registry.due).toBe(false)
    vi.advanceTimersByTime(4 * 60_000)
    expect(registry.due).toBe(true)

    await registry.offer(fullList([]))
    vi.advanceTimersByTime(5 * 60_000)
    expect(registry.due).toBe(false)
  })

  it('passes on a block it never asked for', () => {
    expect(registry.onBlock(peer as never, {block: registrationBlock()} as never)).toBe(false)
  })

  // A peer that answers with a block whose transactions are not under its root.
  it('does not read a block that fails its merkle root', async () => {
    await registry.offer(fullList([entry(EVO, CONFIRMED_HASH)]))
    const forged = {...registrationBlock(), blockHeader: {merkleRoot: 'ff'.repeat(32)}}

    expect(registry.onBlock(peer as never, {block: forged} as never)).toBe(true)
    await Promise.resolve()
    expect(store.registrations.size).toBe(0)
    expect(lists).toEqual([])
  })

  it('drops a node that left the list', async () => {
    store.registrations.set('cd'.repeat(32), {...{} as ProviderRegistration, height: 1, payoutHeight: 1})
    await registry.offer(fullList([]))

    expect(store.registrations.size).toBe(0)
    expect(lists).toEqual([[]])
  })

  it('applies a payout from a later block only, and reads a rewound one again', async () => {
    await registry.offer(fullList([entry(EVO, CONFIRMED_HASH)]))
    registry.onBlock(peer as never, {block: registrationBlock()} as never)
    await vi.waitFor(() => expect(lists).toHaveLength(1))

    await registry.applyPayouts([{proTxHash: EVO, payoutAddress: 'yNew', height: REGISTERED + 10}])
    await registry.applyPayouts([{proTxHash: EVO, payoutAddress: 'yOlder', height: REGISTERED + 5}])
    expect(store.registrations.get(EVO)).toMatchObject({payoutAddress: 'yNew', payoutHeight: REGISTERED + 10})
    expect(lists.at(-1)![0].payeeAddress).toBe('yNew')

    await registry.rewound(REGISTERED + 9)
    expect(store.registrations.has(EVO)).toBe(false)
  })
})
