import type {Knex} from 'knex'
import {PlatformAddressRow} from '../types/PlatformAddress'
import {INSERT_CHUNK_SIZE, SELECT_CHUNK_SIZE} from '../constants/database'
import {chunk} from '../utils/chunk'

function fromRow({wallet_id, address_index, address, derivation_path, is_used}): PlatformAddressRow {
  return {
    walletId: wallet_id,
    index: address_index,
    address,
    derivationPath: derivation_path,
    isUsed: Boolean(is_used),
  }
}

export class PlatformAddressDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getAddresses = async (walletId: string): Promise<PlatformAddressRow[]> => {
    // A payment request consumes the address like usage for the gap walk; the
    // stored is_used stays chain-only.
    const rows = await this.knex('platform_addresses')
      .leftJoin('payment_requests as pr', function () {
        this.on('pr.wallet_id', '=', 'platform_addresses.wallet_id').andOn('pr.address', '=', 'platform_addresses.address')
      })
      .select('platform_addresses.wallet_id', 'address_index', 'platform_addresses.address', 'derivation_path',
        this.knex.raw('CASE WHEN pr.id IS NOT NULL THEN 1 ELSE platform_addresses.is_used END as is_used'))
      .where('platform_addresses.wallet_id', walletId)
      .orderBy('address_index', 'asc')
    return rows.map(fromRow)
  }

  insertAddresses = async (addresses: PlatformAddressRow[]): Promise<void> => {
    for (const rows of chunk(addresses, INSERT_CHUNK_SIZE)) {
      await this.knex('platform_addresses')
        .insert(rows.map(entry => ({
          wallet_id: entry.walletId,
          address_index: entry.index,
          address: entry.address,
          derivation_path: entry.derivationPath,
          is_used: entry.isUsed,
        })))
        .onConflict(['wallet_id', 'address_index'])
        .ignore()
    }
  }

  markAddressesUsed = async (walletId: string, indexes: number[]): Promise<void> => {
    for (const slice of chunk(indexes, SELECT_CHUNK_SIZE)) {
      await this.knex('platform_addresses')
        .where('wallet_id', walletId)
        .whereIn('address_index', slice)
        .update({is_used: true})
    }
  }
}
