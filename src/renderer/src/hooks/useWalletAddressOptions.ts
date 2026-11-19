import { useCallback, useMemo } from 'react'
import { refreshAddresses, useAdresses } from '@renderer/hooks/useAdresses'
import { refreshReceiveRequests, useReceiveRequests } from '@renderer/hooks/useReceiveRequests'
import type { WalletAddressOptionsResult } from '@renderer/types/WalletAddressOptions'
import { masternodeWalletAddressOptions } from '@renderer/utils/masternodeAddressOptions'
import { pickFreshCollateralTargetAddress } from '@renderer/utils/masternodeCollateralPrep'
import { claimedReceiveAddresses, receiveCoreAddresses } from '@renderer/utils/receiveDefaults'

export function useWalletAddressOptions(walletId: string | undefined): WalletAddressOptionsResult {
  const { receiving, change, loading: addressesLoading, err: addressesError } = useAdresses(walletId)
  const { requests, labelsByAddress, loading: requestsLoading, err: requestsError } = useReceiveRequests(walletId)

  const claimedAddresses = useMemo(
    () => claimedReceiveAddresses(requests),
    [requests],
  )

  const defaultPayoutAddress = useMemo(
    () => pickFreshCollateralTargetAddress(receiving, claimedAddresses, labelsByAddress)
      ?? receiveCoreAddresses(receiving)[0]?.address
      ?? receiving.find(address => !address.isLocked)?.address
      ?? receiving[0]?.address
      ?? null,
    [receiving, claimedAddresses, labelsByAddress],
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
    receiving,
    change,
    requests,
    claimedAddresses,
    labelsByAddress,
    defaultPayoutAddress,
    badgeFor,
    loading: addressesLoading || requestsLoading,
    err: addressesError ?? requestsError,
    retry,
  }
}
