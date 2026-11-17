import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {Peer} from 'dash-core-p2p'
import {MasternodeList} from '../../src/main/p2p/sync/masternodeList'

// The coinbase checks have their own tests; here every list passes them but a forged one.
vi.mock('../../src/main/p2p/utils/masternodeList', async original => ({
  ...await original<typeof import('../../src/main/p2p/utils/masternodeList')>(),
  evonodeDapiUrls: () => [],
}))

const ZERO = '00'.repeat(32)

function peer(host: string): Peer & {sendMessage: ReturnType<typeof vi.fn>} {
  return {host, port: 19999, bestHeight: 1, sendMessage: vi.fn()} as never
}

describe('the lock pool masternode list', () => {
  const listed = vi.fn()
  let first: ReturnType<typeof peer>
  let second: ReturnType<typeof peer>
  let list: MasternodeList

  beforeEach(() => {
    listed.mockReset()
    first = peer('1.1.1.1')
    second = peer('2.2.2.2')
    const pool = {network: 'testnet', readyPeers: new Set([first, second]), messages: {GetMnListDiff: (args: unknown) => args}}
    list = new MasternodeList({
      pool: () => pool as never,
      chain: () => null,
      events: {evonodeDapiUrls: vi.fn(), platformQuorums: vi.fn(), masternodeList: vi.fn(), listedMasternodes: listed},
    })
  })

  afterEach(() => list.resetPool())

  const answer = async (from: Peer, blockHash: string, proTxHashes: string[]): Promise<void> => {
    list.onDiff(from, {mnlistdiff: {baseBlockHash: ZERO, blockHash, mnList: proTxHashes.map(proRegTxHash => ({proRegTxHash}))}} as never)
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  it('hands main every node of a verified full list, with when it was asked for', async () => {
    list.onBlockAnnounced(first, 'b1')
    await answer(first, 'b1', ['aa', 'bb'])
    expect(listed.mock.calls).toEqual([['testnet', ['aa', 'bb'], expect.any(Number), false]])
    expect(listed.mock.calls[0][2]).toBeGreaterThan(0)
  })

  it('stamps a list nobody asked for with no ask time, so it can drop no node', async () => {
    await answer(first, 'b9', ['aa'])
    expect(listed).toHaveBeenCalledWith('testnet', ['aa'], 0, false)
  })

  it('refreshes at the newest announced block, once per reply window', async () => {
    list.onBlockAnnounced(first, 'b1')
    await answer(first, 'b1', ['aa'])
    list.onBlockAnnounced(second, 'b2')
    list.refresh()
    list.refresh()
    expect(second.sendMessage).toHaveBeenCalledTimes(1)
    expect(second.sendMessage).toHaveBeenCalledWith({blockHash: 'b2'})
    await answer(second, 'b2', ['aa', 'cc'])
    expect(listed).toHaveBeenLastCalledWith('testnet', ['aa', 'cc'], expect.any(Number), false)
  })

  it('asks for nothing before any block is announced', () => {
    list.refresh()
    expect(first.sendMessage).not.toHaveBeenCalled()
    expect(second.sendMessage).not.toHaveBeenCalled()
  })
})

describe('following the tip', () => {
  const listed = vi.fn()
  let first: ReturnType<typeof peer>
  let second: ReturnType<typeof peer>
  let readyPeers: Set<Peer>
  let list: MasternodeList
  const store = {
    network: 'testnet', getHeaderByHeight: async () => new Uint8Array(80), getRegistrations: async () => new Map(),
    writeRegistrations: async () => undefined, findHeights: async () => new Map(),
  }

  beforeEach(() => {
    listed.mockReset()
    first = peer('1.1.1.1')
    second = peer('2.2.2.2')
    readyPeers = new Set([first])
    const pool = {network: 'testnet', readyPeers, messages: {GetMnListDiff: (args: unknown) => args}}
    list = new MasternodeList({
      pool: () => pool as never,
      chain: () => store as never,
      events: {evonodeDapiUrls: vi.fn(), platformQuorums: vi.fn(), masternodeList: vi.fn(), listedMasternodes: listed},
    })
  })

  afterEach(() => {
    list.closeChain()
    vi.useRealTimers()
  })

  const answer = async (baseBlockHash: string, blockHash: string, coinbaseHeight: number, mnList: string[], deletedMNs: string[] = [], v24 = false): Promise<void> => {
    const entries = mnList.map(proRegTxHash => ({proRegTxHash, confirmedHash: ZERO, keyIDVoting: '00'.repeat(20), pubKeyOperator: '00'.repeat(48)}))
    const diff = {
      baseBlockHash, blockHash, coinbaseHeight, deletedMNs, mnList: entries,
      coinbaseVersion: v24 ? 4 : 3,
      applyTo: (previous: {proRegTxHash: string}[]) =>
        [...previous.filter(({proRegTxHash}) => !deletedMNs.includes(proRegTxHash)), ...entries],
      applyQuorumsTo: () => [],
      verify: () => { if (blockHash === 'forged') throw new Error('not committed') },
    }
    list.onDiff(first, {mnlistdiff: diff} as never)
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  const lastListed = (): string[] => listed.mock.calls.at(-1)![1]

  it('asks the full list once, then each block only for a diff from the list it holds', async () => {
    list.followTip('b1')
    expect(first.sendMessage).toHaveBeenLastCalledWith({baseBlockHash: undefined, blockHash: 'b1'})
    await answer(ZERO, 'b1', 1, ['aa', 'bb'])

    list.followTip('b2')
    expect(first.sendMessage).toHaveBeenLastCalledWith({baseBlockHash: 'b1', blockHash: 'b2'})
    await answer('b1', 'b2', 2, ['cc'], ['aa'])
    expect(lastListed()).toEqual(['bb', 'cc'])
  })

  // Several peers answer each ask, and the same diff must not apply twice.
  it('drops a diff based on a list already replaced, and one its coinbase does not commit to', async () => {
    await answer(ZERO, 'b1', 1, ['aa'])
    await answer('b1', 'b2', 2, ['bb'])
    await answer('b1', 'b2', 2, ['cc'])
    await answer('b2', 'forged', 3, ['dd'])
    expect(lastListed()).toEqual(['aa', 'bb'])
  })

  it('hands main no list for a block that changed no node', async () => {
    await answer(ZERO, 'b1', 1, ['aa'])
    const calls = listed.mock.calls.length
    await answer('b1', 'b2', 2, [])
    expect(listed.mock.calls.length).toBe(calls)

    list.followTip('b3')
    expect(first.sendMessage).toHaveBeenLastCalledWith({baseBlockHash: 'b2', blockHash: 'b3'})
  })

  it('asks one peer at a time for the full list, another when the reply window passes', () => {
    vi.useFakeTimers()
    readyPeers.add(second)
    const asks = (): number => first.sendMessage.mock.calls.length + second.sendMessage.mock.calls.length
    list.followTip('b1')
    expect(asks()).toBe(1)
    vi.advanceTimersByTime(5_000)
    expect(asks()).toBe(2)
  })

  it('tells main a full list once, with when its block was asked for', async () => {
    list.followTip('b1')
    await answer(ZERO, 'b1', 1, ['aa'])
    expect(listed.mock.calls).toEqual([['testnet', ['aa'], expect.any(Number), false]])
    expect(listed.mock.calls[0][2]).toBeGreaterThan(0)
  })

  it('tells main when v24 activates in a block that changed no node', async () => {
    await answer(ZERO, 'b1', 1, ['aa'])
    await answer('b1', 'b2', 2, [], [], true)
    expect(listed).toHaveBeenLastCalledWith('testnet', ['aa'], 0, true)
  })

  it('asks the full list again once a rewind leaves the list it holds', async () => {
    await answer(ZERO, 'b5', 5, ['aa'])
    list.rewound(4)
    list.followTip('b5x')
    expect(first.sendMessage).toHaveBeenLastCalledWith({baseBlockHash: undefined, blockHash: 'b5x'})
  })
})
