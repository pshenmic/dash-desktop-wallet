import { useMemo } from 'react'
import { API } from '@renderer/api'
import type { UsernameDto } from '@renderer/api/types'
import { DASHPAY_CACHE_NAMESPACES, DASHPAY_LOAD_ERRORS } from '@renderer/constants/dashPay'
import { DashPayReadiness, UsernameStatus } from '@renderer/enums/DashPay'
import type { IdentitySwitcherStatus } from '@renderer/types/DashPayOverview'
import { dashPayReadiness } from '@renderer/utils/dashPayReadiness'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'
import type { IdentityApiDto } from './useIdentities'

export function useDashPayUsernames(walletId: string | undefined) {
  const { data, loading, err } = useAsyncWithCache<UsernameDto[]>(
    DASHPAY_CACHE_NAMESPACES.usernames,
    walletId,
    () => API.getUsernames(walletId!),
    [],
    { errorMessage: DASHPAY_LOAD_ERRORS.usernames }
  )
  const votingIds = useMemo(() => new Set(data
    .filter(username => username.status === UsernameStatus.Voting)
    .map(username => username.identifier)), [data])
  const usernamesKnown = walletId !== undefined && !loading && err == null

  const identityStatus = (identity: IdentityApiDto): IdentitySwitcherStatus | null => {
    const { readiness } = dashPayReadiness(identity)
    if (readiness !== DashPayReadiness.NoUsername) return readiness
    if (votingIds.has(identity.identifier)) return UsernameStatus.Voting
    return usernamesKnown ? readiness : null
  }

  return { usernames: data, loading, err, votingIds, usernamesKnown, identityStatus }
}

export function refreshDashPayUsernames(walletId: string): Promise<void> {
  invalidateAsyncCache(DASHPAY_CACHE_NAMESPACES.usernames, walletId)
  return prefetchAsyncCache(DASHPAY_CACHE_NAMESPACES.usernames, walletId, () => API.getUsernames(walletId))
}
