import {beforeEach, describe, expect, it} from 'vitest'
import {Input, Output, Script, Transaction} from 'dash-core-sdk'
import {Preferences} from '../../src/main/src/preferences'
import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {AppliedTx} from '../../src/main/p2p/types/walletSync'
import {harness, Harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

type Command = {type: string; requestId?: string}

interface Internals {
  child: unknown
  activeWalletId: string | null
  lockListenNetwork: 'mainnet' | 'testnet' | null
  lockListenWalletId: string | undefined
  persistQueue: Promise<unknown>
  send: (command: Command) => void
  handleP2PEvent: (event: unknown) => void
  rebroadcastPending: () => Promise<void>
}

const ISLOCK = 'ab'.repeat(40)

describe('an InstantSend lock reaches the pending row', () => {
  let wired: Harness
  let walletId: string
  let sync: WalletSyncService
  let internals: Internals
  let sent: Command[]
  let tx: Transaction

  const instantLocked = async (): Promise<boolean> => {
    const row = await wired.knex('transactions').where({wallet_id: walletId, txid: tx.hash()}).first('instant_locked')
    return Boolean(row?.instant_locked)
  }

  const broadcastResult = (requestId: string, islockHex: string | null): unknown => ({
    type: 'broadcastResult', requestId, ok: true, errorMessage: null,
    result: {
      txid: tx.hash(), peersInvited: 1, peersAcked: ['p'], peersDelivered: ['p'], peersPropagated: ['p'],
      instantLocked: islockHex != null, islockHex, lockLatencyMs: null, waitedForLock: false, rejections: [], durationMs: 0,
    },
  })

  beforeEach(async () => {
    wired = await harness()
    walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const [address] = (await wired.walletService.getAddressesByWalletId(walletId)).receiving
    tx = new Transaction()
    tx.addInput(new Input('11'.repeat(32), 0, new Script(), 0xffffffff))
    tx.addOutput(Output.createP2PKH(100_000n, address.address))

    sync = new WalletSyncService(wired.walletDAO, wired.addressDAO, wired.transactionDAO, Preferences.default())
    internals = sync as unknown as Internals
    internals.child = {}
    internals.activeWalletId = walletId
    internals.lockListenNetwork = null
    internals.lockListenWalletId = walletId
    sent = []
    internals.send = command => {
      sent.push(command)
      if (command.type === 'broadcast') internals.handleP2PEvent(broadcastResult(command.requestId!, ISLOCK))
    }
  })

  // The session consumes the network's one announcement, so no later event repeats it.
  it('marks a send locked when its broadcast session caught the lock', async () => {
    await sync.broadcastTransaction(tx.hex())
    expect(await instantLocked()).toBe(true)
  })

  it('marks a row locked when the lock arrived before the row was written', async () => {
    internals.handleP2PEvent({type: 'txInstantLocked', txid: tx.hash(), islockHex: ISLOCK})
    const incoming: AppliedTx = {
      txid: tx.hash(), raw: tx.bytes(), inputs: [{vin: 0, prevTxid: '11'.repeat(32), prevVout: 0, sequence: 0xffffffff}],
      outputs: [{vout: 0, address: null, satoshis: '100000', isMine: true}],
    }
    internals.handleP2PEvent({type: 'incomingTx', walletId, tx: incoming})
    await internals.persistQueue
    expect(await instantLocked()).toBe(true)
  })

  it('stops re-pushing a send once it is locked', async () => {
    await sync.broadcastTransaction(tx.hex())
    sent = []
    await internals.rebroadcastPending()
    expect(sent.filter(({type}) => type === 'broadcast')).toEqual([])
  })

  it('keeps re-pushing a send no lock has reached', async () => {
    internals.send = command => {
      sent.push(command)
      if (command.type === 'broadcast') internals.handleP2PEvent(broadcastResult(command.requestId!, null))
    }
    await sync.broadcastTransaction(tx.hex())
    expect(await instantLocked()).toBe(false)
    sent = []
    await internals.rebroadcastPending()
    expect(sent.filter(({type}) => type === 'broadcast')).toHaveLength(1)
  })
})
