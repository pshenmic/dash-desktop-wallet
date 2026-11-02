import {DashPlatformSDK, GRPCConnectionPool} from 'dash-platform-sdk'
import {LATEST_PLATFORM_VERSION} from 'dash-platform-sdk/src/constants.js'
import {PlatformVersionWASM, ShieldedBuilderWASM} from 'pshenmic-dpp'
import {Network} from '../src/types/Network'
import {Logger} from '../src/utils/logger'
import {majorityVersionNodes} from '../src/utils/majorityVersionNodes'
import {inEpochStartWindow, versionCheckDelay} from '../src/utils/versionCheckDelay'

import {
  DAPI_POOL_READY,
  DAPI_REPROBE_MS,
  EPOCH_START_LAG_MS,
  EPOCH_START_POLL_MS,
  NETWORKS,
  SEED_MIN_PROTOCOL_VERSION,
  VERSION_CHECK_MS,
} from './constants'
import {dapiUrlsByProtocolVersion} from './operations/dapi'
import {P2PQuorumKeyProvider} from './P2PQuorumKeyProvider'
import {Dapi, PlatformEvent} from './types/messages'
import {SdkSource} from './types/sdk'

const log = new Logger('platform')

// One SDK per network, replaced on a DAPI change and otherwise never mutated.
// `setNetwork` is deliberately never called: it rebuilds the gRPC pool and
// replaces every controller, leaving anything in flight holding swapped-out
// objects. A replaced SDK keeps serving whatever already holds it.
//
// Before the first evonode list is probed the SDK is built on no urls at all,
// unless main gave up waiting for it and fell back to the SDK's own seeds.
export class SdkRegistry implements SdkSource {
  private readonly sdks = new Map<Network, DashPlatformSDK>()
  // null: the SDK discovers evonodes from its own seed nodes.
  private readonly pinnedDapiUrls = new Map<Network, string[] | null>()
  // The list each network was last asked to probe, so only the latest is retried.
  private readonly latestDapiUrls = new Map<Network, string[]>()
  private readonly platformVersions = new Map<Network, Promise<PlatformVersionWASM>>()
  // When an operation last asked each network's version.
  private readonly versionsAskedAt = new Map<Network, number>()
  private readonly epochNumbers = new Map<Network, number>()
  private readonly epochZeroStarts = new Map<Network, number>()
  private readonly nextEpochStarts = new Map<Network, number>()
  // Node clock minus this machine's, so a wrong local clock cannot move an epoch start.
  private readonly clockOffsets = new Map<Network, number>()
  private readonly probing = new Set<Network>()
  private readonly quorumKeyProviders = new Map(NETWORKS.map(network => [network, new P2PQuorumKeyProvider(network)]))
  private builder: ShieldedBuilderWASM | null = null
  private warming: Promise<void> | null = null
  private dapi: Dapi = {mode: 'dynamic', mainnet: [], testnet: []}

  constructor(private readonly emit: (event: PlatformEvent) => void) {}

  setDapi(dapi: Dapi): void {
    this.dapi = dapi
    this.sdks.clear()
  }

  setQuorumKeys(network: Network, keys: Map<string, Uint8Array>): void {
    this.quorumKeyProviders.get(network)?.setKeys(keys)
  }

  get(network: Network): DashPlatformSDK {
    const existing = this.sdks.get(network)
    if (existing != null) return existing
    const own = this.dapi[network]
    const pinned = this.pinnedDapiUrls.get(network)
    const dapiUrls = this.dapi.mode === 'static' && own.length > 0 ? own : pinned === null ? null : pinned ?? []
    const sdk = new DashPlatformSDK({
      network,
      grpc: {dapiUrl: dapiUrls == null ? undefined : [...dapiUrls], minProtocolVersion: SEED_MIN_PROTOCOL_VERSION},
      quorumKeyProvider: this.quorumKeyProviders.get(network),
    })
    // init assigns the builder before its first await; the warmed builder's
    // own init is memoised.
    if (this.builder != null) void sdk.shielded.init(this.builder)
    this.sdks.set(network, sdk)
    return sdk
  }

  // A list probed later still replaces the seeds.
  useSeedNodes(network: Network): void {
    if (this.pinnedDapiUrls.has(network)) return
    log.warn(`${network}: no evonode from the p2p masternode list yet, discovering from the SDK's seed nodes`)
    this.pinnedDapiUrls.set(network, null)
    this.sdks.delete(network)
  }

