import {beforeEach, describe, expect, it} from 'vitest'
import {SetAddressLockedHandler} from '../../src/main/src/api/wallet/setAddressLocked'
import {selectTransferInputs} from '../../src/main/src/utils/transferInputs'
import {coreFeeDuffsFor} from '../../src/main/src/utils/coreFeeRate'
import {Harness, harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const COIN = 'aa'.repeat(32)
const LATER_COIN = 'bb'.repeat(32)
const FEE = (inputsCount: number): bigint => coreFeeDuffsFor(1, inputsCount, 1, true)

const block = (walletId: string, txid: string, address: string) => ({
  walletId,
  height: 2_300_000,
  blockHash: `hash-${txid}`,
  blockTime: 1_700_000_000,
  txs: [{
    txid,
    raw: new Uint8Array([1]),
    inputs: [],
    outputs: [{vout: 0, address, satoshis: '5000000', isMine: true}],
  }],
  spends: [],
})

describe('locking an address', () => {
  let wired: Harness
  let walletId: string
  let address: string
  let handler: SetAddressLockedHandler

  beforeEach(async () => {
    wired = await harness()
    walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    address = (await wired.walletService.getAddressesByWalletId(walletId)).receiving[0].address
    handler = new SetAddressLockedHandler(wired.walletService)
    await wired.transactionDAO.applyBlock(block(walletId, COIN, address))
  })

  const setLocked = (locked: boolean) => handler.handle(null as never, walletId, address, locked)

  const select = async () => {
    const [grouped, utxos] = await Promise.all([
      wired.walletService.getAddressesByWalletId(walletId),
      wired.providers.spendableUtxos(walletId, 'testnet'),
    ])
    return selectTransferInputs(grouped, utxos, 1_000n, FEE)
  }

  it('lists the address as locked and its coins as locked', async () => {
    await setLocked(true)

    expect((await wired.walletService.getAddressesByWalletId(walletId)).receiving[0].isLocked).toBe(true)
    expect((await wired.walletService.getUtxos(walletId))[0].isLocked).toBe(true)
  })

  // The flag is read from the store on every listing, so a coin that lands on
  // the address after the lock is covered too.
  it('locks coins that arrive after the address was locked', async () => {
    await setLocked(true)
    await wired.transactionDAO.applyBlock(block(walletId, LATER_COIN, address))

    const locked = (await wired.providers.spendableUtxos(walletId, 'testnet')).filter(utxo => utxo.isLocked)
    expect(locked.map(({txId}) => txId).sort()).toEqual([COIN, LATER_COIN].sort())
  })

  it('keeps the coins out of a send until the address is unlocked', async () => {
    await setLocked(true)
    await expect(select()).rejects.toThrow('No spendable funds in this wallet')

    await setLocked(false)
    expect((await select()).transferInputs.map(({txId}) => txId)).toEqual([COIN])
  })

  it('stops offering a locked address as the next receive address', async () => {
    const before = await wired.walletService.getReceiveAddress(walletId)

    await handler.handle(null as never, walletId, before, true)

    const next = await wired.walletService.getReceiveAddress(walletId)
    expect(next).not.toBe(before)
    expect((await wired.walletService.getAddressesByWalletId(walletId)).receiving
      .find(candidate => candidate.address === next)?.isLocked).toBe(false)
  })

  it('is idempotent in both directions', async () => {
    await setLocked(true)
    await setLocked(true)
    await setLocked(false)
    await setLocked(false)

    expect((await wired.walletService.getAddressesByWalletId(walletId)).receiving[0].isLocked).toBe(false)
    expect((await wired.walletService.getUtxos(walletId))[0].isLocked).toBe(false)
  })

  it('refuses an address the wallet does not own', async () => {
    await expect(handler.handle(null as never, walletId, 'yPx8DNt1oQt3yubB2Sh73vAQRQ1AoyyLCS', true))
      .rejects.toThrow('address or wallet not found')
  })
})