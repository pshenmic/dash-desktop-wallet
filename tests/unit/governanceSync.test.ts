import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {hexToBytes} from '@noble/hashes/utils.js'
import {GovernanceObject, GovernanceVote as SDKGovernanceVote} from 'dash-core-sdk'
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
  state: GovernanceSyncState = {syncedAt: 0, votesSyncedAt: {}, asked: {}}
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
  let relayed: Array<[string, number, number, string | null]>
  let governance: Governance

  const inv = (type: number, hash: string) => ({inventory: [{type, hash: displayHexToWire(hash)}]}) as never
  const objectMsg = (hex: string) => ({object: GovernanceObject.fromBytes(hexToBytes(hex))}) as never
  const voteMsg = (bytes: Uint8Array) => ({vote: SDKGovernanceVote.fromBytes(bytes)}) as never

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
        GovSync: (arg?: {parentHash?: string}) => ({command: 'govsync', parentHash: arg?.parentHash ?? '0'.repeat(64)}),
        GovObjVote: (vote: unknown) => ({command: 'govobjvote', vote}),
        Inventory: (items: unknown) => ({command: 'inv', items}),
        GetData: (items: unknown) => ({command: 'getdata', items}),
      },
    } as unknown as PoolService
    governance = new Governance({
      pool: () => pool,
      chain: () => store as unknown as ChainStore,
      events: {
        proposals: (_network, list) => proposals.push(list),
        proposalVotes: (_network, _hash, list) => votes.push(list),
        voteRelayed: (requestId, count, accepted, error) => relayed.push([requestId, count, accepted, error]),
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const sentBy = (command: string) => peers.flatMap(peer => peer.sent.filter(message => message.command === command))

  it('asks two peers for the object list once an hour, and keeps what both announce', async () => {
    await governance.open()
    expect(sentBy('govsync')).toHaveLength(2)
    const [first, second] = peers.filter(peer => peer.sent.length > 0)

    governance.onInv(first as never, inv(17, PROPOSAL))
    expect(sentBy('getdata')).toHaveLength(0)
    governance.onInv(second as never, inv(17, PROPOSAL))
    expect(second.sent.filter(({command}) => command === 'getdata')).toHaveLength(1)
    governance.onObject(second as never, objectMsg(MAINNET_PROPOSAL_OBJECT))
    await vi.advanceTimersByTimeAsync(60_000)

    expect(proposals.at(-1)?.map(({hash}) => hash)).toEqual([PROPOSAL])
    expect([...store.objects.keys()]).toEqual([PROPOSAL])
    governance.onPeerReady()
    expect(sentBy('govsync')).toHaveLength(2)
  })

  it('fetches no proposal a single host announced, reconnected or not', async () => {
    await governance.open()
    const asked = peers.find(peer => peer.sent.length > 0)!
    const reconnected = fakePeer(asked.host)
    governance.onInv(asked as never, inv(17, PROPOSAL))
    governance.onInv(asked as never, inv(17, PROPOSAL))
    governance.onInv(reconnected as never, inv(17, PROPOSAL))
    expect(sentBy('getdata')).toHaveLength(0)
    expect(reconnected.sent).toHaveLength(0)
  })

  it('asks the peers left once the first ones let the reply window pass unanswered', async () => {
    await governance.open()
    governance.onPeerReady()
    expect(sentBy('govsync')).toHaveLength(2)

    await vi.advanceTimersByTimeAsync(60_000)
    governance.onPeerReady()
    expect(peers.map(peer => peer.sent.filter(({command}) => command === 'govsync').length)).toEqual([1, 1, 1])

    await vi.advanceTimersByTimeAsync(60_000)
    governance.onPeerReady()
    expect(sentBy('govsync')).toHaveLength(3)
  })

  it('takes no object it did not ask for', async () => {
    await governance.open()
    governance.onObject(peers[0] as never, objectMsg(MAINNET_PROPOSAL_OBJECT))
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
    governance.onVote(asked as never, voteMsg(hexToBytes(MAINNET_VOTES[0])))
    await vi.advanceTimersByTimeAsync(1_000)

    expect(votes.at(-1)?.map(({hash, voter}) => [hash, voter])).toEqual([[VOTE_HASH, 'Xumt2BNf5UYGhNvZkBUmeemy1xN8iLybrz']])
    expect([...store.votes.get(PROPOSAL)!.keys()]).toEqual([VOTE_HASH])
  })

  it('keeps no vote whose signature recovers to no key, and sends main the held votes once', async () => {
    store.objects.set(PROPOSAL, hexToBytes(MAINNET_PROPOSAL_OBJECT))
    store.state.syncedAt = Date.now()
    await governance.open()
    await governance.syncVotes(PROPOSAL)
    await governance.syncVotes(PROPOSAL)
    expect(votes).toEqual([[]])

    const unsigned = hexToBytes(MAINNET_VOTES[0])
    unsigned[85] = 0
    const asked = peers.find(peer => peer.sent.some(({command}) => command === 'govsync'))!
    governance.onInv(asked as never, inv(18, VOTE_HASH))
    governance.onVote(asked as never, voteMsg(unsigned))
    await vi.advanceTimersByTimeAsync(1_000)
    expect(store.votes.size).toBe(0)
  })

  it('recovers no signer for a vote it did not ask for', async () => {
    store.objects.set(PROPOSAL, hexToBytes(MAINNET_PROPOSAL_OBJECT))
    store.state.syncedAt = Date.now()
    await governance.open()
    const recover = vi.spyOn(SDKGovernanceVote.prototype, 'recoverSigner')

    governance.onVote(peers[0] as never, voteMsg(hexToBytes(MAINNET_VOTES[0])))

    expect(recover).not.toHaveBeenCalled()
    expect(store.votes.size).toBe(0)
  })

  it('announces a vote, hands it to each peer that asks once, and asks them back', async () => {
    governance.voteRelay.relay('r1', hexToBytes(MAINNET_VOTES[0]))
    expect(sentBy('inv')).toHaveLength(3)

    governance.voteRelay.onGetData(peers[1] as never, inv(18, VOTE_HASH))
    governance.voteRelay.onGetData(peers[1] as never, inv(18, VOTE_HASH))
    governance.voteRelay.onGetData(peers[2] as never, inv(18, VOTE_HASH))
    expect(sentBy('govobjvote')).toHaveLength(2)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(peers.map(peer => peer.sent.filter(({command}) => command === 'getdata').length)).toEqual([0, 1, 1])
    governance.onVote(peers[1] as never, voteMsg(hexToBytes(MAINNET_VOTES[0])))
    await vi.advanceTimersByTimeAsync(5_000)
    expect(relayed).toEqual([['r1', 2, 1, null]])
  })

  // Core serves a vote back only from the votes it kept.
  it('counts our vote only once a peer serves it back', async () => {
    store.objects.set(PROPOSAL, hexToBytes(MAINNET_PROPOSAL_OBJECT))
    store.state = {syncedAt: Date.now(), votesSyncedAt: {[PROPOSAL]: Date.now()}, asked: {}}
    await governance.open()
    await governance.syncVotes(PROPOSAL)

    governance.voteRelay.relay('r1', hexToBytes(MAINNET_VOTES[0]))
    governance.voteRelay.onGetData(peers[0] as never, inv(18, VOTE_HASH))
    await vi.advanceTimersByTimeAsync(16_000)
    expect(relayed).toEqual([['r1', 1, 0, null]])
    expect(store.votes.get(PROPOSAL)).toBeUndefined()

    governance.voteRelay.relay('r2', hexToBytes(MAINNET_VOTES[0]))
    governance.voteRelay.onGetData(peers[0] as never, inv(18, VOTE_HASH))
    await vi.advanceTimersByTimeAsync(10_000)
    governance.onVote(peers[0] as never, voteMsg(hexToBytes(MAINNET_VOTES[0])))
    await vi.advanceTimersByTimeAsync(6_000)
    expect(relayed.at(-1)).toEqual(['r2', 1, 1, null])
    expect([...store.votes.get(PROPOSAL)!.keys()]).toEqual([VOTE_HASH])
    expect(votes.at(-1)?.map(({hash}) => hash)).toEqual([VOTE_HASH])
  })
})
