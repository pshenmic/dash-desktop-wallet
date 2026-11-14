import {Inventory, Message, Peer} from 'dash-core-p2p'
import {Transaction as SDKTransaction} from 'dash-core-sdk'
import {
  MEMPOOL_FETCH_BATCH,
  MEMPOOL_FETCH_INTERVAL_MS,
  MEMPOOL_REPORT_INTERVAL_MS,
  MEMPOOL_SEEN_LIMIT,
  MEMPOOL_SNAPSHOT_PEERS,
  NODE_BLOOM,
} from '../constants'
import {reverseHex, wireToDisplayHex} from '../utils/byteOrder'
import type {LockWatcherOptions} from '../types/sync'
import type {InventoryMessage} from '../types/governance'
import type {P2PWatchTxsMessage} from '../types/messages'
import type {AppliedTx, WatchAddress} from '../types/walletSync'
import {BoundedSet} from '../utils/boundedSet'
import {Logger} from '../../src/utils/logger'

const locks = new Logger('locks')

// Mempool and lock watching on the lock pool: matches incoming txs against the
// wallet's addresses, fetches isdlocks for armed txids and clsigs while anything
// waits on finality. Runs in rpc mode too, where no chain sync exists.
export class LockWatcher {
  private walletId: string | null = null
  private addresses = new Set<string>()
  private seen = new BoundedSet<string>(MEMPOOL_SEEN_LIMIT)
  private requests = new Set<Peer>()
  private fetchQueue: Array<{peer: Peer; txid: string; hash: Uint8Array}> = []
  private stats = {announced: 0, fetched: 0, matched: 0}
  private reportTimer: ReturnType<typeof setInterval> | null = null
  // Display order, not wire order. While non-empty the watcher fetches isdlock
  // objects to match against it.
  private watchedTxids = new Set<string>()

  constructor(private readonly opts: LockWatcherOptions) {}

  // The lock pool is network-scoped and survives a wallet switch, so its match
  // set is replaced wholesale rather than merged.
  setAddresses = (walletId: string | null, addresses: WatchAddress[]): void => {
    const next = new Set(addresses.map(a => a.address))
    const changed = this.walletId !== walletId
      || next.size !== this.addresses.size
      || [...next].some(address => !this.addresses.has(address))
    if (!changed) return

    this.walletId = walletId
    this.addresses = next
    this.seen.clear()
    this.requests.clear()
    this.fetchQueue = []
    // A wallet selected after the pool filled, or switched to: the peers that
    // seated were asked against the previous address set, or against none.
    for (const peer of this.opts.pool()?.readyPeers ?? []) this.requestMempool(peer)
  }

  holdsWallet(walletId: string): boolean {
    return this.walletId === walletId
  }

  // A new lock pool may be on another network: armed txids and the mempool
  // bookkeeping belong to the old one.
  resetPool(): void {
    this.watchedTxids = new Set()
    if (this.reportTimer) clearInterval(this.reportTimer)
    this.reportTimer = null
    this.fetchQueue = []
    this.requests.clear()
  }

  startReporting(): void {
    this.reportTimer = setInterval(this.report, MEMPOOL_REPORT_INTERVAL_MS)
    this.reportTimer.unref?.()
  }

  watchTxs = (cmd: P2PWatchTxsMessage): void => {
    const before = this.watchedTxids.size
    if (cmd.mode === 'replace') {
      this.watchedTxids = new Set(cmd.txids)
    } else {
      for (const txid of cmd.txids) this.watchedTxids.add(txid)
    }
    // A wallet with nothing unconfirmed re-sends an empty replace on every
    // refresh; only a change in what is armed says anything.
    if (this.watchedTxids.size === 0 && before === 0) return
    locks.debug(`watchTxs ${cmd.mode} (${this.watchedTxids.size}): ${[...this.watchedTxids].join(',') || '(none)'}`)
  }

  onPeerChange = (peer: Peer): void => {
    const pool = this.opts.pool()
    if (!pool?.readyPeers.has(peer)) this.requests.delete(peer)
    if (pool?.readyPeers.size === 0) this.requests.clear()
    for (const ready of pool?.readyPeers ?? []) this.requestMempool(ready)
  }

  // An inv carries only the object's hash, so matching by txid means issuing a
  // getdata to read its contents.
  onInv = (peer: Peer, msg: InventoryMessage): void => {
    const pool = this.opts.pool()
    if (!pool) return
    // With no waiter and no sync layer to mark txs final, fetching one per
    // block is permanent background cost for nothing.
    const wantChainlocks = this.watchedTxids.size > 0 || this.opts.syncActive()
    const wanted: Array<{type: number; hash: Uint8Array}> = []
    // A queue with entries in it already has a drain pending, and an arrival
    // waits for that tick rather than jumping the pacing.
    const idle = this.fetchQueue.length === 0
    for (const item of msg.inventory ?? []) {
      switch (item.type) {
        case Inventory.TYPE.TX: {
          // An inv carries no outputs, so telling whether a tx pays us means
          // fetching it. Every peer announces the same one, hence the seen set.
          this.stats.announced++
          if (this.addresses.size === 0) break
          const txid = wireToDisplayHex(item.hash)
          if (this.seen.has(txid)) break
          this.seen.add(txid)
          this.fetchQueue.push({peer, txid, hash: item.hash})
          break
        }
        case Inventory.TYPE.BLOCK:
          this.opts.onBlockAnnounced(peer, wireToDisplayHex(item.hash))
          break
        case Inventory.TYPE.CLSIG:
          if (wantChainlocks) wanted.push({type: item.type, hash: item.hash})
          break
        case Inventory.TYPE.ISDLOCK: {
          const hashHex = wireToDisplayHex(item.hash)
          if (this.watchedTxids.size > 0) {
            locks.debug(`isdlock inv ${hashHex} — requesting getdata (watching ${this.watchedTxids.size})`)
            wanted.push({type: item.type, hash: item.hash})
          } else {
            locks.debug(`isdlock inv ${hashHex} — skipped, watch set empty`)
          }
          break
        }
      }
    }
    // Locks go out with this inv rather than through the queue: there are a
    // handful of them and a delayed one is a delayed confirmation.
    if (wanted.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      peer.sendMessage((pool.messages as any).GetData(wanted))
    }
    if (idle && this.fetchQueue.length > 0) this.fetchQueued()
  }

