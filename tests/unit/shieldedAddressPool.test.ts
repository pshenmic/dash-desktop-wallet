import { describe, it, expect, vi } from 'vitest'
import { receiveCardCopy } from '../../src/renderer/src/constants/receivePage'
import { ShieldedSyncPhase } from '../../src/renderer/src/enums/ShieldedSyncPhase'
import type { ShieldedNoteInfo, ShieldedSyncState } from '../../src/renderer/src/api/types'
import {
  deriveShieldedAddressBatch,
  ensureShieldedAddressPool,
  waitForShieldedSyncSettled,
} from '../../src/renderer/src/utils/shieldedAddressPool'

const syncState = (phase: ShieldedSyncPhase, notes: ShieldedNoteInfo[] = []): ShieldedSyncState => ({
  phase,
  fetched: 0,
  total: 0,
  balance: 0n,
  notes,
  error: null,
  syncedAt: phase === ShieldedSyncPhase.Done ? 1_000 : null,
})

describe('deriveShieldedAddressBatch', () => {
  it('derives +10 new addresses when addShieldedAddress adds one address per call', async () => {
    const addresses = Array.from({ length: 5 }, (_, i) => `dash-s-${i}`)
    const addShieldedAddress = vi.fn(async () => {
      addresses.push(`dash-s-${addresses.length}`)
      return [...addresses]
    })

    const result = await deriveShieldedAddressBatch('w1', 'pwd', 10, {
      getShieldedAddresses: vi.fn(async () => [...addresses]),
      addShieldedAddress,
    })

    expect(addShieldedAddress).toHaveBeenCalledTimes(10)
    expect(result).toHaveLength(15)
  })

  it('stops in 5 calls when the first backend call widens the gap window by 6', async () => {
    const addresses = Array.from({ length: 5 }, (_, i) => `dash-s-${i}`)
    let call = 0
    const addShieldedAddress = vi.fn(async () => {
      call++
      const toAdd = call === 1 ? 6 : 1
      for (let i = 0; i < toAdd; i++) {
        addresses.push(`dash-s-${addresses.length}`)
      }
      return [...addresses]
    })

    const result = await deriveShieldedAddressBatch('w1', 'pwd', 10, {
      getShieldedAddresses: vi.fn(async () => [...addresses]),
      addShieldedAddress,
    })

    expect(addShieldedAddress).toHaveBeenCalledTimes(5)
    expect(result).toHaveLength(15)
  })

  it('breaks safely without hanging if addShieldedAddress returns a non-growing array', async () => {
    const addresses = ['dash-s-0', 'dash-s-1']
    const addShieldedAddress = vi.fn(async () => [...addresses])

    const result = await deriveShieldedAddressBatch('w1', 'pwd', 10, {
      getShieldedAddresses: vi.fn(async () => [...addresses]),
      addShieldedAddress,
    })

    expect(addShieldedAddress).toHaveBeenCalledTimes(1)
    expect(result).toEqual(addresses)
  })
})

