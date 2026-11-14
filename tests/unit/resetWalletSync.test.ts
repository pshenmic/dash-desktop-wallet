import {describe, it, expect, vi} from 'vitest'
import {ResetWalletSyncHandler} from '../../src/main/src/api/walletSync/resetWalletSync'
import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'

describe('ResetWalletSyncHandler', () => {
  const service = () => ({resetSync: vi.fn().mockResolvedValue(undefined)} as unknown as WalletSyncService)

  it('rejects a traversal network without touching the sync service', async () => {
    const svc = service()
    const handler = new ResetWalletSyncHandler(svc)

    await expect(handler.handle({} as never, '../../Documents' as never))
      .rejects.toThrow("resetWalletSync: expected 'mainnet' or 'testnet'")
    expect(svc.resetSync).not.toHaveBeenCalled()
  })

  it('passes a valid network through', async () => {
    const svc = service()
    const handler = new ResetWalletSyncHandler(svc)

    await handler.handle({} as never, 'testnet')
    expect(svc.resetSync).toHaveBeenCalledWith('testnet')
  })
})