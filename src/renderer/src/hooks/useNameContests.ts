import { useMemo } from 'react'
import { refreshDashPay } from './useDashPayRefresh'
import { useDashPayUsernames } from './useDashPayUsernames'
import { walletNameContests } from '@renderer/utils/nameContests'

export function useNameContests(walletId: string) {
  const { usernames, loading, err } = useDashPayUsernames(walletId)
  const contests = useMemo(() => walletNameContests(usernames), [usernames])
  return { contests, loading, err, retry: () => refreshDashPay(walletId).catch(() => {}) }
}
