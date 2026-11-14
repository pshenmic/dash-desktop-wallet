import {Peer, RejectInfo, TxBroadcast} from 'dash-core-p2p'
import {Transaction} from 'dash-core-sdk'
import {BROADCAST_POLICY} from '../constants'
import {PoolService} from './PoolService'
import {BroadcastPolicyOverrides, BroadcastResult} from '../types/broadcast'

// Policy layer over dash-core-p2p's TxBroadcast, which owns the wire protocol
// (inv, getdata, push, reject/islock watching).
//
// Runs on the lock pool (relay=true), so propagation back to us and the isdlock
// can both land here — but only while SyncService's watcher holds our txid,
// since a peer sends the lock object only in answer to a getdata for its inv.

function peerLabel(peer: Peer): string {
  return `${peer.host}:${peer.port}`
}

export class BroadcastService {
  constructor(private readonly peerPool: PoolService) {}

  broadcast = (txHex: string, overrides?: BroadcastPolicyOverrides): Promise<BroadcastResult> => {
    let tx: Transaction
    try {
      tx = Transaction.fromHex(txHex)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return Promise.reject(new Error(`broadcast: failed to parse tx hex: ${message}`))
    }
    return this.run(tx, overrides)
  }

  private run(tx: Transaction, overrides?: BroadcastPolicyOverrides): Promise<BroadcastResult> {
    const session = new TxBroadcast(this.peerPool.pool, tx)
    return new BroadcastSession(this.peerPool, session, overrides).run()
  }
}

// One broadcast attempt: carries the tx to enough peers, then waits for positive
// evidence it entered a mempool — a witness announcing the txid back, or a lock.
class BroadcastSession {
  private settled = false
  private rebroadcastsLeft: number
  private readonly timers: ReturnType<typeof setTimeout>[] = []
  private readonly intervals: ReturnType<typeof setInterval>[] = []
  private readonly pushTimers = new Map<Peer, ReturnType<typeof setTimeout>>()
  private islockHex: string | null = null
  private lockedAt: number | null = null
  // Held back for the life of the session: a witness that gets an inv from
  // us stops being able to answer the only question we have.
  private readonly witnesses = new Set<Peer>()
  private readonly startedAt = Date.now()
  private readonly minPeerAcks: number
  private readonly peerWaitMs: number
  private readonly rebroadcastMs: number
  private readonly witnessPeers: number
  private readonly maxRebroadcasts: number
  private readonly unsolicitedAfterMs: number
  private readonly failOnReject: boolean
  private readonly waitForIs: boolean
  private readonly requireIs: boolean
  private readonly timeoutMs: number
  private resolve!: (result: BroadcastResult) => void
  private reject!: (err: Error) => void

  constructor(
    private readonly peerPool: PoolService,
    private readonly session: TxBroadcast,
    overrides?: BroadcastPolicyOverrides,
  ) {
    this.minPeerAcks = BROADCAST_POLICY.minPeerAcks
    this.peerWaitMs = BROADCAST_POLICY.peerWaitMs
    this.rebroadcastMs = BROADCAST_POLICY.rebroadcastIntervalMs
    this.witnessPeers = BROADCAST_POLICY.witnessPeers
    this.maxRebroadcasts = BROADCAST_POLICY.maxRebroadcasts
    this.rebroadcastsLeft = BROADCAST_POLICY.maxRebroadcasts
    this.unsolicitedAfterMs = BROADCAST_POLICY.unsolicitedPushAfterMs
    this.failOnReject = BROADCAST_POLICY.failOnReject
    this.waitForIs = overrides?.waitForInstantLock ?? BROADCAST_POLICY.waitForInstantLock
    this.requireIs = overrides?.requireInstantLock ?? BROADCAST_POLICY.requireInstantLock
    this.timeoutMs = overrides?.timeoutMs ?? BROADCAST_POLICY.timeoutMs
  }

  run(): Promise<BroadcastResult> {
    return new Promise<BroadcastResult>((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject

      this.session.on('request', () => this.checkDone())
      this.session.on('sent', () => this.checkDone())
      this.session.on('propagated', () => this.checkDone())
      // Same lock under two names: current Dash Core serializes it as isdlock
      // (DIP-24), older peers as islock.
      this.session.on('islock', this.onLock)
      this.session.on('isdlock', this.onLock)
      this.session.on('reject', (info: RejectInfo) => {
        if (this.failOnReject) {
          this.fail(`peer ${peerLabel(info.peer)} rejected tx (ccode=0x${info.ccode.toString(16)}: ${info.reason})`)
        }
      })
      this.peerPool.on('peerready', this.onPeerReady)

      const initial = this.inviteNewPeers()

      if (initial === 0 && this.peerPool.pool.numberConnected() === 0) {
        this.timers.push(setTimeout(() => {
          if (this.settled) return
          if (this.session.invSentTo.size === 0) {
            this.fail(`no ready peers within ${this.peerWaitMs}ms`)
          }
        }, this.peerWaitMs))
      }

      this.timers.push(setTimeout(() => this.onTimeout(), this.timeoutMs))

      if (this.rebroadcastMs > 0 && this.maxRebroadcasts > 0) {
        this.intervals.push(setInterval(() => {
          if (this.settled) return
          if (this.rebroadcastsLeft-- <= 0) return
          this.inviteNewPeers()
        }, this.rebroadcastMs))
      }

      this.checkDone()
    })
  }

