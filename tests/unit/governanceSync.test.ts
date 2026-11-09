import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {hexToBytes} from '@noble/hashes/utils.js'
import {Governance} from '../../src/main/p2p/sync/governance'
import type {ChainStore} from '../../src/main/p2p/store/ChainStore'
import type {PoolService} from '../../src/main/p2p/net/PoolService'
import type {GovernanceSyncState} from '../../src/main/p2p/types/chainStore'
import type {GovernanceVote, Proposal} from '../../src/main/src/types/Governance'
import {displayHexToWire} from '../../src/main/p2p/utils/byteOrder'
import {MAINNET_PROPOSAL_OBJECT, MAINNET_VOTES} from '../fixtures/governance'

const PROPOSAL = 'a5465cdb6caf234cc9b8b776b1e3b60f319367504527e80a669bf41811419901'
const VOTE_HASH = 'c6813959d49cb8c81cb0c3b9587af312cc90f0b4d86feb877dc1100754012eda'
// Its end_epoch, 2027-01-31: the proposal is current until a cycle after that.
const PROPOSAL_END = 1801522426

class FakeStore {
  readonly network = 'mainnet' as const
  objects = new Map<string, Uint8Array>()
  votes = new Map<string, Map<string, Uint8Array>>()
  state: GovernanceSyncState = {syncedAt: 0, votesSyncedAt: {}}
  getProposalObjects = async (): Promise<Uint8Array[]> => [...this.objects.values()]
  getVotes = async (hash: string): Promise<Uint8Array[]> => [...this.votes.get(hash)?.values() ?? []]
  writeProposals = async (put: Map<string, Uint8Array>, del: string[] = []): Promise<void> => {
    put.forEach((bytes, hash) => this.objects.set(hash, bytes))
    for (const hash of del) {
      this.objects.delete(hash)
      this.votes.delete(hash)
    }
  }
  writeVotes = async (hash: string, put: Map<string, Uint8Array>): Promise<void> => {
    const held = this.votes.get(hash) ?? new Map<string, Uint8Array>()
    put.forEach((bytes, voteHash) => held.set(voteHash, bytes))
    this.votes.set(hash, held)
  }
  getGovernanceState = async (): Promise<GovernanceSyncState> => structuredClone(this.state)
  writeGovernanceState = async (state: GovernanceSyncState): Promise<void> => {
    this.state = structuredClone(state)
  }
}

type Sent = {command: string; payload?: Uint8Array; items?: Array<{type: number; hash: Uint8Array}>}

function fakePeer(host: string) {
  return {host, port: 9999, sent: [] as Sent[], sendMessage(message: Sent) { this.sent.push(message) }}
}

describe('governance sync', () => {
  let store: FakeStore
  let peers: ReturnType<typeof fakePeer>[]
  let proposals: Proposal[][]
  let votes: GovernanceVote[][]
  let relayed: Array<[string, number, string | null]>
  let governance: Governance

  const inv = (type: number, hash: string) => ({inventory: [{type, hash: displayHexToWire(hash)}]}) as never
  const payload = (hex: string) => ({payload: hexToBytes(hex)}) as never

  beforeEach(() => {
    vi.useFakeTimers({now: (PROPOSAL_END - 100) * 1000})
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    store = new FakeStore()
    peers = [fakePeer('a'), fakePeer('b'), fakePeer('c')]
    proposals = []
    votes = []
    relayed = []
    const pool = {
      network: 'mainnet',
      readyPeers: new Set(peers),
      messages: {
        GovSync: (arg: {payload: Uint8Array}) => ({command: 'govsync', ...arg}),
        GovObjVote: (arg: {payload: Uint8Array}) => ({command: 'govobjvote', ...arg}),
        Inv: (items: unknown) => ({command: 'inv', items}),
        GetData: (items: unknown) => ({command: 'getdata', items}),
      },
    } as unknown as PoolService
    governance = new Governance({
      pool: () => pool,
      chain: () => store as unknown as ChainStore,
      events: {
        proposals: (_network, list) => proposals.push(list),
        proposalVotes: (_network, _hash, list) => votes.push(list),
        voteRelayed: (requestId, count, error) => relayed.push([requestId, count, error]),
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const sentBy = (command: string) => peers.flatMap(peer => peer.sent.filter(message => message.command === command))

  it('asks two peers for the object list once an hour, and keeps what they send', async () => {
    await governance.open()
    expect(sentBy('govsync')).toHaveLength(2)
    const asked = peers.find(peer => peer.sent.length > 0)!

    governance.onInv(asked as never, inv(17, PROPOSAL))
    governance.onObject(asked as never, payload(MAINNET_PROPOSAL_OBJECT))
    await vi.advanceTimersByTimeAsync(1_000)

    expect(proposals.at(-1)?.map(({hash}) => hash)).toEqual([PROPOSAL])
    expect([...store.objects.keys()]).toEqual([PROPOSAL])
    governance.onPeerReady()
    expect(sentBy('govsync')).toHaveLength(2)
  })

  it('takes no object it did not ask for', async () => {
    await governance.open()
    governance.onObject(peers[0] as never, payload(MAINNET_PROPOSAL_OBJECT))
    await vi.advanceTimersByTimeAsync(1_000)
    expect(store.objects.size).toBe(0)
  })

  it('drops a stored proposal and its votes once a superblock cycle has passed its end', async () => {
    store.objects.set(PROPOSAL, hexToBytes(MAINNET_PROPOSAL_OBJECT))
    store.votes.set(PROPOSAL, new Map([[VOTE_HASH, hexToBytes(MAINNET_VOTES[0])]]))
    vi.setSystemTime((PROPOSAL_END + 16_616 * 150 + 1) * 1000)

    await governance.open()

    expect(store.objects.size).toBe(0)
    expect(store.votes.size).toBe(0)
    expect(proposals.at(-1)).toEqual([])
  })

  it('fetches votes only from a peer answering its vote sync', async () => {
    store.objects.set(PROPOSAL, hexToBytes(MAINNET_PROPOSAL_OBJECT))
    store.state.syncedAt = Date.now()
    await governance.open()

    governance.onInv(peers[0] as never, inv(18, VOTE_HASH))
    expect(sentBy('getdata')).toHaveLength(0)

    await governance.syncVotes(PROPOSAL)
    expect(votes.at(-1)).toEqual([])
    const asked = peers.find(peer => peer.sent.some(({command}) => command === 'govsync'))!
    governance.onInv(asked as never, inv(18, VOTE_HASH))
    governance.onVote(asked as never, payload(MAINNET_VOTES[0]))
    await vi.advanceTimersByTimeAsync(1_000)

    expect(votes.at(-1)?.map(({hash, voter}) => [hash, voter])).toEqual([[VOTE_HASH, 'Xumt2BNf5UYGhNvZkBUmeemy1xN8iLybrz']])
    expect([...store.votes.get(PROPOSAL)!.keys()]).toEqual([VOTE_HASH])
  })

  it('announces a vote and hands it to each peer that asks, once', async () => {
    governance.relay('r1', hexToBytes(MAINNET_VOTES[0]))
    expect(sentBy('inv')).toHaveLength(3)

    governance.onGetData(peers[1] as never, inv(18, VOTE_HASH))
    governance.onGetData(peers[1] as never, inv(18, VOTE_HASH))
    expect(sentBy('govobjvote')).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(relayed).toEqual([['r1', 1, null]])
  })
})