  // isdlock.txid is wire/internal byte order; our watch set is display order.
  onIsdlock = (_peer: Peer, msg: Message & {txid?: string}): void => {
    if (!msg.txid) {
      locks.info('isdlock received without a txid')
      return
    }
    const displayTxid = reverseHex(msg.txid)
    const matched = this.watchedTxids.has(displayTxid)
    locks.debug(`isdlock received wire=${msg.txid} display=${displayTxid} matched=${matched} watching=[${[...this.watchedTxids].join(',')}]`)
    if (!matched) return
    this.watchedTxids.delete(displayTxid)
    // Serialized for InstantAssetLockProof construction in main. We broadcast L1
    // over this pool, so DAPI's subscribeToTransactions never delivers this lock.
    const islockHex = Buffer.from((msg as unknown as {getPayload(): Uint8Array}).getPayload()).toString('hex')
    this.opts.events.txInstantLocked(displayTxid, islockHex)
  }

  // Outputs are matched here rather than in main so a mempool we mostly do not
  // care about never crosses the process boundary.
  onTx = (_peer: Peer, msg: Message & {transaction?: unknown}): void => {
    const network = this.opts.network()
    if (!network || !this.walletId || this.addresses.size === 0) return

    const tx = msg.transaction as SDKTransaction | undefined
    if (!tx || tx.outputs.length === 0) return

    const label = network === 'mainnet' ? 'Mainnet' : 'Testnet'
    const outputs = tx.outputs.map((output, vout) => {
      const address = output.getAddress(label) ?? null
      return {
        vout,
        address,
        satoshis: output.satoshis.toString(),
        isMine: address != null && this.addresses.has(address),
      }
    })
    if (!outputs.some(o => o.isMine)) return

    const applied: AppliedTx = {
      txid: tx.hash(),
      raw: tx.bytes(),
      inputs: tx.inputs.map((input, vin) => ({
        vin,
        prevTxid: input.txId,
        prevVout: input.vOut,
        sequence: input.sequence,
      })),
      outputs,
    }
    this.stats.matched++
    locks.info(`incoming mempool tx ${applied.txid} paying ${outputs.filter(o => o.isMine).length} of our output(s)`)
    this.opts.events.incomingTx(this.walletId, applied)
  }

  // A peer announces a tx once, when it first relays it, so one already in the
  // mempool when this session starts is otherwise only seen in a block.
  private requestMempool(peer: Peer): void {
    const pool = this.opts.pool()
    if (!pool || this.addresses.size === 0) return
    if (this.requests.size >= MEMPOOL_SNAPSHOT_PEERS || this.requests.has(peer)) return
    // A node started without bloom filters disconnects on the request.
    if (((pool.peerServices.get(peer) ?? 0n) & BigInt(NODE_BLOOM)) === 0n) return
    this.requests.add(peer)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    peer.sendMessage((pool.messages as any).MemPool())
    locks.info(`mempool requested from ${peer.host}:${peer.port}`)
  }

  // A `mempool` answer carries the peer's whole pool in one inv, so asking for
  // all of it at once is the session's largest burst.
  private fetchQueued = (): void => {
    const pool = this.opts.pool()
    if (!pool) return
    const byPeer = new Map<Peer, Array<{type: number; hash: Uint8Array}>>()
    for (const entry of this.fetchQueue.splice(0, MEMPOOL_FETCH_BATCH)) {
      // Only the peer that announced it is known to hold it. It left, so the
      // txid is un-seen for the next announcement to fetch.
      if (!pool.readyPeers.has(entry.peer)) {
        this.seen.delete(entry.txid)
        continue
      }
      const items = byPeer.get(entry.peer) ?? []
      items.push({type: Inventory.TYPE.TX, hash: entry.hash})
      byPeer.set(entry.peer, items)
    }
    for (const [peer, items] of byPeer) {
      this.stats.fetched += items.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      peer.sendMessage((pool.messages as any).GetData(items))
    }

    if (this.fetchQueue.length === 0) return
    setTimeout(this.fetchQueued, MEMPOOL_FETCH_INTERVAL_MS).unref?.()
  }

  // Counts rather than per-tx lines: a busy mainnet mempool would be thousands
  // of lines an hour, and `watching 0` is a wallet that never sent its addresses.
  private report = (): void => {
    const {announced, fetched, matched} = this.stats
    this.stats = {announced: 0, fetched: 0, matched: 0}
    locks.info(
      `mempool watch: ${announced} announced, ${fetched} fetched, ${matched} ours ` +
      `(watching ${this.addresses.size} address(es))`,
    )
  }
}
