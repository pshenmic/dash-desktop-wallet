import type { MasternodeDto } from '@renderer/api/types'
import {
  PENDING_MASTERNODES_STORAGE_PREFIX,
  PENDING_MASTERNODE_TTL_MS,
  REGISTERING_MASTERNODE_STATUS,
} from '@renderer/constants/masternodes'
import type { PendingMasternodeEntry } from '@renderer/types/PendingMasternode'

const listeners = new Set<() => void>()

function storageKey(walletId: string): string {
  return `${PENDING_MASTERNODES_STORAGE_PREFIX}.${walletId}`
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function notifyPendingListeners(): void {
  listeners.forEach(listener => listener())
}

export function subscribePendingMasternodes(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function pendingMasternodeToDto(entry: PendingMasternodeEntry): MasternodeDto {
  return {
    proTxHash: entry.proTxHash,
    type: entry.type,
    status: REGISTERING_MASTERNODE_STATUS,
    posePenaltyScore: null,
    collateralTxid: entry.collateralTxid,
    collateralVout: entry.collateralVout,
    collateralAddress: entry.collateralAddress,
    serviceAddress: entry.serviceAddress,
    payeeAddress: entry.payeeAddress,
    ownerAddress: entry.ownerAddress,
    votingAddress: entry.votingAddress ?? '',
    operatorPublicKey: entry.operatorPublicKey ?? '',
    ownerKeyIndex: null,
    votingKeyIndex: null,
    operatorKeyIndex: null,
    importedRoles: [],
    importedSigningRoles: [],
    platformNodeId: entry.platformNodeId,
    platformP2PPort: entry.platformP2PPort,
    platformHttpPort: entry.platformHttpPort,
    lastPaidBlock: null,
    lastPaidTime: null,
    registeredHeight: null,
    isShared: false,
    shares: null,
  }
}

export function activePendingMasternodes(
  entries: PendingMasternodeEntry[],
  backendNodes: MasternodeDto[] | null,
  now = Date.now(),
): PendingMasternodeEntry[] {
  const discoveredHashes = new Set((backendNodes ?? []).map(node => node.proTxHash))
  return entries.filter(entry =>
    !discoveredHashes.has(entry.proTxHash)
    && now - entry.createdAt >= 0
    && now - entry.createdAt < PENDING_MASTERNODE_TTL_MS,
  )
}

export function mergePendingMasternodes(
  backendNodes: MasternodeDto[] | null,
  entries: PendingMasternodeEntry[],
  now = Date.now(),
): MasternodeDto[] {
  const backend = backendNodes ?? []
  const pending = activePendingMasternodes(entries, backendNodes, now).map(pendingMasternodeToDto)
  return [...pending, ...backend]
}

export function readPendingMasternodes(walletId: string, now = Date.now()): PendingMasternodeEntry[] {
  const storage = getStorage()
  if (storage == null) return []
  try {
    const raw = storage.getItem(storageKey(walletId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return activePendingMasternodes(parsed as PendingMasternodeEntry[], null, now)
  } catch {
    return []
  }
}

function writePendingMasternodes(walletId: string, entries: PendingMasternodeEntry[]): void {
  const storage = getStorage()
  if (storage == null) return
  try {
    if (entries.length === 0) storage.removeItem(storageKey(walletId))
    else storage.setItem(storageKey(walletId), JSON.stringify(entries))
  } catch {
  }
}

export function recordPendingMasternode(walletId: string, entry: PendingMasternodeEntry): void {
  const existing = readPendingMasternodes(walletId, entry.createdAt)
    .filter(item => item.proTxHash !== entry.proTxHash)
  writePendingMasternodes(walletId, [entry, ...existing])
  notifyPendingListeners()
}

export function prunePendingMasternodes(walletId: string, backendNodes: MasternodeDto[], now = Date.now()): void {
  const existing = readPendingMasternodes(walletId, now)
  if (existing.length === 0) return
  const remaining = activePendingMasternodes(existing, backendNodes, now)
  if (remaining.length === existing.length) return
  writePendingMasternodes(walletId, remaining)
  notifyPendingListeners()
}
