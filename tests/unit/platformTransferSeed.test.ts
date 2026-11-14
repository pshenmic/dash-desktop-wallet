import {describe, it, expect, vi, beforeEach} from 'vitest'
import {PlatformTransferService} from '../../src/main/src/services/platform/PlatformTransferService'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {AssetLockService} from '../../src/main/src/services/platform/AssetLockService'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {ShieldedService} from '../../src/main/src/services/platform/ShieldedService'
import {PlatformAddressService} from '../../src/main/src/services/platform/PlatformAddressService'
import {FeeService} from '../../src/main/src/services/wallet/FeeService'
import {Preferences} from '../../src/main/src/preferences'
import {Wallet} from '../../src/main/src/types/Wallet'

describe('PlatformTransferService seed zeroing', () => {
  let service: PlatformTransferService
  let seed: Uint8Array
  let platform: {request: ReturnType<typeof vi.fn>}

  beforeEach(() => {
    seed = new Uint8Array([1, 2, 3])
    const wallet = {walletId: 'w1', network: 'testnet'} as Wallet
    const fee = {planInputs: vi.fn().mockResolvedValue({
      plan: {inputs: [{candidate: {platformAddress: 'a'}, credits: 1n}], feeStrategy: [], feeCredits: 1n},
      error: null,
    })}
    platform = {request: vi.fn().mockResolvedValue({stHash: 'h'})}
    service = new PlatformTransferService(
      {} as WalletDAO, {} as IdentityDAO, {} as AssetLockService,
      platform as unknown as PlatformWorkerService, {} as ShieldedService,
      {} as PlatformAddressService, fee as unknown as FeeService, {} as Preferences,
    )
    vi.spyOn(service as unknown as {unlock: () => Promise<{wallet: Wallet; seed: Uint8Array}>}, 'unlock')
      .mockResolvedValue({wallet, seed})
  })

  it('zeroes the seed after a successful send', async () => {
    await service.sendPlatformTransfer('w1', null, [{address: 'a', amountCredits: 1000000n}], 'pw')
    expect(seed.every(byte => byte === 0)).toBe(true)
  })

  it('zeroes the seed when the send rejects', async () => {
    platform.request.mockRejectedValue(new Error('boom'))
    await expect(service.sendPlatformTransfer('w1', null, [{address: 'a', amountCredits: 1000000n}], 'pw')).rejects.toThrow('boom')
    expect(seed.every(byte => byte === 0)).toBe(true)
  })
})