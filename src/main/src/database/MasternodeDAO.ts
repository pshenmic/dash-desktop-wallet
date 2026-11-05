import type {Knex} from 'knex'
import {MasternodeCollateral} from '../types/Masternode'

export class MasternodeDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getCollaterals = async (walletId: string): Promise<MasternodeCollateral[]> => {
    const rows = await this.knex('masternodes')
      .select('pro_tx_hash', 'collateral_txid', 'collateral_vout')
      .where('wallet_id', walletId)
    return rows.map(row => ({proTxHash: row.pro_tx_hash, txid: row.collateral_txid, vout: row.collateral_vout}))
  }

  getProTxHashes = async (walletId: string): Promise<string[]> => {
    const rows = await this.knex('masternodes').select('pro_tx_hash').where('wallet_id', walletId)
    return rows.map(({pro_tx_hash}) => pro_tx_hash)
  }

  // A node that left the list, or is no longer ours, goes with its collateral.
  replaceCollaterals = async (walletId: string, collaterals: MasternodeCollateral[]): Promise<void> => {
    await this.knex.transaction(async trx => {
      await trx('masternodes').where('wallet_id', walletId).delete()
      if (collaterals.length === 0) return
      await trx('masternodes').insert(collaterals.map(({proTxHash, txid, vout}) => ({
        wallet_id: walletId,
        pro_tx_hash: proTxHash,
        collateral_txid: txid,
        collateral_vout: vout,
      })))
    })
  }
}
