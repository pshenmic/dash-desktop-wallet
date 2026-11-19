import type {Knex} from 'knex'

// The owner and voter identities Platform derives from an evonode's ProRegTx,
// kept per node so discovery can attach them to the wallet. They are not
// seed-derived, so they live apart from the `identities` table.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('masternode_identities', table => {
    table.text('wallet_id').notNullable().references('wallet_id').inTable('wallet')
    table.text('pro_tx_hash').notNullable()
    table.text('role').notNullable()
    table.text('identifier').notNullable()
    table.primary(['wallet_id', 'pro_tx_hash', 'role'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('masternode_identities')
}