import type {Knex} from 'knex'
import {MasternodeCollateral} from '../types/Masternode'

export class MasternodeDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
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
