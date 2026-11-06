import { API } from '@renderer/api'
import type { MasternodeDto } from '@renderer/api/types'
import { MASTERNODE_CACHE_NAMESPACE, MASTERNODE_LOAD_ERROR, MASTERNODE_REFRESH_MS } from '@renderer/constants/masternodes'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export function useMasternodes(walletId: string) {
  const { data, loading, err } = useAsyncWithCache<MasternodeDto[]>(
    MASTERNODE_CACHE_NAMESPACE,
    walletId,
    () => API.getMasternodes(walletId),
    [],
    { errorMessage: MASTERNODE_LOAD_ERROR, refreshIntervalMs: MASTERNODE_REFRESH_MS }
  )
  return { nodes: data, loading, err }
}

export function refreshMasternodes(walletId: string): Promise<void> {
  invalidateAsyncCache(MASTERNODE_CACHE_NAMESPACE, walletId)
  return prefetchAsyncCache(MASTERNODE_CACHE_NAMESPACE, walletId, () => API.getMasternodes(walletId))
}
