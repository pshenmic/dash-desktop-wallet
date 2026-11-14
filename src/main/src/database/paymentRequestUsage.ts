import type {Knex} from 'knex'

// A payment request consumes the address like usage for discovery and receive
// selection; the stored is_used stays chain-only.
export function withPaymentRequestUsage(query: Knex.QueryBuilder, knex: Knex, table: string): Knex.QueryBuilder {
  return query
    .leftJoin('payment_requests as pr', function () {
      this.on('pr.wallet_id', '=', `${table}.wallet_id`).andOn('pr.address', '=', `${table}.address`)
    })
    .select(knex.raw(`CASE WHEN pr.id IS NOT NULL THEN 1 ELSE ${table}.is_used END as is_used`))
}