import {describe, it, expect, vi} from 'vitest'
import {AssetLockService} from '../../src/main/src/services/platform/AssetLockService'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {AssetLockDAO} from '../../src/main/src/database/AssetLockDAO'
import {AssetLockFunder} from '../../src/main/src/types/AssetLock'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'

const service = (getActiveFunding: ReturnType<typeof vi.fn>) => new AssetLockService(
  {} as WalletDAO,
  {getActiveFunding} as unknown as AssetLockDAO,
  {} as AssetLockFunder,
  {} as PlatformWorkerService,
)

describe('AssetLockService.begin concurrency', () => {
  it('rejects a second concurrent funding for the same wallet', async () => {
    const svc = service(vi.fn().mockResolvedValue(null))

    const first = svc.begin('w1', 'address', 'dest', 1000n)
    const second = svc.begin('w1', 'address', 'dest', 1000n)

    await expect(second).rejects.toThrow('already in progress')
    await expect(first).resolves.toBeDefined()
  })

  it('still rejects a resumable funding row and leaves no in-flight state', async () => {
    const svc = service(vi.fn().mockResolvedValue({txid: 't', kind: 'address', toPlatformAddress: 'd', amountDuffs: 1n}))

    await expect(svc.begin('w1', 'address', 'd', 1n)).rejects.toThrow('resume it first')
    expect(svc.getActive('w1')).toBeNull()
  })
})