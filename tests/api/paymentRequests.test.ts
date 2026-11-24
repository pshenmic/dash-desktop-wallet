import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import type {Knex} from 'knex'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {DashPayCache} from '../../src/main/src/database/DashPayCache'
import {PlatformAddressDAO} from '../../src/main/src/database/PlatformAddressDAO'
import {ShieldedAddressDAO} from '../../src/main/src/database/ShieldedAddressDAO'
import {PaymentRequestDAO} from '../../src/main/src/database/PaymentRequestDAO'
import {PaymentRequestService} from '../../src/main/src/services/wallet/PaymentRequestService'
import {CreatePaymentRequestHandler} from '../../src/main/src/api/paymentRequests/createPaymentRequest'
import {GetPaymentRequestsHandler} from '../../src/main/src/api/paymentRequests/getPaymentRequests'
import {DeletePaymentRequestHandler} from '../../src/main/src/api/paymentRequests/deletePaymentRequest'
import {getKnex, migrateKnex} from '../../src/main/src/utils'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const WALLET = 'w1'
const OTHER = 'w2'
const ADDRESS = 'yReceiveAddress'

describe('payment requests', () => {
  let knex: Knex
  let create: CreatePaymentRequestHandler
  let list: GetPaymentRequestsHandler
  let remove: DeletePaymentRequestHandler

  beforeEach(async () => {
    knex = getKnex()
    await migrateKnex(knex)
    await knex('wallet').insert([
      {wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'},
      {wallet_id: OTHER, network: 'testnet', encrypted_mnemonic: 'n'},
    ])
    const service = new PaymentRequestService(new PaymentRequestDAO(knex))
    create = new CreatePaymentRequestHandler(service)
    list = new GetPaymentRequestsHandler(service)
    remove = new DeletePaymentRequestHandler(service)
  })

  afterEach(async () => {
    await knex.destroy()
  })

  it('stores the BIP21 amount, label and message and answers them back', async () => {
    await create.handle(null as never, WALLET, ADDRESS, 150_000_000n, 'Coffee', 'Thanks for the coffee')

    const [request] = await list.handle(null as never, WALLET)
    expect(request).toMatchObject({
      walletId: WALLET,
      address: ADDRESS,
      amountDuffs: 150_000_000n,
      label: 'Coffee',
      message: 'Thanks for the coffee',
    })
    expect(request.createdAt).toBeGreaterThan(0)
  })

  it('stores an any-amount request with no label or message as nulls', async () => {
    await create.handle(null as never, WALLET, ADDRESS, null, null, null)

    expect((await list.handle(null as never, WALLET))[0]).toMatchObject({amountDuffs: null, label: null, message: null})
  })

  it('trims the label and message, and blank ones become null', async () => {
    await create.handle(null as never, WALLET, ADDRESS, null, '  Coffee  ', '   ')

    expect((await list.handle(null as never, WALLET))[0]).toMatchObject({label: 'Coffee', message: null})
  })

  it('reserves the address: one active request per address', async () => {
    await create.handle(null as never, WALLET, ADDRESS, null, null, null)

    await expect(create.handle(null as never, WALLET, ADDRESS, 5n, null, null)).rejects.toThrow('This address already has a payment request')
  })

  it('releases the address when the request is deleted', async () => {
    await create.handle(null as never, WALLET, ADDRESS, null, null, null)
    const [request] = await list.handle(null as never, WALLET)

    await remove.handle(null as never, WALLET, request.id)

    expect(await list.handle(null as never, WALLET)).toEqual([])
    await create.handle(null as never, WALLET, ADDRESS, 7n, null, null)
    expect((await list.handle(null as never, WALLET))[0].amountDuffs).toBe(7n)
  })

  it('refuses to delete a request that does not exist', async () => {
    await expect(remove.handle(null as never, WALLET, 999)).rejects.toThrow('Payment request not found')
  })

  it('keeps requests scoped to their wallet', async () => {
    await create.handle(null as never, WALLET, ADDRESS, null, null, null)
    await create.handle(null as never, OTHER, ADDRESS, null, null, null)

    expect(await list.handle(null as never, WALLET)).toHaveLength(1)
    expect(await list.handle(null as never, OTHER)).toHaveLength(1)

    const [request] = await list.handle(null as never, WALLET)
    await expect(remove.handle(null as never, OTHER, request.id)).rejects.toThrow('Payment request not found')
  })

  it('refuses an empty address and a non-positive amount', async () => {
    await expect(create.handle(null as never, WALLET, '   ', null, null, null)).rejects.toThrow('Address is required')
    await expect(create.handle(null as never, WALLET, ADDRESS, 0n, null, null)).rejects.toThrow('Amount must be positive')
    await expect(create.handle(null as never, WALLET, ADDRESS, -1n, null, null)).rejects.toThrow('Amount must be positive')
  })
})

describe('receive address reservation', () => {
  it('skips an address that has a payment request', async () => {
    const wired = await harness()
    const walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const {receiving} = await wired.walletService.getAddressesByWalletId(walletId)

    expect(await wired.walletService.getReceiveAddress(walletId)).toBe(receiving[0].address)

    await wired.paymentRequestDAO.insertRequest(walletId, receiving[0].address, null, null, null, Date.now())

    expect(await wired.walletService.getReceiveAddress(walletId)).toBe(receiving[1].address)
  })

  it('extends the receiving window past a reserved frontier address', async () => {
    const wired = await harness()
    const walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const {receiving} = await wired.walletService.getAddressesByWalletId(walletId)
    const last = receiving[receiving.length - 1]

    await wired.paymentRequestDAO.insertRequest(walletId, last.address, null, null, null, Date.now())
    await wired.coreDiscoveryService.discoverCoreAddresses(walletId)

    const after = await wired.walletService.getAddressesByWalletId(walletId)
    expect(after.receiving.length).toBeGreaterThan(receiving.length)
  })
})

describe('reserved addresses read as used', () => {
  const CORE = 'yCoreAddress'
  const PLATFORM = 'platformAddress'
  const SHIELDED = 'shieldedAddress'

  let knex: Knex
  let addressDAO: AddressDAO
  let platformAddressDAO: PlatformAddressDAO
  let shieldedAddressDAO: ShieldedAddressDAO
  let requests: PaymentRequestDAO

  beforeEach(async () => {
    knex = getKnex()
    await migrateKnex(knex)
    await knex('wallet').insert({wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'})
    addressDAO = new AddressDAO(knex, new DashPayCache())
    platformAddressDAO = new PlatformAddressDAO(knex)
    shieldedAddressDAO = new ShieldedAddressDAO(knex)
    requests = new PaymentRequestDAO(knex)
    await addressDAO.insertAddresses([{
      walletId: WALLET, accountId: 0, address: CORE, derivationPath: "m/44'/1'/0'/0/0", index: 0,
      isChange: false, isUsed: false, label: null,
    }])
    await platformAddressDAO.insertAddresses([{
      walletId: WALLET, index: 0, address: PLATFORM, derivationPath: "m/9'/1'/17'/0'/0'/0", isUsed: false,
    }])
    await shieldedAddressDAO.insertAddresses([{walletId: WALLET, index: 0, address: SHIELDED, isUsed: false}])
  })

  afterEach(async () => {
    await knex.destroy()
  })

  it('answers a reserved address as used in all three stores', async () => {
    await requests.insertRequest(WALLET, CORE, null, null, null, Date.now())
    await requests.insertRequest(WALLET, PLATFORM, null, null, null, Date.now())
    await requests.insertRequest(WALLET, SHIELDED, null, null, null, Date.now())

    expect((await addressDAO.getAddressesByWalletId(WALLET)).receiving[0].isUsed).toBe(true)
    expect((await platformAddressDAO.getAddresses(WALLET))[0].isUsed).toBe(true)
    expect((await shieldedAddressDAO.getAddresses(WALLET))[0].isUsed).toBe(true)
  })

  it('never persists the reservation as usage', async () => {
    await requests.insertRequest(WALLET, CORE, null, null, null, Date.now())

    const [row] = await knex('addresses').select('is_used').where({wallet_id: WALLET, address: CORE})
    expect(row.is_used).toBe(0)
  })

  it('releases the address when the request is deleted', async () => {
    await requests.insertRequest(WALLET, CORE, null, null, null, Date.now())
    const [request] = await requests.getRequests(WALLET)

    await requests.deleteRequest(WALLET, request.id)

    expect((await addressDAO.getAddressesByWalletId(WALLET)).receiving[0].isUsed).toBe(false)
  })
})
