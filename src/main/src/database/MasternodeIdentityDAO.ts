import type {Knex} from 'knex'
import {MasternodeIdentity} from '../types/MasternodeIdentity'

export class MasternodeIdentityDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  // A list pass rewrites the same pair every time; a rotating voting key moves
  // the voter identity, so the newer identifier replaces the older one.
  save = async (walletId: string, rows: Array<Pick<MasternodeIdentity, 'proTxHash' | 'role' | 'identifier'>>): Promise<void> => {
    if (rows.length === 0) return
    await this.knex('masternode_identities')
      .insert(rows.map(({proTxHash, role, identifier}) => ({
        wallet_id: walletId,
        pro_tx_hash: proTxHash,
        role,
        identifier,
      })))
      .onConflict(['wallet_id', 'pro_tx_hash', 'role'])
      .merge()
  }

  getByWalletId = async (walletId: string): Promise<MasternodeIdentity[]> => {
    const rows = await this.knex('masternode_identities')
      .select('wallet_id', 'pro_tx_hash', 'role', 'identifier')
      .where('wallet_id', walletId)
      .orderBy([{column: 'pro_tx_hash'}, {column: 'role'}])
    return rows.map(row => ({
      walletId: row.wallet_id,
      proTxHash: row.pro_tx_hash,
      role: row.role,
      identifier: row.identifier,
    }))
  }
}