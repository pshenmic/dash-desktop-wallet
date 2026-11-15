import {BroadcastService} from '../net/BroadcastService'
import {ChainStore} from '../store/ChainStore'
import {reverseHex} from '../utils/byteOrder'
import {describeChainDbError, isFatalChainDbError} from '../store/chainDbError'
import {
  CHAINDB_OPEN_ATTEMPTS,
  CHAINDB_OPEN_BACKOFF_MS,
  DEFAULT_PEER_PORT,
  GENESIS,
  LOCK_POOL_MAX_CONNECTIONS,
  LOCK_POOL_MIN_PEERS,
  LOCK_POOL_READY_PEERS,
} from '../constants'
import {PoolService} from '../net/PoolService'
import {PeerRegistry} from '../net/peerRegistry'
import {entryTarget} from '../net/peerAddress'
import {bulkPeerShare, peerOverridesKey} from '../net/peerOverrides'
import {dialProbe} from '../net/peerProbe'
import {HeaderSyncWorker} from './workers/HeaderSyncWorker'
import {CFilterSyncWorker} from './workers/CFilterSyncWorker'
import {MasternodeList} from './masternodeList'
import {Governance} from './governance'
import {LockWatcher} from './lockWatcher'
import type {ChainLock, HeaderSyncWorkerStatus} from '../types/headerSync'
import type {CFilterPhase, CFilterSyncWorkerStatus} from '../types/cfilterSync'
import {P2PAddWatchAddressesMessage, P2PBroadcastMessage, P2PListenMessage, P2PRelayVoteMessage, P2PReseedUtxosMessage, P2PStartMessage, P2PWatchProvidersMessage, P2PWatchTxsMessage} from '../types/messages'
import type {PayoutUpdate} from '../types/masternodeList'
import {Network} from '../../src/types/Network'
import {BroadcastResult} from '../types/broadcast'
import {AppliedBlock, GapExhausted, WalletSyncStatus, WatchAddress} from '../types/walletSync'
import {Message, Peer} from 'dash-core-p2p'
import {ChainTipState, PersistedHeader} from '../types/chainStore'
import {SyncServiceEvents} from '../types/sync'
import {PeerInfo, PeerOverrides, PeerProbeResult, PoolServiceOptions} from '../types/pool'
import {createSerializer} from '../utils/serializer'
import {Logger} from '../../src/utils/logger'

const log = new Logger('p2p')
const locks = new Logger('locks')

// Top-level controller for the p2p utility process: owns ChainStore and the
// pools, spawns workers per session, aggregates their status.
export class SyncService {
  private chainStore: ChainStore | null = null
  // relay:true, always up: lock watching + broadcast.
  private lockPool: PoolService | null = null
  private lockNetwork: Network | null = null
  // relay:false, p2p mode only: headers, cfilters, blocks. Null in static mode,
  // where the pinned peers serve both jobs from the one pool.
  private bulkPool: PoolService | null = null
  // What the workers read: the bulk pool, or the lock pool in static mode.
  private syncPool: PoolService | null = null
  // Both pools claim their sockets here, so a node one of them is connected to
  // is not dialled by the other.
  private readonly peerRegistry = new PeerRegistry()
  private lockOverridesKey: string | null = null
  // Held here rather than read off the overrides at construction: bans arrive
  // while the pools are running and must survive one being rebuilt.
  private banned: string[] = []
  private pinnedOnly = false
  // The user's peers the bulk pool borrowed, kept so they can go back.
  private lentPeers: string[] = []
  private headerSyncWorker: HeaderSyncWorker | null = null
  private cfilterSyncWorker: CFilterSyncWorker | null = null

  private activeWalletId: string | null = null
  private activeWatchAddresses: WatchAddress[] = []
  private cfilterStarted = false
  // Highest ChainLock observed — dedupes repeated clsig emits, and carries the
  // locked hash so a header sync starting later can check its own branch.
  private chainLock: ChainLock | null = null