  setEvonodeDapiUrls(network: Network, dapiUrls: string[]): void {
    this.latestDapiUrls.set(network, dapiUrls)
    this.probe(network, dapiUrls)
      .then(reachable => {
        if (reachable.length === 0) throw new Error(`none of ${dapiUrls.length} evonode(s) answered`)
      })
      .catch(err => {
        if (this.latestDapiUrls.get(network) !== dapiUrls) return
        log.warn(`${network}: no reachable evonode, probing again in ${DAPI_REPROBE_MS / 1000}s:`, err)
        setTimeout(() => {
          if (this.latestDapiUrls.get(network) === dapiUrls) this.setEvonodeDapiUrls(network, dapiUrls)
        }, DAPI_REPROBE_MS).unref?.()
      })
  }

  // The SDK lifts a ban only after a request succeeds, which none can once every
  // node is banned; a fresh probe builds a pool without them.
  refillBannedPool(network: Network): void {
    if ((this.dapi.mode === 'static' && this.dapi[network].length > 0) || this.probing.has(network)) return
    const dapiUrls = this.latestDapiUrls.get(network)
    log.warn(`${network}: every evonode is banned, refilling the pool`)
    if (dapiUrls == null) {
      this.sdks.delete(network)
      return
    }
    void this.probe(network, dapiUrls)
  }

  // Pins the first batches that fill a pool, then every evonode that answered, to
  // spread requests across all of them.
  private async probe(network: Network, dapiUrls: string[]): Promise<string[]> {
    log.info(`${network}: probing ${dapiUrls.length} evonode(s)`)
    this.probing.add(network)
    try {
      let ready: string[] = []
      const reachable = majorityVersionNodes(await dapiUrlsByProtocolVersion(dapiUrls, network, byVersion => {
        const majority = majorityVersionNodes(byVersion)
        if (ready.length === 0 && majority.length >= DAPI_POOL_READY) {
          ready = majority
          this.pin(network, majority)
        }
        return false
      }))
      // Pinned again if the pool grew, or if the majority moved to another version meanwhile.
      if (reachable.length > ready.length || !ready.every(dapiUrl => reachable.includes(dapiUrl))) this.pin(network, reachable)
      return reachable
    } finally {
      this.probing.delete(network)
    }
  }

  // The first request on a network starts its checks. They go on in the
  // background while the network is in use and stop once it sits idle for a whole
  // check interval, so the next request checks afresh rather than trusting a
  // version gone stale.
  platformVersion(network: Network): Promise<PlatformVersionWASM> {
    this.versionsAskedAt.set(network, Date.now())
    if (!this.platformVersions.has(network)) this.checkPlatformVersion(network)
    return this.platformVersions.get(network)!
  }

