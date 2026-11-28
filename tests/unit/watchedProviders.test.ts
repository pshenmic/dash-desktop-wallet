import {describe, expect, it, vi} from 'vitest'

vi.mock('electron', () => ({utilityProcess: {fork: vi.fn()}}))
vi.mock('../../src/main/src/logTransport', () => ({logChildOutput: vi.fn()}))

import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {Preferences} from '../../src/main/src/preferences'

// A child that records what main posts to it; watchProviders reads nothing else.
function service(): {walletSync: WalletSyncService; posted: unknown[]} {
  const posted: unknown[] = []
  const walletSync = new WalletSyncService({} as never, {} as never, {} as never, Preferences.default())
  ;(walletSync as unknown as {child: unknown}).child = {postMessage: (command: unknown) => posted.push(command)}
  return {walletSync, posted}
}

describe('WalletSyncService.watchProviders', () => {
  // Discovery runs every two minutes and usually finds the same nodes.
  it('sends one command per watch set, whatever the order', async () => {
    const {walletSync, posted} = service()

    await walletSync.watchProviders('w1', ['a', 'b'])
    await walletSync.watchProviders('w1', ['b', 'a'])
    await walletSync.watchProviders('w1', ['a', 'b', 'a'])

    expect(posted).toHaveLength(1)
  })

  it('sends again when the set or the rewind height changes', async () => {
    const {walletSync, posted} = service()
    ;(walletSync as unknown as {transactionDAO: {getCursor: () => Promise<number | null>; resetCursor: () => Promise<void>}}).transactionDAO = {
      getCursor: async () => 100,
      resetCursor: async () => {},
    }

    await walletSync.watchProviders('w1', ['a'])
    await walletSync.watchProviders('w1', ['a', 'b'])
    await walletSync.watchProviders('w1', ['a', 'b'], 50)

    expect(posted).toHaveLength(3)
  })

  it('keeps wallets apart', async () => {
    const {walletSync, posted} = service()

    await walletSync.watchProviders('w1', ['a'])
    await walletSync.watchProviders('w2', ['a'])

    expect(posted).toHaveLength(2)
  })
})
