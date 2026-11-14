import {describe, it, expect, vi} from 'vitest'
import {GetAllWalletsHandler} from '../../src/main/src/api/wallet/getAllWallets'
import {WalletService} from '../../src/main/src/services/wallet/WalletService'
import {Wallet} from '../../src/main/src/types/Wallet'

describe('GetAllWalletsHandler', () => {
  it('returns wallet summaries without secrets', async () => {
    const wallet: Wallet = {
      walletId: 'w1', network: 'testnet', label: 'Main', encryptedMnemonic: 'SECRET',
      selected: true, platformXpub: 'xpub', coreXpub: 'xpub', dashPayXpub: 'xpub',
    }
    const svc = {getAllWallets: vi.fn().mockResolvedValue([wallet])} as unknown as WalletService
    const handler = new GetAllWalletsHandler(svc)

    const result = await handler.handle({} as never)

    expect(result).toEqual([{walletId: 'w1', network: 'testnet', label: 'Main', selected: true}])
    expect(result[0]).not.toHaveProperty('encryptedMnemonic')
    expect(result[0]).not.toHaveProperty('platformXpub')
    expect(result[0]).not.toHaveProperty('coreXpub')
    expect(result[0]).not.toHaveProperty('dashPayXpub')
  })
})