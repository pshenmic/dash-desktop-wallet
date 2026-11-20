import type {Knex} from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('addresses', table => {
    table.boolean('is_locked').notNullable().defaultTo(false)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('addresses', table => {
    table.dropColumn('is_locked')
  })
}
