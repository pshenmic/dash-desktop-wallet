import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {LATEST_PLATFORM_VERSION} from 'dash-platform-sdk/src/constants.js'

const quorum = vi.hoisted(() => ({byVersion: new Map<number, string[]>()}))
vi.mock('../../src/main/platform/operations/dapi', () => ({
  dapiUrlsByProtocolVersion: vi.fn(async () => quorum.byVersion),
}))

import {dapiUrlsByProtocolVersion} from '../../src/main/platform/operations/dapi'
import {SdkRegistry} from '../../src/main/platform/SdkRegistry'
import {EPOCH_START_POLL_MS, VERSION_CHECK_MS} from '../../src/main/platform/constants'

const EPOCH_LENGTH = 60 * 60_000
const ZERO_START = 1_800_000_000_000
const NODES = Array.from({length: 15}, (_, i) => `https://10.0.0.${i}:443`)

// Epoch 10 has run for two minutes; epoch 11 is scheduled 58 minutes out.
const startOf = (epoch: number): number => ZERO_START + epoch * EPOCH_LENGTH
const chain = {epoch: 10, version: 13, offline: false}

function setup(): {registry: SdkRegistry; getEpochsInfo: ReturnType<typeof vi.fn>} {
  const registry = new SdkRegistry(() => undefined)
  const getEpochsInfo = vi.fn(async (_count: number, ascending: boolean) => {
    if (chain.offline) throw new Error('offline')
    const epoch = ascending ? 0 : chain.epoch
    // Every epoch starts with the first block after its slot.
    return [{number: epoch, startTime: BigInt(startOf(epoch) + (epoch === 0 ? 0 : 60_000)), protocolVersion: chain.version}]
  })
  const status = vi.fn(async () => ({time: {local: String(Math.floor(Date.now() / 1000))}}))
  vi.spyOn(registry, 'get').mockReturnValue({node: {getEpochsInfo, status}} as never)
  return {registry, getEpochsInfo}
}

beforeEach(() => {
  vi.useFakeTimers({now: startOf(10) + 2 * 60_000})
  Object.assign(chain, {epoch: 10, version: 13, offline: false})
  quorum.byVersion = new Map()
  vi.mocked(dapiUrlsByProtocolVersion).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SdkRegistry.platformVersion', () => {
  it('asks the network once and shares the answer', async () => {
    const {registry, getEpochsInfo} = setup()
    const first = registry.platformVersion('testnet')
    expect(registry.platformVersion('testnet')).toBe(first)
    expect(await first).toBe(13)
    // The current epoch, and epoch 0 for the schedule.
    expect(getEpochsInfo).toHaveBeenCalledTimes(2)
  })

  it('caps a version newer than this SDK knows: upgrades are mostly backward compatible', async () => {
    chain.version = LATEST_PLATFORM_VERSION + 1
    const {registry} = setup()
    expect(await registry.platformVersion('testnet')).toBe(LATEST_PLATFORM_VERSION)
  })

  it('fails an operation when no version is known, rather than guessing one', async () => {
    chain.offline = true
    const {registry} = setup()
    await expect(registry.platformVersion('testnet')).rejects.toThrow('offline')
    expect(vi.getTimerCount()).toBe(0)

    chain.offline = false
    expect(await registry.platformVersion('testnet')).toBe(13)
  })

  it('leaves no unhandled failure behind a request that never awaits the version', async () => {
    chain.offline = true
    const {registry} = setup()
    void registry.platformVersion('testnet')
    await vi.advanceTimersByTimeAsync(0)
  })

  it('keeps the known version through a failed check', async () => {
    const {registry} = setup()
    await registry.platformVersion('testnet')
    chain.offline = true
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS)
    expect(await registry.platformVersion('testnet')).toBe(13)
  })

  it('ignores a node still behind the epoch already seen', async () => {
    const {registry} = setup()
    await registry.platformVersion('testnet')
    Object.assign(chain, {epoch: 9, version: 12})
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS)
    expect(await registry.platformVersion('testnet')).toBe(13)
  })

  it('stops checking a network idle for a whole interval, then checks afresh on its next operation', async () => {
    const {registry, getEpochsInfo} = setup()
    await registry.platformVersion('testnet')
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS)
    expect(vi.getTimerCount()).toBe(0)

    const calls = getEpochsInfo.mock.calls.length
    await registry.platformVersion('testnet')
    expect(getEpochsInfo.mock.calls.length).toBeGreaterThan(calls)
  })

  it('reads the quorum once the next epoch is due, and takes a change only from the proved epoch', async () => {
    const {registry, getEpochsInfo} = setup()
    quorum.byVersion = new Map([[13, NODES]])
    registry.setEvonodeDapiUrls('testnet', NODES)
    await registry.platformVersion('testnet')

    // Idle until epoch 11's slot, then the quorum still runs 13. The slot is
    // estimated from epoch 10's late start, so it lands a minute after startOf(11).
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS)
    registry.platformVersion('testnet')
    const epochCalls = getEpochsInfo.mock.calls.length
    await vi.advanceTimersByTimeAsync(startOf(11) + 2 * 60_000 - Date.now())
    expect(await registry.platformVersion('testnet')).toBe(13)
    expect(getEpochsInfo.mock.calls.length).toBe(epochCalls)

    // The first block of epoch 11 activates 14.
    Object.assign(chain, {epoch: 11, version: 14})
    quorum.byVersion = new Map([[14, NODES]])
    const probes = vi.mocked(dapiUrlsByProtocolVersion).mock.calls.length
    await vi.advanceTimersByTimeAsync(EPOCH_START_POLL_MS)
    expect(await registry.platformVersion('testnet')).toBe(14)
    expect(getEpochsInfo.mock.calls.length).toBeGreaterThan(epochCalls)
    // The quorum read, then the probe that drops nodes left on 13.
    expect(vi.mocked(dapiUrlsByProtocolVersion).mock.calls.length).toBe(probes + 2)
  })
})

describe('SdkRegistry probe', () => {
  it('pins the evonodes that answered even when too few came to fill a pool', async () => {
    const pinned: string[][] = []
    const registry = new SdkRegistry(event => {
      if (event.type === 'pinnedDapiUrls') pinned.push(event.dapiUrls)
    })
    quorum.byVersion = new Map([[13, NODES.slice(0, 10)]])
    registry.setEvonodeDapiUrls('testnet', NODES)
    await vi.advanceTimersByTimeAsync(0)
    expect(pinned).toEqual([NODES.slice(0, 10)])
  })
})
