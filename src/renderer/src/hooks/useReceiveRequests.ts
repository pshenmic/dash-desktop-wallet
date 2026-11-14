import { useMemo } from 'react'
import { API } from '@renderer/api'
import { RECEIVE_HISTORY_COPY, RECEIVE_LABEL_MAX_LENGTH } from '@renderer/constants/receivePage'
import type { ReceiveRequestDto, ReceiveRequestKind } from '@renderer/types/ReceiveRequest'
import { addressLabelsByAddress, toReceiveRequest } from '@renderer/utils/receiveDefaults'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

const EMPTY_REQUESTS: ReceiveRequestDto[] = []

const fetchReceiveRequests = (walletId: string): Promise<ReceiveRequestDto[]> =>
  API.getPaymentRequests(walletId).then((rows) => (rows ?? []).map(toReceiveRequest))

export async function addReceiveRequest(
  walletId: string,
  address: string,
  label: string | null,
  amountDuffs: bigint | null,
  message: string | null = null,
): Promise<void> {
  const trimmedLabel = label?.trim() ?? ''
  const normalizedLabel = trimmedLabel !== '' ? trimmedLabel.slice(0, RECEIVE_LABEL_MAX_LENGTH) : null
  await API.createPaymentRequest(walletId, address, amountDuffs, normalizedLabel, message)
  await refreshReceiveRequests(walletId)
}

export async function deleteReceiveRequest(walletId: string, id: number): Promise<void> {
  await API.deletePaymentRequest(walletId, id)
  await refreshReceiveRequests(walletId)
}

export function useReceiveRequests(walletId: string | undefined, kind?: ReceiveRequestKind) {
  const { data, loading, err } = useAsyncWithCache<ReceiveRequestDto[]>(
    'paymentRequests',
    walletId,
    () => fetchReceiveRequests(walletId!),
    EMPTY_REQUESTS,
    { errorMessage: RECEIVE_HISTORY_COPY.loadFailed },
  )

  const requests = useMemo(
    () => (kind == null ? data : data.filter((request) => request.kind === kind)),
    [data, kind],
  )

  const labelsByAddress = useMemo(
    () => addressLabelsByAddress(requests),
    [requests],
  )

  return { requests, allRequests: data, labelsByAddress, loading, err }
}

export function prefetchReceiveRequests(walletId: string): Promise<void> {
  return prefetchAsyncCache('paymentRequests', walletId, () => fetchReceiveRequests(walletId))
}

export function refreshReceiveRequests(walletId: string): Promise<void> {
  invalidateAsyncCache('paymentRequests', walletId)
  return prefetchReceiveRequests(walletId)
}
