import {describe, it, expect, beforeEach, vi} from 'vitest'
import {Script} from 'dash-core-sdk'
import type {Knex} from 'knex'
import {WalletService} from '../../src/main/src/services/wallet/WalletService'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {WalletProvider} from '../../src/main/src/providers/WalletProvider'
import {WalletProviderFactory} from '../../src/main/src/providers/WalletProviderFactory'
import {UTXO} from '../../src/main/src/types/UTXO'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const SCRIPT_HEX = '76a9143a2d4145a4f098523b3e8127f1da87cfc55b8e7988ac'
// Derived by no wallet the harness creates, so nothing can sign for it.
const FOREIGN = 'yPx8DNt1oQt3yubB2Sh73vAQRQ1AoyyLCS'
const MINED_AT = new Date('2024-01-01T00:00:00.000Z')

const utxo = (address: string, satoshis: bigint, txId: string, height: number): UTXO =>
  ({address, satoshis, txId, vOut: 0, script: Script.fromHex(SCRIPT_HEX), height, timestamp: MINED_AT, confirmations: 4, isLocked: false})

const providerStub = (utxos: UTXO[], ready = true): WalletProvider => ({
  getWalletUtxos: async () => utxos,
  getWalletBalance: async () => 0n,
  getBalance: async () => 0n,
  ensureReady: async () => {
    if (!ready) throw new Error('Wallet sync is not complete')
  },
  ensureReadyToList: async () => {
    if (!ready) throw new Error('Wallet sync is not complete')
  },
  getConnectionStatus: async () => 'online',
  scanAddressUsage: async () => null,
  getUsedAddresses: async () => [],
  getWalletTransactions: async () => [],
  getAddressInfos: async () => [],
  getTransactionByHash: async () => { throw new Error('unused') },
  getTxLockStatus: async () => ({instantLocked: false, chainlocked: false, confirmed: false}),
  nextUnusedAddress: async () => '',
  getMasternodes: async () => null,
  watchMasternodes: async () => [],
  getProposals: async () => null,
  getProposalTally: async () => null,
  getProposalVotes: async () => null,
  refreshGovernance: async () => undefined,
})

describe('listing the coins a send can draw on', () => {
  let walletService: WalletService
  let providers: WalletProviderFactory
  let createWalletHandler: CreateWalletHandler
  let transactionDAO: TransactionDAO
  let walletId: string
  let owned: string
  let knex: Knex

  beforeEach(async () => {
    const wired = await harness()
    knex = wired.knex
    walletService = wired.walletService
    providers = wired.providers
    createWalletHandler = wired.createWalletHandler
    transactionDAO = wired.transactionDAO
    walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    owned = (await walletService.getAddressesByWalletId(walletId)).receiving[0].address
  })

  it('answers with the coin, its outpoint and the height it confirmed at', async () => {
    vi.spyOn(providers, 'forWallet').mockReturnValue(providerStub([utxo(owned, 50_000n, 'aa', 2_300_000)]))

    expect(await walletService.getUtxos(walletId)).toEqual([
      {txid: 'aa', vout: 0, satoshis: 50_000n, address: owned, height: 2_300_000, timestamp: MINED_AT, confirmations: 4, isLocked: false, collateral: false},
    ])
  })

  // Offering one would hand the picker a coin whose send refuses at signing.
  it('leaves out outputs the wallet has no derivation path for', async () => {
    vi.spyOn(providers, 'forWallet').mockReturnValue(providerStub([
      utxo(FOREIGN, 900_000_000n, 'aa', 2_300_000),
      utxo(owned, 50_000n, 'bb', 2_300_001),
    ]))

    const utxos = await walletService.getUtxos(walletId)

    expect(utxos.map(u => u.txid)).toEqual(['bb'])
  })

  it('flags a masternode collateral the wallet holds, and only that coin', async () => {
    await knex('masternodes').insert({wallet_id: walletId, pro_tx_hash: 'pro', collateral_txid: 'aa', collateral_vout: 0})
    vi.spyOn(providers, 'forWallet').mockReturnValue(providerStub([
      utxo(owned, 100_000_000_000n, 'aa', 2_300_000),
      utxo(owned, 50_000n, 'bb', 2_300_001),
    ]))

    expect((await walletService.getUtxos(walletId)).map(u => [u.txid, u.collateral])).toEqual([['aa', true], ['bb', false]])
  })

  it('keeps a mempool output at height zero rather than dropping it', async () => {
    vi.spyOn(providers, 'forWallet').mockReturnValue(providerStub([utxo(owned, 50_000n, 'aa', 0)]))

    expect((await walletService.getUtxos(walletId))[0].height).toBe(0)
  })

  // A paused store is a stable snapshot, so the picker lists it without a
  // running sync — locks included.
  it('lists locally saved coins while sync is paused, locks included', async () => {
    await transactionDAO.applyBlock({
      walletId,
      height: 2_300_000,
      blockHash: 'hash',
      blockTime: 1_700_000_000,
      txs: [{txid: 'aa', raw: new Uint8Array([1]), inputs: [], outputs: [{vout: 0, address: owned, satoshis: '500', isMine: true}]}],
      spends: [],
    })

    expect((await walletService.getUtxos(walletId))[0]).toMatchObject({txid: 'aa', vout: 0, satoshis: 500n, address: owned, isLocked: false})

    await walletService.setUtxoLocked(walletId, 'aa', 0, true)
    expect((await walletService.getUtxos(walletId))[0].isLocked).toBe(true)
  })

  // Listing a partial set does not under-display, it narrows what can be picked
  // to coins the user cannot tell are only some of theirs.
  it('refuses to list coins a source is not ready to answer for', async () => {
    vi.spyOn(providers, 'forWallet')
      .mockReturnValue(providerStub([utxo(owned, 50_000n, 'aa', 2_300_000)], false))

    await expect(walletService.getUtxos(walletId)).rejects.toThrow('sync is not complete')
  })
})
