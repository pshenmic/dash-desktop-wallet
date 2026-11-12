import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import type {Knex} from 'knex'
import {ShieldedService} from '../../src/main/src/services/platform/ShieldedService'
import {ShieldedAddressDAO} from '../../src/main/src/database/ShieldedAddressDAO'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {ShieldedNoteDAO} from '../../src/main/src/database/ShieldedNoteDAO'
import {ShieldedPoolDAO} from '../../src/main/src/database/ShieldedPoolDAO'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {AssetLockService} from '../../src/main/src/services/platform/AssetLockService'
import {PlatformHistoryService} from '../../src/main/src/services/platform/PlatformHistoryService'
import {Preferences} from '../../src/main/src/preferences'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

const WALLET = 'w1'
const ADDRESS = 'shielded-a'

let knex: Knex
let service: ShieldedService

beforeEach(async () => {
  knex = getKnex()
  await migrateKnex(knex)
  await knex('wallet').insert({wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'})
  const shieldedAddressDAO = new ShieldedAddressDAO(knex)
  await shieldedAddressDAO.insertAddresses([{walletId: WALLET, index: 0, address: ADDRESS, isUsed: false, label: null}])
  service = new ShieldedService(
    {} as unknown as WalletDAO,
    {} as unknown as IdentityDAO,
    {} as unknown as ShieldedNoteDAO,
    {} as unknown as ShieldedPoolDAO,
    shieldedAddressDAO,
    {} as unknown as PlatformWorkerService,
    {} as unknown as AssetLockService,
    {} as unknown as PlatformHistoryService,
    {} as unknown as Preferences,
  )
})

afterEach(async () => {
  await knex.destroy()
})

describe('shielded address labels', () => {
  it('answers persisted entries with their labels without a password', async () => {
    expect(await service.getAddresses(WALLET)).toEqual([{address: ADDRESS, label: null}])
  })

  // The list is cached, so a label write has to drop the cache or the next
  // read keeps answering the old label.
  it('answers a fresh label on the next read after the cache was warmed', async () => {
    await service.getAddresses(WALLET)
    await service.setAddressLabel(WALLET, ADDRESS, 'Cold storage')

    expect(await service.getAddresses(WALLET)).toEqual([{address: ADDRESS, label: 'Cold storage'}])
  })

  it('keeps the single-address read a bare string', async () => {
    expect(await service.getAddress(WALLET)).toBe(ADDRESS)
  })

  it('refuses an address the wallet has not revealed', async () => {
    await expect(service.setAddressLabel(WALLET, 'not-revealed', 'x')).rejects.toThrow('address or wallet not found')
  })
})
