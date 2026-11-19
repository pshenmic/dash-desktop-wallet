import {describe, it, expect} from 'vitest'
import {DashscanWalletProvider} from '../../src/main/src/providers/DashscanWalletProvider'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'

const receiving = [
  {address: 'addr-0', isUsed: true},
  {address: 'addr-1', isUsed: false},
  {address: 'addr-2', isUsed: false},
]

const provider = (locked: string[] = []): DashscanWalletProvider => {
  const addressDAO = {
    getAddressesByWalletId: async () => ({
      receiving: receiving.map(address => ({...address, isLocked: locked.includes(address.address)})),
      change: [],
    }),
  } as unknown as AddressDAO
  return new DashscanWalletProvider('testnet', 'w1', addressDAO, {} as unknown as WalletDAO, {} as unknown as TransactionDAO)
}

describe('nextUnusedAddress on the indexer store', () => {
  it('returns the first unused address', async () => {
    expect(await provider().nextUnusedAddress()).toBe('addr-1')
  })

  it('skips addresses reserved by payment requests', async () => {
    expect(await provider().nextUnusedAddress(new Set(['addr-1']))).toBe('addr-2')
  })

  it('skips locked addresses', async () => {
    expect(await provider(['addr-1']).nextUnusedAddress()).toBe('addr-2')
  })

  it('refuses when every receiving address is locked', async () => {
    await expect(provider(receiving.map(a => a.address)).nextUnusedAddress())
      .rejects.toThrow('Every receiving address is locked')
  })
})