  private readonly masternodeList: MasternodeList
  private readonly governance: Governance
  private readonly lockWatcher: LockWatcher

  private status: WalletSyncStatus = idleStatus()

  private phaseStart: {phase: WalletSyncStatus['phase']; startedAt: number; startHeight: number} | null = null

  constructor(private readonly events: SyncServiceEvents) {
    this.masternodeList = new MasternodeList({pool: () => this.lockPool, chain: () => this.chainStore, events})
    this.governance = new Governance({pool: () => this.lockPool, chain: () => this.chainStore, events})
    this.lockWatcher = new LockWatcher({
      pool: () => this.lockPool,
      network: () => this.lockNetwork,
      events,
      onBlockAnnounced: (peer, hash) => this.masternodeList.onBlockAnnounced(peer, hash),
      syncActive: () => this.syncPool != null,
    })
  }

  getStatus = (): WalletSyncStatus => this.status

  // Both pools: in dynamic mode they hold different peers, and in static mode
  // the bulk pool does not exist — the pinned one serves sync too.
  getConnectedPeers = (): PeerInfo[] => [
    ...this.lockPool?.peerInfo() ?? [],
    ...this.bulkPool?.peerInfo() ?? [],
  ]

  refreshMasternodes = (): void => {
    this.masternodeList.refresh()
  }

  // Proposals come from chain.db, so only p2p mode answers; votes go out in both.
  syncProposals = (): void => {
    this.governance.syncProposals()
  }

  syncProposalVotes = (proposalHash: string): void => {
    this.governance.syncVotes(proposalHash).catch(err => log.warn(`votes on ${proposalHash} failed:`, err))
  }

  // Main waits on the answer, so a throw has to become one.
  relayVote = (cmd: P2PRelayVoteMessage): void => {
    try {
      this.governance.voteRelay.relay(cmd.requestId, cmd.vote)
    } catch (err) {
      this.events.voteRelayed(cmd.requestId, 0, 0, err instanceof Error ? err.message : String(err))
    }
  }

  // A ready peer answered its handshake already; anything else is claimed for
  // the dial, since Core drops both connections on a second one from this host.
  probePeer = async (peer: string, network: Network): Promise<PeerProbeResult> => {
    const target = entryTarget(peer, DEFAULT_PEER_PORT[network])
    if (this.lockNetwork === network && this.getConnectedPeers().some(info => `${info.host}:${info.port}` === target)) {
      return {ok: true, error: null}
    }

    if (!this.peerRegistry.claim(target, this, this)) {
      return {ok: false, error: 'already connected from this host'}
    }
    try {
      return await dialProbe(peer, network)
    } finally {
      this.peerRegistry.release(target, this)
    }
  }

  setBannedPeers = (banned: string[]): void => {
    this.banned = banned
    this.lockPool?.setBanned(banned)
    this.bulkPool?.setBanned(banned)
  }

  // LevelDB is single-owner, so two near-simultaneous starts would race to open
  // chain.db and the loser fails the lock as LEVEL_DATABASE_NOT_OPEN.
  private readonly runExclusive = createSerializer()

  start = (cmd: P2PStartMessage): Promise<void> => this.runExclusive(() => this.startInner(cmd))

  stop = (): Promise<void> => this.runExclusive(() => this.stopInner())

  // `start` is a superset, so listening first and syncing later grows the
  // session rather than restarting it.
  listen = (cmd: P2PListenMessage): Promise<void> =>
    this.runExclusive(async () => {
      // Static-mode workers hold the pool being rebuilt, and a session on the old network
      // would check the new one's chainlocks against its headers; main's `stop` usually lands first.
      if (this.syncPool && (this.chainStore?.network !== cmd.network
        || this.lockOverridesKey !== peerOverridesKey(cmd.peerOverrides))) {
        log.info(`listen on ${cmd.network} with a different pool under a running session — stopping the sync layer`)
        await this.stopInner()
      }
      this.startLockCore(cmd.network, cmd.peerOverrides)
      this.lockWatcher.setAddresses(cmd.walletId ?? null, cmd.watchAddresses ?? [])
    })

