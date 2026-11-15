import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import {Knex} from 'knex'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {PlatformAddressDAO} from '../../src/main/src/database/PlatformAddressDAO'
import {ShieldedAddressDAO} from '../../src/main/src/database/ShieldedAddressDAO'
import {DashPayCache} from '../../src/main/src/database/DashPayCache'
import {withPaymentRequestUsage} from '../../src/main/src/database/paymentRequestUsage'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

describe('payment-request usage overlay', () => {
  let knex: Knex
  let addressDAO: AddressDAO
  let platformAddressDAO: PlatformAddressDAO
  let shieldedAddressDAO: ShieldedAddressDAO

  beforeAll(async () => {
    knex = getKnex()
    await migrateKnex(knex)
    await knex('wallet').insert({wallet_id: 'w1', network: 'testnet', label: null, encrypted_mnemonic: 'x', selected: false})
    addressDAO = new AddressDAO(knex, new DashPayCache())
    platformAddressDAO = new PlatformAddressDAO(knex)
    shieldedAddressDAO = new ShieldedAddressDAO(knex)

    await addressDAO.insertAddresses([
      {walletId: 'w1', accountId: 0, address: 'addrReq', derivationPath: 'p', index: 0, isChange: false, isUsed: false, balance: null, label: null},
      {walletId: 'w1', accountId: 0, address: 'addrPlain', derivationPath: 'p', index: 1, isChange: false, isUsed: false, balance: null, label: null},
    ])
    await platformAddressDAO.insertAddresses([
      {walletId: 'w1', index: 0, address: 'pReq', derivationPath: 'p', isUsed: false},
      {walletId: 'w1', index: 1, address: 'pPlain', derivationPath: 'p', isUsed: false},
    ])
    await shieldedAddressDAO.insertAddresses([
      {walletId: 'w1', index: 0, address: 'sReq', isUsed: false},
      {walletId: 'w1', index: 1, address: 'sPlain', isUsed: false},
    ])
    await knex('payment_requests').insert([
      {wallet_id: 'w1', address: 'addrReq', created_at: 0},
      {wallet_id: 'w1', address: 'pReq', created_at: 0},
      {wallet_id: 'w1', address: 'sReq', created_at: 0},
    ])
  })

  afterAll(async () => {
    await knex.destroy()
  })

  it('helper overlays is_used from a matching payment request', async () => {
    const rows = await withPaymentRequestUsage(
      knex('addresses').select('addresses.address'), knex, 'addresses',
    ).where('addresses.wallet_id', 'w1').orderBy('index', 'asc')

    expect(rows.map(row => [row.address, Boolean(row.is_used)])).toEqual([
      ['addrReq', true],
      ['addrPlain', false],
    ])
  })

  it('core addresses read used only with a request', async () => {
    const {receiving} = await addressDAO.getAddressesByWalletId('w1')
    expect(receiving.map(a => [a.address, a.isUsed])).toEqual([
      ['addrReq', true],
      ['addrPlain', false],
    ])
  })

  it('platform addresses read used only with a request', async () => {
    const rows = await platformAddressDAO.getAddresses('w1')
    expect(rows.map(a => [a.address, a.isUsed])).toEqual([
      ['pReq', true],
      ['pPlain', false],
    ])
  })

  it('shielded addresses read used only with a request', async () => {
    const rows = await shieldedAddressDAO.getAddresses('w1')
    expect(rows.map(a => [a.address, a.isUsed])).toEqual([
      ['sReq', true],
      ['sPlain', false],
    ])
  })
})