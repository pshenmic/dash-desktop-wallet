import type {Knex} from 'knex'

// A voting key imported for a shared node signs governance votes, so its secret
// is kept encrypted under the wallet seed; the public identifier still drives
// discovery. Owner and operator imports keep their secret too, for consent and
// ProUpServTx signing.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('masternode_imported_keys', table => {
    table.text('encrypted_private_key').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('masternode_imported_keys', table => {
    table.dropColumn('encrypted_private_key')
  })
}