  // Runs in rpc mode too and survives the bulk layer stopping, so lock waiters
  // outlive a mode switch. Network-scoped: a wallet switch keeps the filled pool.
  private startLockCore = (network: Network, overrides?: PeerOverrides): void => {
    if (overrides) this.setBannedPeers(overrides.bannedPeers)
    const overridesKey = peerOverridesKey(overrides)
    if (this.lockPool && this.lockNetwork === network && this.lockOverridesKey === overridesKey) {
      locks.info(`listen ${network}: pool settings unchanged, keeping ${this.lockPool.readyPeers.size} peer(s)`)
      return
    }

    this.teardownLock()
    this.lockNetwork = network
    this.lockOverridesKey = overridesKey
    this.lockWatcher.resetPool()
    this.chainLock = null
    this.masternodeList.resetPool()
    this.governance.resetPool()

    const pinned = overrides?.mode === 'static' ? overrides.staticPeers : []
    this.pinnedOnly = pinned.length > 0
    this.lockPool = new PoolService(network, this.lockPoolOptions(pinned, overrides))
    this.bindLockPoolEvents(this.lockPool)
    this.lockPool.start()
    // The pool the status reports on just changed, and in rpc mode nothing else
    // emits until a peer seats — which would leave the old mode on show.
    this.emit({})

    this.lockWatcher.startReporting()
  }

  // Sized to the pinned set exactly: there is nothing else to dial, so a
  // target above it would pin the pool in its refill branch forever.
  private lockPoolOptions(pinned: string[], overrides?: PeerOverrides): PoolServiceOptions {
    if (this.pinnedOnly) {
      return {
        registry: this.peerRegistry,
        banned: this.banned,
        label: 'static-pool',
        relay: true,
        pinnedOnly: true,
        peers: pinned,
        readyPeers: pinned.length,
        minPeers: pinned.length,
        maxConnections: pinned.length,
      }
    }
    return {
      registry: this.peerRegistry,
      banned: this.banned,
      label: 'lock-pool',
      relay: true,
      readyPeers: LOCK_POOL_READY_PEERS,
      minPeers: LOCK_POOL_MIN_PEERS,
      maxConnections: LOCK_POOL_MAX_CONNECTIONS,
      dnsSeeds: overrides?.dnsSeeds,
      peers: overrides?.dynamicPeers,
    }
  }

  private bindLockPoolEvents(pool: PoolService): void {
    pool.on('peerinv', this.lockWatcher.onInv)
    pool.on('peerisdlock', this.lockWatcher.onIsdlock)
    pool.on('peertx', this.lockWatcher.onTx)
    pool.on('peerclsig', this.onClsig)
    pool.on('peergetheaders', this.masternodeList.onPeerTip)
    pool.on('peermnlistdiff', this.masternodeList.onDiff)
    pool.on('peerblock', this.masternodeList.registry.onBlock)
    pool.on('peeraddr', this.feedBulkPool)
    pool.on('peerinv', this.governance.onInv)
    pool.on('peergovobj', this.governance.onObject)
    pool.on('peergovobjvote', this.governance.onVote)
    pool.on('peergetdata', this.governance.voteRelay.onGetData)
    pool.on('peerready', this.governance.onPeerReady)
    // Nothing else emits status while the bulk layer is down, so lock-pool
    // churn is a lazy-mode wallet's only signal.
    pool.on('peerready', this.onLockPeerChange)
    pool.on('peerdisconnect', this.onLockPeerChange)
  }

  private onLockPeerChange = (peer: Peer): void => {
    this.lockWatcher.onPeerChange(peer)
    this.emit({})
    this.feedBulkPool()
  }

