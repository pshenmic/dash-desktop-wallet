import type {Knex} from 'knex'

// DIP-3 provider account keys, public, so masternode keys derive without the
// seed. A wallet has a full row or none; one created before this table gets its
// row the next time the password is verified.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('masternode_keys', table => {
    table.text('wallet_id').notNullable().references('wallet_id').inTable('wallet')
    table.text('collateral_xpub').notNullable()
    table.text('voting_xpub').notNullable()
    table.text('owner_xpub').notNullable()
    table.binary('operator_public_key').notNullable()
    table.binary('operator_chain_code').notNullable()
    table.primary(['wallet_id'])
  })

  // Ed25519 has no public derivation, so each platform node key is stored.
  await knex.schema.createTable('masternode_platform_keys', table => {
    table.text('wallet_id').notNullable().references('wallet_id').inTable('wallet')
    table.integer('key_index').notNullable()
    table.binary('public_key').notNullable()
    table.primary(['wallet_id', 'key_index'])
  })

  // Only the collateral of the wallet's masternodes: it must stay unspendable
  // while the list cannot be reached. Everything else is live network state.
  await knex.schema.createTable('masternodes', table => {
    table.text('wallet_id').notNullable().references('wallet_id').inTable('wallet')
    table.text('pro_tx_hash').notNullable()
    table.text('collateral_txid').notNullable()
    table.integer('collateral_vout').notNullable()
    // The p2p scan was rewound to this node's registration, so no payout change
    // before it was missed. Rows from rpc mode stay false and are rescanned once.
    table.boolean('followed').notNullable().defaultTo(false)
    table.primary(['wallet_id', 'pro_tx_hash'])
  })

  // Provider keys imported by private key, kept in the form the list is
  // searched by: the address for owner and voting, the hex public key for operator.
  await knex.schema.createTable('masternode_imported_keys', table => {
    table.text('wallet_id').notNullable().references('wallet_id').inTable('wallet')
    table.text('role').notNullable()
    table.text('public_key').notNullable()
    table.primary(['wallet_id', 'role', 'public_key'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('masternode_imported_keys')
  await knex.schema.dropTableIfExists('masternodes')
  await knex.schema.dropTableIfExists('masternode_platform_keys')
  await knex.schema.dropTableIfExists('masternode_keys')
}
