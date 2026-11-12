import type {Knex} from 'knex'
import {ShieldedAddressRow} from '../types/ShieldedAddress'
import {INSERT_CHUNK_SIZE, SELECT_CHUNK_SIZE} from '../constants/database'
import {chunk} from '../utils/chunk'

function fromRow({wallet_id, address_index, address, is_used}): ShieldedAddressRow {
  return {
    walletId: wallet_id,
    index: address_index,
    address,
    isUsed: Boolean(is_used),
  }
}

export class ShieldedAddressDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getAddresses = async (walletId: string): Promise<ShieldedAddressRow[]> => {
    // A payment request consumes the address like usage for the gap walk; the
    // stored is_used stays chain-only.
    const rows = await this.knex('shielded_addresses')
      .leftJoin('payment_requests as pr', function () {
        this.on('pr.wallet_id', '=', 'shielded_addresses.wallet_id').andOn('pr.address', '=', 'shielded_addresses.address')
      })
      .select('shielded_addresses.wallet_id', 'address_index', 'shielded_addresses.address',
        this.knex.raw('CASE WHEN pr.id IS NOT NULL THEN 1 ELSE shielded_addresses.is_used END as is_used'))
      .where('shielded_addresses.wallet_id', walletId)
      .orderBy('address_index', 'asc')
    return rows.map(fromRow)
  }

  insertAddresses = async (addresses: ShieldedAddressRow[]): Promise<void> => {
    for (const rows of chunk(addresses, INSERT_CHUNK_SIZE)) {
      await this.knex('shielded_addresses')
        .insert(rows.map(entry => ({
          wallet_id: entry.walletId,
          address_index: entry.index,
          address: entry.address,
          is_used: entry.isUsed,
        })))
        .onConflict(['wallet_id', 'address_index'])
        .ignore()
    }
  }

  markAddressesUsed = async (walletId: string, indexes: number[]): Promise<void> => {
    for (const slice of chunk(indexes, SELECT_CHUNK_SIZE)) {
      await this.knex('shielded_addresses')
        .where('wallet_id', walletId)
        .whereIn('address_index', slice)
        .update({is_used: true})
    }
  }
}
