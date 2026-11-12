import {describe, it, expect, vi, beforeAll, beforeEach, afterEach} from 'vitest'
import type {Knex} from 'knex'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {mnemonicToSeedSync} from '@scure/bip39'
import {PlatformAddressService} from '../../src/main/src/services/platform/PlatformAddressService'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {PlatformAddressDAO} from '../../src/main/src/database/PlatformAddressDAO'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {platformAddressDeriver} from '../../src/main/src/utils/platformAddress'
import {PLATFORM_ACCOUNT} from '../../src/main/src/constants/addresses'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

const WALLET = 'w1'
const SEEDPHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

let xpub: string
let addressAt: (index: number) => string
let knex: Knex
let dao: PlatformAddressDAO
let service: PlatformAddressService

beforeAll(async () => {
  const seed = mnemonicToSeedSync(SEEDPHRASE)
  xpub = await new KeyPairController().derivePlatformAccountXpub(seed, 'testnet', PLATFORM_ACCOUNT)
  const deriver = platformAddressDeriver(xpub, 'testnet')
  addressAt = index => deriver.derive(index).address
})

beforeEach(async () => {
  knex = getKnex()
  await migrateKnex(knex)
  await knex('wallet').insert({wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'})
  dao = new PlatformAddressDAO(knex)
  const walletDAO = {
    getWalletById: async () => ({walletId: WALLET, network: 'testnet', platformXpub: xpub}),
    getPlatformAddressCount: async () => 0,
  } as unknown as WalletDAO
  const platform = {request: vi.fn(async () => ({infos: []}))} as unknown as PlatformWorkerService
  service = new PlatformAddressService(walletDAO, dao, platform)
})

afterEach(async () => {
  await knex.destroy()
})

describe('platform address labels', () => {
  it('answers the persisted label on the address entry', async () => {
    await dao.insertAddresses([{
      walletId: WALLET, index: 0, address: addressAt(0), derivationPath: "m/9'/1'/17'/0'/0'/0", isUsed: false, label: null,
    }])

    const before = await service.getPlatformAddresses(WALLET)
    expect(before.find(entry => entry.platformAddress === addressAt(0))?.label).toBeNull()

    await service.setAddressLabel(WALLET, addressAt(0), 'Identity funding')

    const after = await service.getPlatformAddresses(WALLET)
    expect(after.find(entry => entry.platformAddress === addressAt(0))?.label).toBe('Identity funding')
  })
})
