import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import type {Knex} from 'knex'
import type {AppliedBlock, AppliedTx} from '../../src/main/p2p/types/walletSync'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {SetUtxoLockedHandler} from '../../src/main/src/api/wallet/setUtxoLocked'
import {getKnex, migrateKnex} from '../../src/main/src/utils'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const WALLET = 'w1'
const OTHER = 'w2'
const OWNED = 'core-1'
const COIN = 'a'.repeat(64)

const minedTx: AppliedTx = {
  txid: COIN,
  raw: new Uint8Array([1]),
  inputs: [],
  outputs: [{vout: 0, address: OWNED, satoshis: '500', isMine: true}],
}

const block: AppliedBlock = {
  walletId: WALLET,
  height: 2_300_000,
  blockHash: 'hash',
  blockTime: 1_700_000_000,
  txs: [minedTx],
  spends: [],
}

describe('locking outpoints', () => {
  let knex: Knex
  let transactionDAO: TransactionDAO

  beforeEach(async () => {
    knex = getKnex()
    await migrateKnex(knex)
    await knex('wallet').insert([
      {wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'},
      {wallet_id: OTHER, network: 'testnet', encrypted_mnemonic: 'n'},
    ])
    transactionDAO = new TransactionDAO(knex)
  })

  afterEach(async () => {
    await knex.destroy()
  })

  // rpc-mode coins come from Dashscan and have no local output row to hang a
  // column on; the lock must stand alone.
  it('locks an outpoint the local store has no output row for', async () => {
    await transactionDAO.setUtxoLocked(WALLET, COIN, 0, true)

    expect(await transactionDAO.getLockedOutpoints(WALLET)).toEqual([{txid: COIN, vout: 0}])
  })

  it('is idempotent in both directions', async () => {
    await transactionDAO.setUtxoLocked(WALLET, COIN, 0, true)
    await transactionDAO.setUtxoLocked(WALLET, COIN, 0, true)
    expect(await transactionDAO.getLockedOutpoints(WALLET)).toEqual([{txid: COIN, vout: 0}])

    await transactionDAO.setUtxoLocked(WALLET, COIN, 0, false)
    await transactionDAO.setUtxoLocked(WALLET, COIN, 0, false)
    expect(await transactionDAO.getLockedOutpoints(WALLET)).toEqual([])
  })

  it('keeps locks scoped to their wallet', async () => {
    await transactionDAO.setUtxoLocked(WALLET, COIN, 0, true)
    await transactionDAO.setUtxoLocked(OTHER, COIN, 0, true)

    await transactionDAO.setUtxoLocked(WALLET, COIN, 0, false)

    expect(await transactionDAO.getLockedOutpoints(WALLET)).toEqual([])
    expect(await transactionDAO.getLockedOutpoints(OTHER)).toEqual([{txid: COIN, vout: 0}])
  })

  // Confirmation, reorg and abandon all rewrite or delete the output row; a
  // lock is the user's annotation and none of them may lift it.
  it('keeps a lock through confirmation, rewind and abandon of the coin', async () => {
    await transactionDAO.recordPendingTx(WALLET, minedTx, true)
    await transactionDAO.setUtxoLocked(WALLET, COIN, 0, true)

    await transactionDAO.applyBlock(block)
    await transactionDAO.rewindToHeight(WALLET, 2_299_999)
    expect(await transactionDAO.getLockedOutpoints(WALLET)).toEqual([{txid: COIN, vout: 0}])

    await transactionDAO.abandonTransaction(WALLET, COIN)
    expect(await transactionDAO.getLockedOutpoints(WALLET)).toEqual([{txid: COIN, vout: 0}])
  })
})

describe('listing locked coins', () => {
  const setup = async () => {
    const wired = await harness()
    const walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const owned = (await wired.walletService.getAddressesByWalletId(walletId)).receiving[0].address
    await wired.transactionDAO.applyBlock({
      ...block,
      walletId,
      txs: [{...minedTx, outputs: [{vout: 0, address: owned, satoshis: '500', isMine: true}]}],
    })
    return {wired, walletId}
  }

  it('answers the flag from the lock store in p2p mode', async () => {
    const {wired, walletId} = await setup()
    const provider = wired.providers.forWallet(walletId, 'testnet')

    expect((await provider.getWalletUtxos())[0].isLocked).toBe(false)

    await wired.transactionDAO.setUtxoLocked(walletId, COIN, 0, true)
    expect((await provider.getWalletUtxos())[0].isLocked).toBe(true)

    await wired.transactionDAO.setUtxoLocked(walletId, COIN, 0, false)
    expect((await provider.getWalletUtxos())[0].isLocked).toBe(false)
  })

  it('setUtxoLocked flips what getUtxos lists', async () => {
    const {wired, walletId} = await setup()
    const handler = new SetUtxoLockedHandler(wired.walletService)

    expect((await wired.walletService.getUtxos(walletId))[0].isLocked).toBe(false)

    await handler.handle(null as never, walletId, COIN, 0, true)
    expect((await wired.walletService.getUtxos(walletId))[0].isLocked).toBe(true)

    await handler.handle(null as never, walletId, COIN, 0, false)
    expect((await wired.walletService.getUtxos(walletId))[0].isLocked).toBe(false)
  })
})
