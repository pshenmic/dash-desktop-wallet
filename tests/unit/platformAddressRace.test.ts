import {describe, it, expect, vi, beforeAll, afterAll} from 'vitest'
import {Knex} from 'knex'

vi.mock('../../src/main/src/utils/platformAddress', () => ({
  platformAddressDeriver: () => ({derive: (index: number) => ({index, address: `addr${index}`, derivationPath: `m/${index}`})}),
}))

import {PlatformAddressService} from '../../src/main/src/services/platform/PlatformAddressService'
import {PlatformAddressDAO} from '../../src/main/src/database/PlatformAddressDAO'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

describe('addPlatformAddress concurrency', () => {
  let knex: Knex
  let service: PlatformAddressService
  let dao: PlatformAddressDAO

  beforeAll(async () => {
    knex = getKnex()
    await migrateKnex(knex)
    await knex('wallet').insert({wallet_id: 'w1', network: 'testnet', label: null, encrypted_mnemonic: 'x', selected: false, platform_xpub: 'xpub'})
    dao = new PlatformAddressDAO(knex)
    service = new PlatformAddressService(new WalletDAO(knex), dao, {} as PlatformWorkerService)
    vi.spyOn(service, 'getPlatformAddresses').mockResolvedValue([])
  })

  afterAll(async () => {
    await knex.destroy()
  })

  it('two concurrent reveals yield two distinct indexes', async () => {
    await Promise.all([service.addPlatformAddress('w1'), service.addPlatformAddress('w1')])

    const rows = await dao.getAddresses('w1')
    expect(rows.map(row => row.index).sort((a, b) => a - b)).toEqual([0, 1])
  })
})