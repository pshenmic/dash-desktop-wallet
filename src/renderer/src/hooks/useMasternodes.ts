import { API } from '@renderer/api'
import type { ImportedMasternodeKeyDto, MasternodeDto } from '@renderer/api/types'
import {
  MASTERNODE_CACHE_NAMESPACE,
  MASTERNODE_IMPORTED_KEYS_ERROR,
  MASTERNODE_IMPORTED_KEYS_NAMESPACE,
  MASTERNODE_LOAD_ERROR,
  MASTERNODE_REFRESH_MS,
} from '@renderer/constants/masternodes'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export function useMasternodes(walletId: string) {
  const { data, loading, err } = useAsyncWithCache<MasternodeDto[] | null>(
    MASTERNODE_CACHE_NAMESPACE,
    walletId,
    () => API.getMasternodes(walletId),
    null,
    { errorMessage: MASTERNODE_LOAD_ERROR, refreshIntervalMs: MASTERNODE_REFRESH_MS }
  )
  return { nodes: data ?? [], discovered: data !== null, loading, err }
}

export function refreshMasternodes(walletId: string): Promise<void> {
  invalidateAsyncCache(MASTERNODE_CACHE_NAMESPACE, walletId)
  return prefetchAsyncCache(MASTERNODE_CACHE_NAMESPACE, walletId, () => API.getMasternodes(walletId))
}

export function useImportedMasternodeKeys(walletId: string) {
  const { data, loading, err } = useAsyncWithCache<ImportedMasternodeKeyDto[]>(
    MASTERNODE_IMPORTED_KEYS_NAMESPACE,
    walletId,
    () => API.getImportedMasternodeKeys(walletId),
    [],
    { errorMessage: MASTERNODE_IMPORTED_KEYS_ERROR }
  )
  return { importedKeys: data, loading, err }
}

export function refreshImportedMasternodeKeys(walletId: string): Promise<void> {
  invalidateAsyncCache(MASTERNODE_IMPORTED_KEYS_NAMESPACE, walletId)
  return prefetchAsyncCache(MASTERNODE_IMPORTED_KEYS_NAMESPACE, walletId, () => API.getImportedMasternodeKeys(walletId))
}