  // The version the network runs, capped at the newest this SDK knows: upgrades
  // are mostly backward compatible. A failed check keeps the version already
  // known; with none, the operations waiting on it fail rather than guess one.
  private checkPlatformVersion(network: Network): void {
    const known = this.platformVersions.get(network)
    const dapiUrls = this.latestDapiUrls.get(network)
    const nextEpochStart = this.nextEpochStarts.get(network)
    const atEpochStart = dapiUrls != null && nextEpochStart != null && inEpochStartWindow(this.chainNow(network), nextEpochStart, EPOCH_START_LAG_MS)
    const running = atEpochStart ? this.quorumProtocolVersion(network, dapiUrls, known) : this.epochProtocolVersion(network)
    const capped = running.then(version => Math.min(version, LATEST_PLATFORM_VERSION), err => {
      if (known == null) throw err
      return known
    })
    this.platformVersions.set(network, capped)
    // Every request carries it and most never await it; an operation that does
    // still sees the failure.
    capped.catch(() => undefined)

    running
      .then(async version => {
        if (known != null && await capped === await known) return
        log.info(`${network} runs protocol ${version}${version > LATEST_PLATFORM_VERSION ? `, newer than this SDK's ${LATEST_PLATFORM_VERSION}` : ''}`)
        // Nodes that did not follow the upgrade drop out of the pool.
        if (known != null && dapiUrls != null && !this.probing.has(network)) void this.probe(network, dapiUrls)
      }, err => {
        log.warn(`${network}: protocol version check failed:`, err)
        if (known == null) this.platformVersions.delete(network)
      })
      .then(() => {
        if (!this.platformVersions.has(network)) return
        if (Date.now() - this.versionsAskedAt.get(network)! > VERSION_CHECK_MS) {
          this.platformVersions.delete(network)
          return
        }
        setTimeout(() => this.checkPlatformVersion(network), this.nextCheckDelay(network)).unref?.()
      })
  }

  // Also schedules the next epoch start: epochs start on a fixed schedule from
  // epoch 0, so its start and the current one give the length of every epoch.
  private async epochProtocolVersion(network: Network): Promise<number> {
    const sdk = this.get(network)
    const [[current], status] = await Promise.all([sdk.node.getEpochsInfo(1, false), sdk.node.status().catch(() => null)])
    if (current == null) throw new Error('no epoch info answered')
    // A node still catching up answers an epoch the network has left.
    const seen = this.epochNumbers.get(network) ?? 0
    if (current.number < seen) throw new Error(`a node answered epoch ${current.number}, behind ${seen}`)
    const version = Number(current.protocolVersion)
    if (!Number.isInteger(version)) throw new Error(`epoch reports protocol version ${String(current.protocolVersion)}`)
    this.epochNumbers.set(network, current.number)

    // time.local is in seconds.
    const nodeNow = Number(status?.time?.local) * 1000
    if (nodeNow > 0) this.clockOffsets.set(network, nodeNow - Date.now())
    if (current.number > 0) {
      const zeroStart = this.epochZeroStarts.get(network) ?? Number((await sdk.node.getEpochsInfo(1, true, 0))[0]!.startTime)
      this.epochZeroStarts.set(network, zeroStart)
      const epochLength = (Number(current.startTime) - zeroStart) / current.number
      // Whole milliseconds: a timer set for a fraction early would fire before the window.
      this.nextEpochStarts.set(network, Math.ceil(zeroStart + (current.number + 1) * epochLength))
    }
    return version
  }

  // At an epoch start the version is read from the validators executing the
  // blocks. A change they report is taken only from the proved epoch info, which
  // also moves the schedule on to the following epoch.
  private async quorumProtocolVersion(network: Network, dapiUrls: string[], known: Promise<PlatformVersionWASM> | undefined): Promise<number> {
    const byVersion = await dapiUrlsByProtocolVersion(dapiUrls, network, found => majorityVersionNodes(found).length >= DAPI_POOL_READY)
    const majority = majorityVersionNodes(byVersion)
    const version = [...byVersion].find(([, nodes]) => nodes === majority)?.[0]
    if (version == null) throw new Error(`none of ${dapiUrls.length} evonode(s) answered`)
    if (known != null && Math.min(version, LATEST_PLATFORM_VERSION) === await known) return version
    return this.epochProtocolVersion(network)
  }

  private chainNow(network: Network): number {
    return Date.now() + (this.clockOffsets.get(network) ?? 0)
  }

  private nextCheckDelay(network: Network): number {
    const nextEpochStart = this.nextEpochStarts.get(network)
    if (nextEpochStart == null) return VERSION_CHECK_MS
    return versionCheckDelay(this.chainNow(network), nextEpochStart, EPOCH_START_LAG_MS, EPOCH_START_POLL_MS, VERSION_CHECK_MS)
  }

  private pin(network: Network, reachable: string[]): void {
    log.info(`${network}: pinned to ${reachable.length} evonode(s): ${reachable.join(', ')}`)
    this.pinnedDapiUrls.set(network, reachable)
    this.sdks.delete(network)
    this.emit({type: 'pinnedDapiUrls', network, dapiUrls: reachable})
  }

  activeDapiUrls(network: Network): string[] {
    const pool = this.get(network).grpcPool
    return pool instanceof GRPCConnectionPool ? [...pool.dapiUrls] : []
  }

  getBuilder(): ShieldedBuilderWASM | null {
    return this.builder
  }

  // The Halo2 proving key is built once and the one builder injected into every
  // network's shielded controller. Sharing it across networks is correct rather
  // than a shortcut: the builder carries no network, which enters only through
  // the gRPC pool that reads anchors/nullifiers and broadcasts.
  //
  // ShieldedBuilderWASM memoises the raw builder on a private static, so this
  // would converge without injection — but a dependency's private static is not
  // a contract to rely on.
  warmup(): Promise<void> {
    if (this.warming != null) return this.warming
    this.warming = (async () => {
      const builder = new ShieldedBuilderWASM()
      await builder.init()
      this.builder = builder
      for (const network of NETWORKS) {
        await this.get(network).shielded.init(builder)
      }
    })().catch(err => {
      // Let a later request retry rather than caching the failure forever.
      this.warming = null
      throw err
    })
    return this.warming
  }
}
