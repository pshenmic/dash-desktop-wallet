import { useMemo, useSyncExternalStore } from 'react'
import { RECEIVE_LABEL_MAX_LENGTH, RECEIVE_REQUESTS_STORAGE_PREFIX } from '@renderer/constants/receivePage'
import type { ReceiveRequestDto, ReceiveRequestKind, StoredReceiveRequest } from '@renderer/types/ReceiveRequest'
import { addressLabelsByAddress } from '@renderer/utils/receiveDefaults'

const EMPTY_REQUESTS: ReceiveRequestDto[] = []
const cacheByWallet = new Map<string, ReceiveRequestDto[]>()
let listeners: Array<() => void> = []

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((item) => item !== listener)
  }
}

function storageKey(walletId: string): string {
  return `${RECEIVE_REQUESTS_STORAGE_PREFIX}${walletId}`
}

function readWalletRequests(walletId: string): ReceiveRequestDto[] {
  const cached = cacheByWallet.get(walletId)
  if (cached) return cached

  try {
    const raw = localStorage.getItem(storageKey(walletId))
    if (!raw) {
      cacheByWallet.set(walletId, EMPTY_REQUESTS)
      return EMPTY_REQUESTS
    }
    const parsed = JSON.parse(raw) as StoredReceiveRequest[]
    if (!Array.isArray(parsed)) {
      cacheByWallet.set(walletId, EMPTY_REQUESTS)
      return EMPTY_REQUESTS
    }
    const hydrated: ReceiveRequestDto[] = parsed.map((item) => ({
      id: item.id,
      walletId: item.walletId,
      kind: item.kind,
      address: item.address,
      label: item.label,
      amountDuffs: item.amountDuffs !== null ? BigInt(item.amountDuffs) : null,
      createdAt: item.createdAt,
    }))
    cacheByWallet.set(walletId, hydrated)
    return hydrated
  } catch {
    cacheByWallet.set(walletId, EMPTY_REQUESTS)
    return EMPTY_REQUESTS
  }
}

function writeWalletRequests(walletId: string, requests: ReceiveRequestDto[]): void {
  cacheByWallet.set(walletId, requests)
  try {
    const serialized: StoredReceiveRequest[] = requests.map((item) => ({
      id: item.id,
      walletId: item.walletId,
      kind: item.kind,
      address: item.address,
      label: item.label,
      amountDuffs: item.amountDuffs !== null ? item.amountDuffs.toString() : null,
      createdAt: item.createdAt,
    }))
    localStorage.setItem(storageKey(walletId), JSON.stringify(serialized))
  } catch {
    // Ignore storage write errors
  }
  emit()
}

export function addReceiveRequest(
  walletId: string,
  kind: ReceiveRequestKind,
  address: string,
  label: string | null,
  amountDuffs: bigint | null,
): ReceiveRequestDto {
  const current = readWalletRequests(walletId)
  const trimmedLabel = label?.trim() ?? ''
  const normalizedLabel = trimmedLabel !== '' ? trimmedLabel.slice(0, RECEIVE_LABEL_MAX_LENGTH) : null
  const created: ReceiveRequestDto = {
    id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
    walletId,
    kind,
    address,
    label: normalizedLabel,
    amountDuffs,
    createdAt: Date.now(),
  }
  writeWalletRequests(walletId, [created, ...current])
  return created
}

export function deleteReceiveRequest(walletId: string, id: number): void {
  const current = readWalletRequests(walletId)
  writeWalletRequests(
    walletId,
    current.filter((item) => item.id !== id),
  )
}

export function useReceiveRequests(walletId: string | undefined, kind?: ReceiveRequestKind) {
  const data = useSyncExternalStore(
    subscribe,
    () => (walletId ? readWalletRequests(walletId) : EMPTY_REQUESTS),
  )

  const requests = useMemo(
    () => (kind == null ? data : data.filter((request) => request.kind === kind)),
    [data, kind],
  )

  const labelsByAddress = useMemo(
    () => addressLabelsByAddress(requests),
    [requests],
  )

  return { requests, allRequests: data, labelsByAddress, loading: false, err: null }
}

export function prefetchReceiveRequests(walletId: string): Promise<void> {
  readWalletRequests(walletId)
  return Promise.resolve()
}

export function refreshReceiveRequests(walletId: string): Promise<void> {
  cacheByWallet.delete(walletId)
  readWalletRequests(walletId)
  emit()
  return Promise.resolve()
}
