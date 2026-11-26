import type {Knex} from 'knex'
import {MasternodeIdentity, MasternodeIdentityRow, MasternodeIdentityTableRow} from '../types/MasternodeIdentity'

const identityRows = (walletId: string, rows: MasternodeIdentityRow[]): MasternodeIdentityTableRow[] =>
  rows.map(({proTxHash, role, identifier}) => ({
    wallet_id: walletId,
    pro_tx_hash: proTxHash,
    role,
    identifier,
  }))

async function upsertIdentities(knex: Knex, walletId: string, rows: MasternodeIdentityRow[]): Promise<void> {
  await knex('masternode_identities')
    .insert(identityRows(walletId, rows))
    .onConflict(['wallet_id', 'pro_tx_hash', 'role'])
    .merge()
}

export class MasternodeIdentityDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  // A list pass rewrites the same pair every time; a rotating voting key moves
  // the voter identity, so the newer identifier replaces the older one.
  save = async (walletId: string, rows: MasternodeIdentityRow[]): Promise<void> => {
    if (rows.length === 0) return
    await upsertIdentities(this.knex, walletId, rows)
  }

  // The identities of the nodes a discovery run owns, with pending rows kept by
  // proTxHash so a registration still in the mempool survives the pass.
  replace = async (walletId: string, rows: MasternodeIdentityRow[], keepProTxHashes: Iterable<string>): Promise<void> => {
    const keep = [...keepProTxHashes]
    await this.knex.transaction(async trx => {
      const stale = trx('masternode_identities').where('wallet_id', walletId)
      if (keep.length > 0) stale.whereNotIn('pro_tx_hash', keep)
      await stale.delete()

      if (rows.length > 0) {
        await upsertIdentities(trx, walletId, rows)
      }
    })
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
