import {describe, it, expect} from 'vitest'
import {stoppedSyncStatus} from '../../src/main/src/utils/syncStatus'

describe('stoppedSyncStatus', () => {
  it('returns the stopped snapshot with a fresh timestamp', () => {
    const before = Date.now()
    const status = stoppedSyncStatus()
    const after = Date.now()

    expect(status).toEqual({
      phase: 'stopped',
      network: null,
      walletId: null,
      tipHeight: 0,
      tipHash: null,
      estimatedChainHeight: 0,
      cfheadersHeight: 0,
      cfilterScanHeight: 0,
      matchedBlocksPending: 0,
      peerCount: 0,
      filterCapablePeerCount: 0,
      lockPeerCount: 0,
      peerMode: null,
      phaseEtaMs: null,
      lastError: null,
      updatedAt: expect.any(Number),
    })
    expect(status.updatedAt).toBeGreaterThanOrEqual(before)
    expect(status.updatedAt).toBeLessThanOrEqual(after)
  })
})