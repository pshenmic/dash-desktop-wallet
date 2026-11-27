import { API } from '@renderer/api'
import type { ShieldedNoteInfo, ShieldedSyncState } from '@renderer/api/types'
import { SHIELDED_ADDRESSES_CACHE_NS, SHIELDED_ADDRESS_BATCH_SIZE } from '@renderer/constants'
import type { CachedShieldedAddresses, UseShieldedAddressesResult } from '@renderer/types/ShieldedAddresses'
import {
  deriveShieldedAddressBatch,
  ensureShieldedAddressPool,
  waitForShieldedSyncSettled,
} from '@renderer/utils/shieldedAddressPool'
import {
  invalidateAsyncCache,
  prefetchAsyncCache,
  setAsyncCache,
  useAsyncWithCache,
} from './useAsyncWithCache'

const EMPTY_SHIELDED_ADDRESSES: CachedShieldedAddresses = { walletId: '', addresses: null }

const inFlightTopUps = new Map<string, Promise<string[]>>()
const inFlightSyncJobs = new Map<string, Promise<void>>()

const normalizeAddresses = (addresses: string[] | null | undefined): string[] | null =>
  addresses != null && addresses.length > 0 ? addresses : null

const fetchShieldedAddresses = (walletId: string): Promise<CachedShieldedAddresses> =>
  API.getShieldedAddresses(walletId)
    .then((cached) => ({ walletId, addresses: normalizeAddresses(cached) }))
    .catch(() => ({ walletId, addresses: null }))

export function useShieldedAddresses(walletId: string | undefined): UseShieldedAddressesResult {
  const { data, loading } = useAsyncWithCache<CachedShieldedAddresses>(
    SHIELDED_ADDRESSES_CACHE_NS,
    walletId,
    () => fetchShieldedAddresses(walletId!),
    EMPTY_SHIELDED_ADDRESSES,
  )

  if (walletId === undefined) return { addresses: null, loading: false }
  const matchesWallet = data.walletId === walletId
  return {
    addresses: matchesWallet ? data.addresses : null,
    loading: loading || !matchesWallet,
  }
}

export function setShieldedAddresses(walletId: string, addresses: string[] | null): void {
  setAsyncCache<CachedShieldedAddresses>(SHIELDED_ADDRESSES_CACHE_NS, walletId, {
    walletId,
    addresses: normalizeAddresses(addresses),
  })
}

export function prefetchShieldedAddresses(walletId: string): Promise<void> {
  return prefetchAsyncCache(SHIELDED_ADDRESSES_CACHE_NS, walletId, () => fetchShieldedAddresses(walletId))
}

export function refreshShieldedAddresses(walletId: string): Promise<void> {
  invalidateAsyncCache(SHIELDED_ADDRESSES_CACHE_NS, walletId)
  return prefetchShieldedAddresses(walletId)
}

export async function deriveMoreShieldedAddresses(
  walletId: string,
  password: string,
  batchSize: number = SHIELDED_ADDRESS_BATCH_SIZE,
): Promise<string[]> {
  const next = await deriveShieldedAddressBatch(walletId, password, batchSize)
  setShieldedAddresses(walletId, next)
  return next
}

export function topUpShieldedAddresses(
  walletId: string,
  password: string,
  notes: ShieldedNoteInfo[],
): Promise<string[]> {
  const existing = inFlightTopUps.get(walletId)
  if (existing) return existing

  const job = ensureShieldedAddressPool({ walletId, password, notes })
    .then((next) => {
      setShieldedAddresses(walletId, next)
      return next
    })
    .finally(() => {
      if (inFlightTopUps.get(walletId) === job) inFlightTopUps.delete(walletId)
    })

  inFlightTopUps.set(walletId, job)
  return job
}

export async function startShieldedSyncWithAddressPool(
  walletId: string,
  password: string,
): Promise<ShieldedSyncState> {
  const initialState = await API.startShieldedSync(walletId, password)
  if (!inFlightSyncJobs.has(walletId)) {
    const job = waitForShieldedSyncSettled(walletId, initialState)
      .then((settled) => {
        if (settled !== null) {
          return topUpShieldedAddresses(walletId, password, settled.notes).then(() => {})
        }
        return undefined
      })
      .catch(() => {})
      .finally(() => {
        if (inFlightSyncJobs.get(walletId) === job) inFlightSyncJobs.delete(walletId)
      })
    inFlightSyncJobs.set(walletId, job)
  }
  return initialState
}
