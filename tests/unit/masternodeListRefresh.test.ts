import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {Peer} from 'dash-core-p2p'
import {MasternodeList} from '../../src/main/p2p/sync/masternodeList'

// The coinbase check has its own tests; here every full list passes it.
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

  const answer = (from: Peer, blockHash: string, proTxHashes: string[]): void =>
    list.onDiff(from, {mnlistdiff: {baseBlockHash: ZERO, blockHash, mnList: proTxHashes.map(proRegTxHash => ({proRegTxHash}))}} as never)

  it('hands main every node of a verified full list, with when it was asked for', () => {
    list.onBlockAnnounced(first, 'b1')
    answer(first, 'b1', ['aa', 'bb'])
    expect(listed).toHaveBeenCalledWith('testnet', ['aa', 'bb'], expect.any(Number))
  })

  it('refreshes at the newest announced block, once per reply window', () => {
    list.onBlockAnnounced(first, 'b1')
    answer(first, 'b1', ['aa'])
    list.onBlockAnnounced(second, 'b2')
    list.refresh()
    list.refresh()
    expect(second.sendMessage).toHaveBeenCalledTimes(1)
    expect(second.sendMessage).toHaveBeenCalledWith({blockHash: 'b2'})
    answer(second, 'b2', ['aa', 'cc'])
    expect(listed).toHaveBeenLastCalledWith('testnet', ['aa', 'cc'], expect.any(Number))
  })

  it('asks for nothing before any block is announced', () => {
    list.refresh()
    expect(first.sendMessage).not.toHaveBeenCalled()
    expect(second.sendMessage).not.toHaveBeenCalled()
  })
})
