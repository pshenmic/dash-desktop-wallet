import {describe, it, expect, vi} from 'vitest'
import {AssetLockService} from '../../src/main/src/services/platform/AssetLockService'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {AssetLockDAO} from '../../src/main/src/database/AssetLockDAO'
import {AssetLockFunder} from '../../src/main/src/types/AssetLock'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {AssetLockFundingState} from '../../src/main/src/types/AssetLockFunding'

const service = () => new AssetLockService(
  {} as WalletDAO,
  {} as AssetLockDAO,
  {} as AssetLockFunder,
  {} as PlatformWorkerService,
)

const state = (): AssetLockFundingState => ({
  phase: 'building', kind: 'address', txid: null, txHeight: null, chainLockedHeight: null,
  lockKind: null, stHash: null, toPlatformAddress: null, identityIdentifier: null,
  amountDuffs: null, error: null,
})

describe('AssetLockService.runDetached', () => {
  it('returns the state synchronously and zeroes the seed when the work resolves', async () => {
    const unlocked = {seed: new Uint8Array([1, 2, 3])}
    const s = state()

    const returned = service().runDetached(s, unlocked, async () => {})

    expect(returned).toBe(s)
    await vi.waitFor(() => expect(unlocked.seed.every(byte => byte === 0)).toBe(true))
  })

  it('marks the state failed and zeroes the seed when the work rejects', async () => {
    const unlocked = {seed: new Uint8Array([9])}
    const s = state()

    service().runDetached(s, unlocked, async () => {
      throw new Error('boom')
    })

    await vi.waitFor(() => expect(s.error).toBe('boom'))
    expect(s.phase).toBe('error')
    expect(unlocked.seed[0]).toBe(0)
  })
})