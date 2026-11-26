import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import type {Knex} from 'knex'
import {Transaction as SDKTransaction, TransactionType, utils as sdkUtils} from 'dash-core-sdk'
import type {AppliedBlock, AppliedTx} from '../../src/main/p2p/types/walletSync'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {buildAssetLockOutputs} from '../../src/main/src/utils/assetLockTx'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

const WALLET = 'w1'
const OWNED = 'core-1'
const CREDIT_ADDRESS = sdkUtils.publicKeyHashToAddress(new Uint8Array(20).fill(9), 'testnet')

let knex: Knex
let transactionDAO: TransactionDAO

beforeEach(async () => {
  knex = getKnex()
  await migrateKnex(knex)
  await knex('wallet').insert({wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'})
  transactionDAO = new TransactionDAO(knex)
})

afterEach(async () => {
  await knex.destroy()
})

const assetLock = (): AppliedTx => {
  const {extraPayload} = buildAssetLockOutputs(100_000n, CREDIT_ADDRESS)
  return {
    txid: 'asset-lock',
    raw: new SDKTransaction(undefined, undefined, 0, 3, TransactionType.TRANSACTION_ASSET_LOCK, extraPayload).bytes(),
    inputs: [],
    outputs: [{vout: 0, address: OWNED, satoshis: '100000', isMine: true}],
  }
}

const payment = (): AppliedTx => ({
  txid: 'payment',
  raw: new SDKTransaction(undefined, undefined, 0, 2).bytes(),
  inputs: [],
  outputs: [{vout: 0, address: OWNED, satoshis: '500', isMine: true}],
})

const block = (txs: AppliedTx[]): AppliedBlock => ({
  walletId: WALLET,
  height: 2_300_000,
  blockHash: 'hash',
  blockTime: 1_700_000_000,
  txs,
  spends: [],
})

describe('extra payload of a stored transaction', () => {
  it('returns the decoded payload with the wallet history', async () => {
    await transactionDAO.applyBlock(block([assetLock(), payment()]))

    const transactions = await transactionDAO.getTransactionsByWallet(WALLET)
    const special = transactions.find(tx => tx.txid === 'asset-lock')
    const ordinary = transactions.find(tx => tx.txid === 'payment')

    expect(special?.extraPayload).toMatchObject({type: 'AssetLockTx'})
    expect(special?.extraPayload?.payload).toMatchObject({version: 1, count: 1})
    expect(ordinary?.extraPayload).toBeNull()
  })

  it('returns it from the detail read as well', async () => {
    await transactionDAO.applyBlock(block([assetLock()]))

    const transaction = await transactionDAO.getTransactionByTxid(WALLET, 'asset-lock')

    expect(transaction?.extraPayload).toMatchObject({type: 'AssetLockTx'})
  })

  it('returns it from an address-scoped read', async () => {
    await transactionDAO.applyBlock(block([assetLock()]))

    const [transaction] = await transactionDAO.getTransactionsByAddress(WALLET, OWNED)

    expect(transaction.extraPayload).toMatchObject({type: 'AssetLockTx'})
  })
})
