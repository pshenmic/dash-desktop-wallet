import {DashPlatformSDK, GRPCConnectionPool} from 'dash-platform-sdk'
import {LATEST_PLATFORM_VERSION} from 'dash-platform-sdk/src/constants.js'
import {PlatformVersionWASM, ShieldedBuilderWASM} from 'pshenmic-dpp'
import {Network} from '../src/types/Network'
import {Logger} from '../src/utils/logger'
import {majorityVersionNodes} from '../src/utils/majorityVersionNodes'
import {versionCheckDelay} from '../src/utils/versionCheckDelay'

import {
  DAPI_POOL_READY,
  DAPI_REPROBE_MS,
  EPOCH_BOUNDARY_GAP_MS,
  EPOCH_BOUNDARY_POLL_MS,
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
  private readonly epochNumbers = new Map<Network, number>()
  private readonly epochBoundaries = new Map<Network, number>()
  private readonly refills = new Set<Network>()
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
    if ((this.dapi.mode === 'static' && this.dapi[network].length > 0) || this.refills.has(network)) return
    const dapiUrls = this.latestDapiUrls.get(network)
    log.warn(`${network}: every evonode is banned, refilling the pool`)
    if (dapiUrls == null) {
      this.sdks.delete(network)
      return
    }
    this.refills.add(network)
    void this.probe(network, dapiUrls).finally(() => this.refills.delete(network))
  }

  // Pins the first batches that fill a pool, then every evonode that answered, to
  // spread requests across all of them.
  private async probe(network: Network, dapiUrls: string[]): Promise<string[]> {
    log.info(`${network}: probing ${dapiUrls.length} evonode(s)`)
    let ready: string[] = []
    const reachable = majorityVersionNodes(await dapiUrlsByProtocolVersion(dapiUrls, network, byVersion => {
      const majority = majorityVersionNodes(byVersion)
      if (ready.length === 0 && majority.length >= DAPI_POOL_READY) {
        ready = majority
        this.pin(network, majority)
      }
      return false
    }))
    if (reachable.length > ready.length) this.pin(network, reachable)
    return reachable
  }

  // The first operation on a network starts its checks; they then run in the background.
  platformVersion(network: Network): Promise<PlatformVersionWASM> {
    if (!this.platformVersions.has(network)) this.checkPlatformVersion(network)
    return this.platformVersions.get(network)!
  }

  // The version the network runs, capped at the newest this SDK knows: upgrades
  // are mostly backward compatible. A failed check keeps the version already known.
  private checkPlatformVersion(network: Network): void {
    const known = this.platformVersions.get(network)
    const dapiUrls = this.latestDapiUrls.get(network)
    const boundary = this.epochBoundaries.get(network)
    const atBoundary = dapiUrls != null && boundary != null && Math.abs(Date.now() - boundary) <= EPOCH_BOUNDARY_GAP_MS
    const running = atBoundary ? this.quorumProtocolVersion(network, dapiUrls) : this.epochProtocolVersion(network)
    const capped = running.then(version => Math.min(version, LATEST_PLATFORM_VERSION), () => known ?? LATEST_PLATFORM_VERSION)
    this.platformVersions.set(network, capped)

    running
      .then(async version => {
        if (known == null || await capped !== await known) {
          log.info(`${network} runs protocol ${version}${version > LATEST_PLATFORM_VERSION ? `, newer than this SDK's ${LATEST_PLATFORM_VERSION}` : ''}`)
          // Nodes that did not follow the upgrade drop out of the pool.
          if (known != null && dapiUrls != null) void this.probe(network, dapiUrls)
        }
        return versionCheckDelay(Date.now(), this.epochBoundaries.get(network)!, EPOCH_BOUNDARY_GAP_MS, EPOCH_BOUNDARY_POLL_MS, VERSION_CHECK_MS)
      })
      .catch(err => {
        log.warn(`${network}: protocol version check failed:`, err)
        return EPOCH_BOUNDARY_POLL_MS
      })
      .then(delay => setTimeout(() => this.checkPlatformVersion(network), delay).unref?.())
  }

  // Also estimates the next epoch boundary from the length of the last epoch.
  private async epochProtocolVersion(network: Network): Promise<number> {
    const [last, current] = (await this.get(network).node.getEpochsInfo(2, false)).sort((a, b) => a.number - b.number)
    // A node still catching up answers an epoch the network has left.
    const seen = this.epochNumbers.get(network) ?? 0
    if (current!.number < seen) throw new Error(`a node answered epoch ${current!.number}, behind ${seen}`)
    this.epochNumbers.set(network, current!.number)
    this.epochBoundaries.set(network, 2 * Number(current!.startTime) - Number(last!.startTime))
    const version = Number(current!.protocolVersion)
    if (!Number.isInteger(version)) throw new Error(`epoch reports protocol version ${String(current!.protocolVersion)}`)
    return version
  }

  // At an epoch boundary the version is read from the validators executing the
  // blocks, not from a single node of the pool that may lag behind them.
  private async quorumProtocolVersion(network: Network, dapiUrls: string[]): Promise<number> {
    const byVersion = await dapiUrlsByProtocolVersion(dapiUrls, network, found => majorityVersionNodes(found).length >= DAPI_POOL_READY)
    const majority = majorityVersionNodes(byVersion)
    const version = [...byVersion].find(([, nodes]) => nodes === majority)?.[0]
    if (version == null) throw new Error(`none of ${dapiUrls.length} evonode(s) answered`)
    return version
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