  // Peers holding the tx. A peer that was handed the bytes has no reason
  // to getdata for them, so acks alone never reach minPeerAcks once the
  // unsolicited push has run — and in practice acks rarely arrive at all.
  private delivered(): Set<Peer> {
    return new Set([...this.session.requestedBy, ...this.session.txSentTo])
  }

  private buildResult(): BroadcastResult {
    return {
      txid: this.session.txid,
      peersInvited: this.session.invSentTo.size,
      peersAcked: [...this.session.requestedBy].map(peerLabel),
      peersDelivered: [...this.delivered()].map(peerLabel),
      peersPropagated: [...this.session.propagatedFrom].map(peerLabel),
      instantLocked: this.session.instantLocked,
      islockHex: this.islockHex,
      lockLatencyMs: this.lockedAt == null ? null : this.lockedAt - this.startedAt,
      waitedForLock: this.waitForIs || this.requireIs,
      rejections: this.session.rejections.map(r => ({
        peer: peerLabel(r.peer),
        ccode: r.ccode,
        reason: r.reason,
      })),
      durationMs: Date.now() - this.startedAt,
    }
  }

  private cleanup(): void {
    for (const t of this.timers) clearTimeout(t)
    for (const i of this.intervals) clearInterval(i)
    for (const t of this.pushTimers.values()) clearTimeout(t)
    this.pushTimers.clear()
    this.peerPool.off('peerready', this.onPeerReady)
    this.session.close()
  }

  private succeed(): void {
    if (this.settled) return
    this.settled = true
    this.cleanup()
    this.resolve(this.buildResult())
  }

  private fail(msg: string): void {
    if (this.settled) return
    this.settled = true
    this.cleanup()
    const err = new Error(msg) as Error & {result: BroadcastResult}
    err.result = this.buildResult()
    this.reject(err)
  }

  // A peer announcing our txid back proves the tx entered its mempool.
  // Delivery does not: it says the bytes left our socket, which a peer that
  // dropped the tx and a peer that accepted it produce alike.
  private spread(): boolean {
    return this.session.propagatedFrom.size > 0
  }

  private checkDone(): void {
    if (this.settled) return
    if (this.requireIs) {
      if (this.session.instantLocked && this.spread()) this.succeed()
      return
    }
    // A lock settles it whatever the policy asked for — the tx is final, so
    // waiting on acks would learn nothing.
    if (this.session.instantLocked) {
      this.succeed()
      return
    }
    // A pinned peer set is normally too small to hold a witness back, and
    // Core never relays a tx toward the peer that announced it — so nothing
    // short of a lock can ever prove propagation here. Delivery is then the
    // only positive evidence there is.
    if (this.spread() || (this.peerPool.pinnedOnly && this.witnesses.size === 0 && this.delivered().size > 0)) this.succeed()
  }

  private armUnsolicited(peer: Peer): void {
    if (this.unsolicitedAfterMs <= 0) return
    if (this.pushTimers.has(peer)) return
    const t = setTimeout(() => {
      this.pushTimers.delete(peer)
      if (this.settled) return
      if (!this.session.requestedBy.has(peer) && !this.session.txSentTo.has(peer)) {
        this.session.push(peer)
      }
    }, this.unsolicitedAfterMs)
    this.pushTimers.set(peer, t)
  }

  private reserveWitnesses(): void {
    if (this.witnesses.size > 0) return
    const ready = this.session.readyPeers()
    // Never at the cost of carrying the tx — below this the pool is too
    // small to both broadcast and observe, and only a lock can confirm.
    const spare = Math.min(this.witnessPeers, ready.length - this.minPeerAcks)
    if (spare <= 0) return
    for (const peer of ready.slice(-spare)) this.witnesses.add(peer)
  }

  private inviteNewPeers(): number {
    this.reserveWitnesses()
    const before = this.session.invSentTo.size
    const sent: Peer[] = []
    for (const peer of this.session.readyPeers()) {
      if (this.witnesses.has(peer)) continue
      sent.push(...this.session.announce(peer))
    }
    for (const p of sent) this.armUnsolicited(p)
    return sent.length || (this.session.invSentTo.size - before)
  }

  private onLock = (msg: {getPayload?(): Uint8Array}): void => {
    if (this.lockedAt == null) {
      this.lockedAt = Date.now()
      const payload = msg.getPayload?.()
      if (payload) this.islockHex = Buffer.from(payload).toString('hex')
    }
    this.checkDone()
  }

  private onPeerReady = (peer: Peer): void => {
    if (this.settled) return
    if (this.witnesses.has(peer)) return
    const sent = this.session.announce(peer)
    if (sent.length) this.armUnsolicited(peer)
    this.checkDone()
  }

  private onTimeout(): void {
    if (this.settled) return
    const diagnostics =
      `invited=${this.session.invSentTo.size}, ack=${this.session.requestedBy.size}, ` +
      `delivered=${this.delivered().size}, propagated=${this.session.propagatedFrom.size}, ` +
      `witnesses=${this.witnesses.size}, islock=${this.session.instantLocked}`
    // Dash Core dropped BIP61 reject, so a peer that refuses the tx says
    // nothing. The evidence therefore has to be positive — a witness
    // announcing the txid back, or a lock — and neither arrived. The tx is
    // armed before broadcast, so a lock would already have settled this.
    if (this.witnesses.size === 0) {
      this.fail(`no peer to spare as a propagation witness, and no instant lock arrived (${diagnostics})`)
      return
    }
    this.fail(`no witness saw the tx enter a mempool within ${this.timeoutMs}ms (${diagnostics})`)
  }
}