  // The bulk pool has no DNS seed, so this is its only supply — driven off peer
  // events too, since at creation the lock pool's book is still just DNS entries.
  private feedBulkPool = (): void => {
    if (!this.bulkPool || !this.lockPool) return
    if (this.bulkPool.network !== this.lockPool.network) return
    this.bulkPool.addAddresses(this.lockPool.takeAddresses())
  }

  private startInner = async (cmd: P2PStartMessage): Promise<void> => {
    // Duplicate start (StrictMode double-invoke, overlapping auto-start).
    // Ignoring beats tearing down and re-opening chain.db.
    if (this.chainStore && this.activeWalletId === cmd.walletId) return

    await this.teardownBulk()
    this.startLockCore(cmd.network, cmd.peerOverrides)

    this.activeWalletId = cmd.walletId
    this.activeWatchAddresses = cmd.watchAddresses ?? []
    this.cfilterStarted = false
    this.lockWatcher.setAddresses(cmd.walletId, this.activeWatchAddresses)

    this.emit({
      ...idleStatus(),
      phase: 'connecting',
      network: cmd.network,
      walletId: cmd.walletId,
      cfilterScanHeight: cmd.cfilterCursor ?? 0,
    })

    const persisted = await this.openChainStore(cmd)
    if (persisted == null) return

    this.governance.open().catch(err => log.warn('governance load failed:', err))

    // Resume from persisted tip, or genesis on a fresh chain.db.
    let resumeHeight = persisted.tipHeight
    let resumeHash = persisted.tipHash
    log.info(`persisted state: height=${resumeHeight} hash=${resumeHash ?? 'null'}`)
    if (!resumeHash) {
      resumeHash = GENESIS[cmd.network].hash
      resumeHeight = GENESIS[cmd.network].height
      log.info(`genesis fallback: height=${resumeHeight} hash=${resumeHash}`)
    }
    log.info(`starting sync from height=${resumeHeight} hash=${resumeHash} watchAddresses=${this.activeWatchAddresses.length} birthday=${cmd.birthdayHeight && cmd.birthdayHeight > 0 ? cmd.birthdayHeight : 1} seedUtxos=${cmd.seedUtxos.length} unconfirmedInputs=${cmd.unconfirmedInputOutpoints.length} cursor=${cmd.cfilterCursor ?? 'null'}`)

    if (!this.selectSyncPool(cmd)) return
    this.buildCFilterWorker(cmd, resumeHeight, resumeHash)
    await this.wireHeaderWorker(this.chainStore!, this.syncPool!, resumeHeight, resumeHash)
  }

  // Single-owner LevelDB lock. Null when chain.db is unusable; the caller stops.
  private async openChainStore(cmd: P2PStartMessage): Promise<ChainTipState | null> {
    this.chainStore = new ChainStore(cmd.chainDbPath, cmd.network)
    try {
      return await this.openWithRetry(this.chainStore)
    } catch (err) {
      const code = (err as { code?: string }).code ?? 'unknown'
      const labelled = `chain.db unusable (${code}): ${describeChainDbError(err)}. Call resetWalletSync to recover.`
      await this.chainStore.close().catch(() => { /* ignore */ })
      this.chainStore = null
      this.emit({phase: 'stopped', lastError: labelled})
      this.events.error(labelled)
      return null
    }
  }

  private selectSyncPool(cmd: P2PStartMessage): boolean {
    if (this.pinnedOnly) {
      // One pool, both jobs: a second pool dialling the same pinned hosts would
      // drop both connections to every one of them.
      this.syncPool = this.lockPool
    } else {
      // `relay: false` drops the tx inv stream these workers never read; Core
      // gates ISLOCK/ISDLOCK behind the same flag, so locks stay on the other pool.
      this.lentPeers = bulkPeerShare(cmd.peerOverrides?.dynamicPeers)
      this.bulkPool = new PoolService(cmd.network, {
        registry: this.peerRegistry,
        banned: this.banned,
        label: 'bulk-pool',
        relay: false,
        dnsSeed: false,
        peers: this.lentPeers,
      })
      // Before the first dial: the lock pool has held these since boot, and the
      // registry hands a contested node to whoever claimed it first.
      this.lockPool?.dropPeers(this.lentPeers)
      this.feedBulkPool()
      this.bulkPool.start()
      this.syncPool = this.bulkPool
    }
    if (!this.syncPool) {
      const message = 'peer pool failed to start'
      this.emit({phase: 'stopped', lastError: message})
      this.events.error(message)
      return false
    }
    return true
  }

