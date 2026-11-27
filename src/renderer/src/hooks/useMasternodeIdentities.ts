import { API } from '@renderer/api'
import type { MasternodeIdentityInfoDto } from '@renderer/api/types'
import { IDENTITIES_REFRESH_MS } from '@renderer/constants'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

const EMPTY_MASTERNODE_IDENTITIES: MasternodeIdentityInfoDto[] = []

const fetchMasternodeIdentities = (walletId: string): Promise<MasternodeIdentityInfoDto[]> =>
  API.getMasternodeIdentities(walletId).then(rows => rows ?? [])

export function useMasternodeIdentities(walletId?: string) {
  const { data: masternodeIdentities, loading, err } = useAsyncWithCache<MasternodeIdentityInfoDto[]>(
    'masternodeIdentities',
    walletId,
    () => fetchMasternodeIdentities(walletId!),
    EMPTY_MASTERNODE_IDENTITIES,
    { errorMessage: 'Failed to load masternode identities', refreshIntervalMs: IDENTITIES_REFRESH_MS },
  )
  return { masternodeIdentities, loading, err }
}

export function prefetchMasternodeIdentities(walletId: string): Promise<void> {
  return prefetchAsyncCache('masternodeIdentities', walletId, () => fetchMasternodeIdentities(walletId))
}

export function refreshMasternodeIdentities(walletId: string): Promise<void> {
  invalidateAsyncCache('masternodeIdentities', walletId)
  return prefetchMasternodeIdentities(walletId)
}
