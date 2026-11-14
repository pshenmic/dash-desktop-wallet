import {describe, it, expect, beforeEach} from 'vitest'
import {PrivateKey} from 'dash-core-sdk'
import {bytesToHex} from '@noble/hashes/utils.js'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {WalletCredentialsService} from '../../src/main/src/services/wallet/WalletCredentialsService'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

describe('WalletCredentialsService key export', () => {
  let credentials: WalletCredentialsService
  let addressDAO: AddressDAO
  let walletId: string

  beforeEach(async () => {
    const wired = await harness()
    credentials = wired.walletCredentialsService
    addressDAO = wired.addressDAO
    walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
  })

  it('exports the key behind a wallet address', async () => {
    const [first] = (await addressDAO.getAddressesByWalletId(walletId)).receiving

    const key = await credentials.exportKeyByAddress(walletId, first.address, PASSWORD)

    expect(key.address).toBe(first.address)
    expect(key.path).toBe(first.derivationPath)
    const fromWif = PrivateKey.fromWIF(key.wif)
    expect(fromWif.getAddress()).toBe(first.address)
    expect(bytesToHex(fromWif.bytes())).toBe(bytesToHex(key.privateKey))
    expect(bytesToHex(fromWif.getPublicKey().bytes())).toBe(bytesToHex(key.publicKey))
  })

  it('rejects an address the wallet does not own', async () => {
    await expect(credentials.exportKeyByAddress(walletId, 'yNotOurs', PASSWORD)).rejects.toThrow('is not an address of this wallet')
  })

  it('rejects a wrong password', async () => {
    const [first] = (await addressDAO.getAddressesByWalletId(walletId)).receiving

    await expect(credentials.exportKeyByAddress(walletId, first.address, 'wrong')).rejects.toThrow('Invalid wallet password')
  })
})