  // CFilterSyncWorker boots lazily once header sync reports 'synced', so the
  // two never compete for chain.db state mid-sync.
  private async wireHeaderWorker(chainStore: ChainStore, syncPool: PoolService, resumeHeight: number, resumeHash: string): Promise<void> {
    this.headerSyncWorker = new HeaderSyncWorker({
      chainStore,
      peerPool: syncPool,
      initialTipHeight: resumeHeight,
      initialTipHash: resumeHash,
      chainLock: this.chainLock,
    })
    this.headerSyncWorker.on('status', (s: HeaderSyncWorkerStatus) => this.onHeaderStatus(s))
    this.headerSyncWorker.on('chainExtended', (headers: PersistedHeader[]) => {
      this.cfilterSyncWorker?.onChainExtended(headers)
      if (this.status.phase !== 'syncing-headers') this.masternodeList.followTip(headers.at(-1)!.hash)
    })
    this.headerSyncWorker.on('chainRewound', (height: number) => {
      this.cfilterSyncWorker?.onChainRewound(height)
      if (this.activeWalletId) this.events.chainRewound(this.activeWalletId, height)
      this.masternodeList.rewound(height)
    })
    this.headerSyncWorker.on('error', err =>
      this.handleWorkerError('HeaderSyncWorker', err.message)
    )
    await this.headerSyncWorker.start()
  }

  private stopInner = async (): Promise<void> => {
    await this.teardownBulk()
    this.activeWalletId = null
    this.activeWatchAddresses = []
    this.emit({...idleStatus(), phase: 'stopped', lastError: this.status.lastError})
  }

  private async openWithRetry(store: ChainStore): Promise<ChainTipState> {
    let lastErr: unknown
    for (let attempt = 1; attempt <= CHAINDB_OPEN_ATTEMPTS; attempt++) {
      try {
        await store.open()
        return await store.initSyncState()
      } catch (err) {
        lastErr = err
        await store.close().catch(() => { /* ignore */ })
        if (attempt === CHAINDB_OPEN_ATTEMPTS) break
        log.warn(`chain.db open attempt ${attempt}/${CHAINDB_OPEN_ATTEMPTS} failed, retrying: ${describeChainDbError(err)}`)
        await new Promise(resolve => setTimeout(resolve, CHAINDB_OPEN_BACKOFF_MS))
      }
    }
    throw lastErr
  }

  broadcast = (cmd: P2PBroadcastMessage): void => {
    const emptyResult: BroadcastResult = {
      txid: '',
      peersInvited: 0,
      peersAcked: [],
      peersDelivered: [],
      peersPropagated: [],
      instantLocked: false,
      islockHex: null,
      lockLatencyMs: null,
      waitedForLock: false,
      rejections: [],
      durationMs: 0,
    }
    if (!this.lockPool) {
      this.events.broadcastResult(cmd.requestId, false, emptyResult, 'broadcast: peer pool not started')
      return
    }
    // The lock pool, so the isdlock for this tx arrives on the connections we
    // announced it to.
    const service = new BroadcastService(this.lockPool)
    service.broadcast(cmd.txHex, cmd.policy).then(result => {
      this.events.broadcastResult(cmd.requestId, true, result, null)
    }).catch(err => {
      const message = err instanceof Error ? err.message : String(err)
      const result = (err as {result?: BroadcastResult}).result ?? emptyResult
      this.events.broadcastResult(cmd.requestId, false, result, message)
    })
  }