describe('ensureShieldedAddressPool', () => {
  it('derives +10 when total addresses are below 10', async () => {
    const addresses = Array.from({ length: 5 }, (_, i) => `dash-s-${i}`)
    const addShieldedAddress = vi.fn(async () => {
      addresses.push(`dash-s-${addresses.length}`)
      return [...addresses]
    })

    const result = await ensureShieldedAddressPool({
      walletId: 'w1',
      password: 'pwd',
      notes: [],
      api: {
        getShieldedAddresses: vi.fn(async () => [...addresses]),
        addShieldedAddress,
        getPaymentRequests: vi.fn(async () => []),
      },
    })

    expect(addShieldedAddress).toHaveBeenCalledTimes(10)
    expect(result).toHaveLength(15)
  })

  it('derives +10 when funded notes and payment requests leave fewer than 10 available addresses', async () => {
    const addresses = Array.from({ length: 12 }, (_, i) => `dash-s-${i}`)
    const addShieldedAddress = vi.fn(async () => {
      addresses.push(`dash-s-${addresses.length}`)
      return [...addresses]
    })
    const notes: ShieldedNoteInfo[] = [
      { index: 0, amount: 50_000n, spent: false, address: 'dash-s-0' },
      { index: 1, amount: 100_000n, spent: false, address: 'dash-s-1' },
      { index: 2, amount: 75_000n, spent: true, address: 'dash-s-2' },
    ]
    const requests = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      walletId: 'w1',
      address: `dash-s-${i + 2}`,
      amountDuffs: null,
      label: null,
      message: null,
      createdAt: 1_000,
    }))

    const result = await ensureShieldedAddressPool({
      walletId: 'w1',
      password: 'pwd',
      notes,
      api: {
        getShieldedAddresses: vi.fn(async () => [...addresses]),
        addShieldedAddress,
        getPaymentRequests: vi.fn(async () => requests),
      },
    })

    expect(addShieldedAddress).toHaveBeenCalledTimes(10)
    expect(result).toHaveLength(22)
  })

  it('does not call addShieldedAddress when at least 10 unfunded and unclaimed addresses exist', async () => {
    const addresses = Array.from({ length: 12 }, (_, i) => `dash-s-${i}`)
    const addShieldedAddress = vi.fn()
    const notes: ShieldedNoteInfo[] = [
      { index: 0, amount: 10_000n, spent: false, address: 'dash-s-0' },
    ]
    const requests = [
      {
        id: 1,
        walletId: 'w1',
        address: 'dash-s-1',
        amountDuffs: null,
        label: 'Test',
        message: null,
        createdAt: 1_000,
      },
    ]

    const result = await ensureShieldedAddressPool({
      walletId: 'w1',
      password: 'pwd',
      notes,
      api: {
        getShieldedAddresses: vi.fn(async () => [...addresses]),
        addShieldedAddress,
        getPaymentRequests: vi.fn(async () => requests),
      },
    })

    expect(addShieldedAddress).not.toHaveBeenCalled()
    expect(result).toHaveLength(12)
  })
})

describe('waitForShieldedSyncSettled', () => {
  it('polls through syncing and recovering to done and waits until undecodedCount reaches 0', async () => {
    const getShieldedSyncState = vi.fn()
      .mockResolvedValueOnce(syncState(ShieldedSyncPhase.Recovering))
      .mockResolvedValueOnce(syncState(ShieldedSyncPhase.Done, [{ index: 0, amount: 10n, spent: false, address: 'dash-s-0' }]))
    const getShieldedNotesInfo = vi.fn()
      .mockResolvedValueOnce({ undecodedCount: 2 })
      .mockResolvedValueOnce({ undecodedCount: 0 })

    const settled = await waitForShieldedSyncSettled(
      'w1',
      syncState(ShieldedSyncPhase.Syncing),
      { getShieldedSyncState, getShieldedNotesInfo },
      0,
      10,
      0,
      5,
    )

    expect(getShieldedSyncState).toHaveBeenCalledTimes(2)
    expect(getShieldedNotesInfo).toHaveBeenCalledTimes(2)
    expect(settled?.phase).toBe(ShieldedSyncPhase.Done)
    expect(settled?.notes).toHaveLength(1)
  })

  it('returns null when sync settles in error or idle', async () => {
    const getShieldedNotesInfo = vi.fn()

    const errored = await waitForShieldedSyncSettled(
      'w1',
      syncState(ShieldedSyncPhase.Syncing),
      {
        getShieldedSyncState: vi.fn().mockResolvedValueOnce(syncState(ShieldedSyncPhase.Error)),
        getShieldedNotesInfo,
      },
      0,
      10,
      0,
      5,
    )
    const idle = await waitForShieldedSyncSettled(
      'w1',
      syncState(ShieldedSyncPhase.Idle),
      {
        getShieldedSyncState: vi.fn(),
        getShieldedNotesInfo,
      },
      0,
      10,
      0,
      5,
    )

    expect(errored).toBeNull()
    expect(idle).toBeNull()
    expect(getShieldedNotesInfo).not.toHaveBeenCalled()
  })
})

describe('receiveCardCopy shielded plural copy', () => {
  it('uses plural phrasing for batch shielded address generation', () => {
    expect(receiveCardCopy.shieldedDeriveTitle).toBe('New shielded addresses')
    expect(receiveCardCopy.shieldedDerivePrompt).toContain('derive new ones')
    expect(receiveCardCopy.generateAddresses).toBe('Generate addresses')
  })
})
