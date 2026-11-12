import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import type {Knex} from 'knex'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {DashPayCache} from '../../src/main/src/database/DashPayCache'
import {ShieldedAddressDAO} from '../../src/main/src/database/ShieldedAddressDAO'
import {PlatformAddressDAO} from '../../src/main/src/database/PlatformAddressDAO'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

const WALLET = 'w1'
const OTHER = 'w2'
const ADDRESS = {core: 'core-shared', shielded: 'shielded-shared', platform: 'platform-shared'}

let knex: Knex
let addressDAO: AddressDAO
let shieldedAddressDAO: ShieldedAddressDAO
let platformAddressDAO: PlatformAddressDAO

const setters = () => ({
  core: addressDAO.setAddressLabel,
  shielded: shieldedAddressDAO.setAddressLabel,
  platform: platformAddressDAO.setAddressLabel,
})

const labelOf = async (kind: 'core' | 'shielded' | 'platform', walletId: string): Promise<string | null | undefined> => {
  if (kind === 'core') {
    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    return receiving.find(a => a.address === ADDRESS.core)?.label
  }
  if (kind === 'shielded') return (await shieldedAddressDAO.getAddresses(walletId))[0].label
  return (await platformAddressDAO.getAddresses(walletId))[0].label
}

beforeEach(async () => {
  knex = getKnex()
  await migrateKnex(knex)
  await knex('wallet').insert([
    {wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'},
    {wallet_id: OTHER, network: 'testnet', encrypted_mnemonic: 'n'},
  ])
  addressDAO = new AddressDAO(knex, new DashPayCache())
  shieldedAddressDAO = new ShieldedAddressDAO(knex)
  platformAddressDAO = new PlatformAddressDAO(knex)

  for (const walletId of [WALLET, OTHER]) {
    await addressDAO.insertAddresses([{
      walletId, accountId: 0, address: ADDRESS.core, derivationPath: "m/44'/1'/0'/0/0", index: 0,
      isChange: false, isUsed: false, label: null,
    }])
    await shieldedAddressDAO.insertAddresses([{walletId, index: 0, address: ADDRESS.shielded, isUsed: false, label: null}])
    await platformAddressDAO.insertAddresses([{
      walletId, index: 0, address: ADDRESS.platform, derivationPath: "m/9'/1'/17'/0'/0'/0", isUsed: false, label: null,
    }])
  }
})

afterEach(async () => {
  await knex.destroy()
})

describe('labelling addresses of every kind', () => {
  it.each(['core', 'shielded', 'platform'] as const)('answers a %s label on the address row', async kind => {
    await setters()[kind](WALLET, ADDRESS[kind], 'Savings')

    expect(await labelOf(kind, WALLET)).toBe('Savings')
  })

  it.each(['core', 'shielded', 'platform'] as const)('overwrites an existing %s label', async kind => {
    await setters()[kind](WALLET, ADDRESS[kind], 'First')
    await setters()[kind](WALLET, ADDRESS[kind], 'Second')

    expect(await labelOf(kind, WALLET)).toBe('Second')
  })

  it.each(['core', 'shielded', 'platform'] as const)('refuses an unknown %s address', async kind => {
    await expect(setters()[kind](WALLET, 'not-an-address', 'x')).rejects.toThrow('address or wallet not found')
  })

  it.each(['core', 'shielded', 'platform'] as const)('keeps %s labels scoped to their wallet', async kind => {
    await setters()[kind](OTHER, ADDRESS[kind], 'x')

    expect(await labelOf(kind, WALLET)).toBeNull()
    expect(await labelOf(kind, OTHER)).toBe('x')
  })
})