  addWatchAddresses = (cmd: P2PAddWatchAddressesMessage): void => {
    if (!this.activeWalletId || cmd.walletId !== this.activeWalletId) return
    const merged = new Map(this.activeWatchAddresses.map(a => [a.address, a]))
    for (const a of cmd.addresses) merged.set(a.address, a)
    this.activeWatchAddresses = [...merged.values()]
    if (this.lockWatcher.holdsWallet(cmd.walletId)) {
      this.lockWatcher.setAddresses(cmd.walletId, this.activeWatchAddresses)
    }
    this.cfilterSyncWorker?.addWatchAddresses(cmd.addresses, cmd.rewindToHeight)
  }

  watchProviders = (cmd: P2PWatchProvidersMessage): void => {
    if (!this.activeWalletId || cmd.walletId !== this.activeWalletId) return
    this.cfilterSyncWorker?.watchProviders(cmd.proTxHashes, cmd.rewindToHeight)
  }

  reseedUtxos = (cmd: P2PReseedUtxosMessage): void => {
    if (cmd.walletId !== this.activeWalletId) return
    this.cfilterSyncWorker?.reseedUtxos(cmd.utxos, cmd.unconfirmedInputOutpoints)
  }

  watchTxs = (cmd: P2PWatchTxsMessage): void => this.lockWatcher.watchTxs(cmd)

  // ── lock watcher ────────────────────────────────────────────────────────────


  private onClsig = (_peer: Peer, msg: Message & {height?: number; blockHash?: string}): void => {
    if (!this.lockNetwork) return
    const height = msg.height ?? 0
    if (this.chainLock != null && height <= this.chainLock.height) return

    const hash = reverseHex(msg.blockHash ?? '')
    // The height alone cannot say which branch is locked, and the all-zero
    // default reads as a block nobody holds.
    if (hash.length !== 64 || !/[1-9a-f]/.test(hash)) {
      locks.warn(`chainlock h=${height} carries no block hash — ignored`)
      return
    }

    this.chainLock = {height, hash}
    this.headerSyncWorker?.noteChainLock(height, hash)
    locks.info(`chainlock h=${height} ${hash} — ${this.headerSyncWorker ? 'checking our branch' : 'no header sync'}`)
    this.events.chainLocked(this.lockNetwork, height)
  }

  // ── private ───────────────────────────────────────────────────────────────

  private async teardownBulk(): Promise<void> {
    if (this.cfilterSyncWorker) {
      this.cfilterSyncWorker.stop()
      this.cfilterSyncWorker.removeAllListeners()
      this.cfilterSyncWorker = null
    }
    if (this.headerSyncWorker) {
      this.headerSyncWorker.stop()
      this.headerSyncWorker.removeAllListeners()
      this.headerSyncWorker = null
    }
    if (this.bulkPool) {
      // Addresses move rather than copy, so by now the lock pool's whole surplus
      // lives here, and a lock pool long past gossiping has no other source.
      if (this.lockPool && this.lockPool.network === this.bulkPool.network) {
        this.lockPool.addAddresses(this.bulkPool.takeAddresses(0))
        // takeAddresses moves what is spare, and a lent peer is the one entry
        // here most likely to be connected — so it is handed back by name.
        this.lockPool.addPeers(this.lentPeers)
      }
      this.lentPeers = []
      this.bulkPool.stop()
      this.bulkPool.removeAllListeners()
      this.bulkPool = null
    }
    this.syncPool = null
    this.masternodeList.closeChain()
    this.governance.closeChain()
    if (this.chainStore) {
      await this.chainStore.close().catch(() => { /* ignore */ })
      this.chainStore = null
    }
    this.cfilterStarted = false
  }

