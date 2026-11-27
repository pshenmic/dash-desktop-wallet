import { useEffect, useMemo, useState } from 'react'
import { API } from '@renderer/api'
import type { ImportedMasternodeKeyDto, MasternodeDto } from '@renderer/api/types'
import {
  MASTERNODE_CACHE_NAMESPACE,
  MASTERNODE_IMPORTED_KEYS_ERROR,
  MASTERNODE_IMPORTED_KEYS_NAMESPACE,
  MASTERNODE_LOAD_ERROR,
  MASTERNODE_REFRESH_MS,
  MASTERNODE_UNMATCHED_KEYS_ERROR,
  MASTERNODE_UNMATCHED_KEYS_NAMESPACE,
} from '@renderer/constants/masternodes'
import {
  mergePendingMasternodes,
  prunePendingMasternodes,
  readPendingMasternodes,
  subscribePendingMasternodes,
} from '@renderer/utils/pendingMasternodes'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export function useMasternodes(walletId: string) {
  const { data, loading, err } = useAsyncWithCache<MasternodeDto[] | null>(
    MASTERNODE_CACHE_NAMESPACE,
    walletId,
    () => API.getMasternodes(walletId),
    null,
    { errorMessage: MASTERNODE_LOAD_ERROR, refreshIntervalMs: MASTERNODE_REFRESH_MS }
  )
  const [pendingVersion, setPendingVersion] = useState(0)

  useEffect(() => subscribePendingMasternodes(() => setPendingVersion(version => version + 1)), [])

  useEffect(() => {
    if (data != null) prunePendingMasternodes(walletId, data)
  }, [walletId, data])

  const nodes = useMemo(
    () => mergePendingMasternodes(data, readPendingMasternodes(walletId)),
    [walletId, data, pendingVersion],
  )

  return { nodes, discovered: data !== null || nodes.length > 0, loading, err }
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

export function useUnmatchedImportedMasternodeKeys(walletId: string): {
  unmatchedKeys: ImportedMasternodeKeyDto[]
  resolved: boolean
  loading: boolean
  err: string | null
} {
  const { data, loading, err } = useAsyncWithCache<ImportedMasternodeKeyDto[] | null>(
    MASTERNODE_UNMATCHED_KEYS_NAMESPACE,
    walletId,
    () => API.getUnmatchedImportedMasternodeKeys(walletId),
    null,
    { errorMessage: MASTERNODE_UNMATCHED_KEYS_ERROR, refreshIntervalMs: MASTERNODE_REFRESH_MS }
  )
  return { unmatchedKeys: data ?? [], resolved: data !== null, loading, err }
}

export function refreshUnmatchedImportedMasternodeKeys(walletId: string): Promise<void> {
  invalidateAsyncCache(MASTERNODE_UNMATCHED_KEYS_NAMESPACE, walletId)
  return prefetchAsyncCache(MASTERNODE_UNMATCHED_KEYS_NAMESPACE, walletId, () => API.getUnmatchedImportedMasternodeKeys(walletId))
}
