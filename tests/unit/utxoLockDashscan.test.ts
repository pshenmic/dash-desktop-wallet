import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import type {Knex} from 'knex'

const fetches = vi.hoisted(() => ({body: null as unknown}))

vi.mock('electron', () => ({
  net: {
    fetch: () => Promise.resolve({ok: true, status: 200, json: async () => fetches.body} as Response),
  },
}))

import {DashscanWalletProvider} from '../../src/main/src/providers/DashscanWalletProvider'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {UTXO} from '../../src/main/src/types/UTXO'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

const WALLET = 'w1'
const OURS = 'yRd4FhXfVGHXpsuZXPNkMrfD9GVj46pnjt'
const XPUB = 'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
const COIN = 'a'.repeat(64)
const OTHER_COIN = 'b'.repeat(64)

let knex: Knex
let transactionDAO: TransactionDAO

const walletDAO = {getWalletById: async () => ({coreXpub: XPUB})} as unknown as WalletDAO
const addressDAO = {
  getAddressesByWalletId: async () => ({receiving: [{address: OURS}], change: []}),
} as unknown as AddressDAO

const coin = (txid: string) => ({
  address: OURS, prevTxHash: txid, vOutIndex: 0, amount: '100000',
  scriptPubKeyHex: '76a914a3890b802865e1cfeed7653d0fea33831d709b6f88ac',
  blockHeight: 100, timestamp: null, confirmations: 10,
})

const dashscanUtxoPage = {
  resultSet: [coin(COIN), coin(OTHER_COIN)],
  pagination: {page: 1, limit: 100, total: 2},
}

const list = (): Promise<UTXO[]> =>
  new DashscanWalletProvider('testnet', WALLET, addressDAO, walletDAO, transactionDAO).getWalletUtxos()

beforeEach(async () => {
  knex = getKnex()
  await migrateKnex(knex)
  await knex('wallet').insert({wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'})
  transactionDAO = new TransactionDAO(knex)
  fetches.body = dashscanUtxoPage
})

afterEach(async () => {
  await knex.destroy()
})

describe('locks on coins Dashscan lists', () => {
  // A lock annotates the listing; it must not hide the coin from the picker.
  it('still lists a locked coin, flagged', async () => {
    await transactionDAO.setUtxoLocked(WALLET, COIN, 0, true)

    expect((await list()).map(u => ({txid: u.txId, isLocked: u.isLocked}))).toEqual([
      {txid: COIN, isLocked: true},
      {txid: OTHER_COIN, isLocked: false},
    ])
  })

  it('clears the flag when the lock is removed', async () => {
    await transactionDAO.setUtxoLocked(WALLET, COIN, 0, true)
    await transactionDAO.setUtxoLocked(WALLET, COIN, 0, false)

    expect((await list()).every(u => !u.isLocked)).toBe(true)
  })

  it('ignores a lock on an outpoint Dashscan does not list', async () => {
    await transactionDAO.setUtxoLocked(WALLET, 'c'.repeat(64), 0, true)

    expect(await list()).toHaveLength(2)
  })
})
