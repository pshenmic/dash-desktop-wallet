import type {Knex} from 'knex'

// User labels for shielded and platform addresses; core addresses have carried
// their own since the initial schema.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shielded_addresses', table => {
    table.text('label')
  })
  await knex.schema.alterTable('platform_addresses', table => {
    table.text('label')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shielded_addresses', table => {
    table.dropColumn('label')
  })
  await knex.schema.alterTable('platform_addresses', table => {
    table.dropColumn('label')
  })
}
