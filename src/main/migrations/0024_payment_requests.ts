import type {Knex} from 'knex'

// BIP21 payment requests. A row reserves its address for receiving until the
// request is deleted — kept apart from addresses.is_used, which is chain-derived
// and drives the gap walk. One active request per address.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('payment_requests', table => {
    table.increments('id').primary()
    table.text('wallet_id').notNullable()
    table.text('address').notNullable()
    table.text('amount_duffs')
    table.text('label')
    table.text('message')
    table.integer('created_at').notNullable()

    table.unique(['wallet_id', 'address'], { useConstraint: true })
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('payment_requests')
}