  private teardownLock(): void {
    this.lockNetwork = null
    this.lockOverridesKey = null
    if (this.syncPool === this.lockPool) this.syncPool = null
    if (!this.lockPool) return
    this.lockPool.stop()
    this.lockPool.removeAllListeners()
    this.lockPool = null
  }

  private emit(next: Partial<WalletSyncStatus>): void {
    const merged = {...this.status, ...next, updatedAt: Date.now()}
    // Owned here rather than by the workers: the pools outlive them, and fill
    // with peers through phases no worker is running in.
    merged.lockPeerCount = this.lockPool?.readyPeers.size ?? 0
    merged.peerMode = this.lockPool == null ? null : this.pinnedOnly ? 'static' : 'dynamic'
    merged.filterCapablePeerCount = this.syncPool?.filterCapablePeers.size ?? 0
    merged.phaseEtaMs = this.computePhaseEta(merged)
    this.status = merged
    this.events.status(this.status)
  }

  // Extrapolates from height progress since the phase started. null for phases
  // with no height target, and until there is a usable rate sample.
  private computePhaseEta(status: WalletSyncStatus): number | null {
    const target = phaseTargetHeight(status)
    const current = phaseCurrentHeight(status)
    if (target == null || current == null) {
      this.phaseStart = null
      return null
    }

    const now = status.updatedAt
    if (!this.phaseStart || this.phaseStart.phase !== status.phase) {
      this.phaseStart = {phase: status.phase, startedAt: now, startHeight: current}
      return null
    }

    const elapsed = now - this.phaseStart.startedAt
    const delta = current - this.phaseStart.startHeight
    const remaining = target - current
    if (elapsed < 1000 || delta <= 0 || remaining <= 0) return null

    return Math.round((remaining * elapsed) / delta)
  }

  private onHeaderStatus(s: HeaderSyncWorkerStatus): void {
    this.emit({
      phase: this.headerPhase(s),
      tipHeight: s.tipHeight,
      tipHash: s.tipHash,
      estimatedChainHeight: s.estimatedChainHeight,
      peerCount: s.peerCount,
    })

    if (s.phase === 'synced' && !this.cfilterStarted && this.chainStore && this.syncPool && s.tipHash) {
      this.cfilterStarted = true
      this.cfilterSyncWorker?.start().catch(err =>
        this.handleWorkerError('CFilterSyncWorker', err instanceof Error ? err.message : String(err))
      )
      this.masternodeList.followTip(s.tipHash)
    }
  }

  // Once cfilter takes over, leave its phase alone — header tip-follow
  // updates only push tipHeight, not phase.
  private headerPhase(s: HeaderSyncWorkerStatus): WalletSyncStatus['phase'] {
    if (this.cfilterStarted) return this.status.phase
    switch (s.phase) {
      case 'connecting':
      case 'syncing-headers':
      case 'stopped': return s.phase
      default: return 'synced-headers'
    }
  }

  // Built with the session so the scan state has one owner from the start; the
  // network boot waits for header sync in onHeaderStatus.
  private buildCFilterWorker(cmd: P2PStartMessage, resumeHeight: number, resumeHash: string): void {
    this.cfilterSyncWorker = new CFilterSyncWorker({
      network: cmd.network,
      walletId: cmd.walletId,
      chainStore: this.chainStore!,
      peerPool: this.syncPool!,
      chainTipHeight: resumeHeight,
      chainTipHashDisplayHex: resumeHash,
      watchAddresses: cmd.watchAddresses ?? [],
      gapLimit: cmd.gapLimit,
      birthdayHeight: cmd.birthdayHeight && cmd.birthdayHeight > 0 ? cmd.birthdayHeight : 1,
      seedUtxos: cmd.seedUtxos,
      unconfirmedInputOutpoints: cmd.unconfirmedInputOutpoints,
      cfilterCursor: cmd.cfilterCursor,
      watchedProviders: cmd.watchedProviders,
      foreignBlock: hashWire => this.masternodeList.registry.owns(hashWire),
    })
    this.cfilterSyncWorker.on('status', (s: CFilterSyncWorkerStatus) => this.onCFilterStatus(s))
    this.cfilterSyncWorker.on('blockApplied', (block: AppliedBlock) => this.events.blockApplied(block))
    this.cfilterSyncWorker.on('payoutUpdates', (updates: PayoutUpdate[]) =>
      this.masternodeList.registry.applyPayouts(updates).catch(err => log.warn('payout update failed:', err)))
    this.cfilterSyncWorker.on('cursorAdvanced', (msg: {walletId: string; height: number}) =>
      this.events.cursorAdvanced(msg.walletId, msg.height)
    )
    this.cfilterSyncWorker.on('cursorReset', (msg: {walletId: string; height: number}) =>
      this.events.cursorReset(msg.walletId, msg.height)
    )
    this.cfilterSyncWorker.on('gapExhausted', (gap: GapExhausted) => this.events.gapExhausted(gap))
    this.cfilterSyncWorker.on('error', err =>
      this.handleWorkerError('CFilterSyncWorker', err.message)
    )
  }

