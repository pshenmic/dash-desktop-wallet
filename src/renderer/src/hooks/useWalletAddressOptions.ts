import { useCallback, useMemo } from 'react'
import { refreshAddresses, useAdresses } from '@renderer/hooks/useAdresses'
import { refreshReceiveRequests, useReceiveRequests } from '@renderer/hooks/useReceiveRequests'
import type { WalletAddressOptionsResult } from '@renderer/types/WalletAddressOptions'
import { masternodeWalletAddressOptions } from '@renderer/utils/masternodeAddressOptions'
import { walletAddressLabels } from '@renderer/utils/ownRecipients'

export function useWalletAddressOptions(walletId: string | undefined): WalletAddressOptionsResult {
  const { receiving, change, loading: addressesLoading, err: addressesError } = useAdresses(walletId)
  const { requests, loading: requestsLoading, err: requestsError } = useReceiveRequests(walletId, 'core')

  const labelsByAddress = useMemo(
    () => walletAddressLabels(requests, receiving, change),
    [requests, receiving, change],
  )

  const options = useMemo(
    () => masternodeWalletAddressOptions(receiving, change, requests, labelsByAddress),
    [receiving, change, requests, labelsByAddress],
  )

  const badgeFor = useCallback(
    (address: string) => labelsByAddress.get(address.trim()),
    [labelsByAddress],
  )

  const retry = useCallback(() => {
    if (!walletId) return
    void refreshAddresses(walletId)
    void refreshReceiveRequests(walletId)
  }, [walletId])

  return {
    options,
    labelsByAddress,
    badgeFor,
    loading: addressesLoading || requestsLoading,
    err: addressesError ?? requestsError,
    retry,
  }
}
