import type {Knex} from 'knex'

// User locks on outpoints, kept apart from transaction_outputs: rpc-mode coins
// have no local output row, and rewind/abandon rewrite the rows they do have.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('locked_utxos', table => {
    table.text('wallet_id').notNullable()
    table.text('txid').notNullable()
    table.integer('vout').notNullable()
    table.primary(['wallet_id', 'txid', 'vout'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('locked_utxos')
}