  private onCFilterStatus(s: CFilterSyncWorkerStatus): void {
    this.emit({
      phase: this.cfilterPhase(s.phase),
      cfheadersHeight: s.cfheadersHeight,
      cfilterScanHeight: s.cfilterScanHeight,
      matchedBlocksPending: s.matchedBlocksPending,
      peerCount: Math.max(this.status.peerCount, s.peerCount),
    })
  }

  private cfilterPhase(phase: CFilterPhase): WalletSyncStatus['phase'] {
    switch (phase) {
      case 'connecting':
      case 'cfcheckpt': return 'syncing-cfcheckpt'
      case 'cfheaders': return 'syncing-cfheaders'
      case 'cfilters': return 'syncing-cfilters'
      case 'synced': return 'synced'
      case 'stopped': return 'stopped'
    }
  }

  private handleWorkerError(workerName: string, message: string): void {
    const fatal = isFatalChainDbError(message)
    const err = fatal
      ? `[${workerName}] chain.db unusable: ${message}. Call resetWalletSync to recover.`
      : `[${workerName}] ${message}`
    log.error(err)
    this.status = {...this.status, lastError: err, updatedAt: Date.now()}
    this.events.status(this.status)
    this.events.error(err)
    if (fatal) {
      // Bulk layer only — a header/cfilter failure says nothing about the lock
      // pool, and dropping it would strand anything waiting on an isdlock.
      this.teardownBulk()
        .catch(() => { /* ignore */ })
        .finally(() => this.emit({phase: 'stopped'}))
    }
  }
}

function idleStatus(): WalletSyncStatus {
  return {
    phase: 'idle',
    network: null,
    walletId: null,
    tipHeight: 0,
    tipHash: null,
    estimatedChainHeight: 0,
    cfheadersHeight: 0,
    cfilterScanHeight: 0,
    matchedBlocksPending: 0,
    peerCount: 0,
    filterCapablePeerCount: 0,
    lockPeerCount: 0,
    peerMode: null,
    phaseEtaMs: null,
    lastError: null,
    updatedAt: Date.now(),
  }
}

function phaseCurrentHeight(s: WalletSyncStatus): number | null {
  switch (s.phase) {
    case 'syncing-headers': return s.tipHeight
    case 'syncing-cfheaders': return s.cfheadersHeight
    case 'syncing-cfilters': return s.cfilterScanHeight
    default: return null
  }
}

function phaseTargetHeight(s: WalletSyncStatus): number | null {
  switch (s.phase) {
    case 'syncing-headers': return s.estimatedChainHeight > 0 ? s.estimatedChainHeight : null
    case 'syncing-cfheaders': return s.tipHeight > 0 ? s.tipHeight : null
    case 'syncing-cfilters': return s.tipHeight > 0 ? s.tipHeight : null
    default: return null
  }
}
