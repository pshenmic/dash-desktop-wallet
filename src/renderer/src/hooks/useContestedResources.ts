import { useMemo } from 'react'
import { API } from '@renderer/api'
import type { ContestedResourceDto } from '@renderer/api/types'
import {
  CONTESTED_RESOURCES_ERROR,
  CONTESTED_RESOURCES_NAMESPACE,
  CONTESTED_RESOURCES_REFRESH_MS,
} from '@renderer/constants/dao'
import { mergeContestedResources } from '@renderer/utils/contestedResources'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'
import { refreshDashPay } from './useDashPayRefresh'
import { useDashPayUsernames } from './useDashPayUsernames'
import { useIdentities } from './useIdentities'

export function useContestedResources(walletId: string) {
  const network = useAsyncWithCache<ContestedResourceDto[]>(
    CONTESTED_RESOURCES_NAMESPACE,
    walletId,
    () => API.getContestedResources(walletId),
    [],
    { errorMessage: CONTESTED_RESOURCES_ERROR, refreshIntervalMs: CONTESTED_RESOURCES_REFRESH_MS },
  )
  const { usernames, loading: usernamesLoading, err: usernamesErr } = useDashPayUsernames(walletId)
  const { identities } = useIdentities(walletId)

  const walletIdentityIds = useMemo(
    () => new Set(identities.map(identity => identity.identifier)),
    [identities],
  )

  const contests = useMemo(
    () => mergeContestedResources(network.data, usernames, walletIdentityIds),
    [network.data, usernames, walletIdentityIds],
  )

  return {
    contests,
    loading: network.loading || usernamesLoading,
    err: contests.length === 0 ? (network.err ?? usernamesErr) : null,
    retry: () => {
      void refreshContestedResources(walletId)
      void refreshDashPay(walletId).catch(() => {})
    },
  }
}

export async function refreshContestedResources(walletId: string): Promise<void> {
  invalidateAsyncCache(CONTESTED_RESOURCES_NAMESPACE, walletId)
  await prefetchAsyncCache(CONTESTED_RESOURCES_NAMESPACE, walletId, () => API.getContestedResources(walletId))
}
