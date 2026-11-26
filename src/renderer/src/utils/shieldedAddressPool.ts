import { API } from '@renderer/api'
import type { ShieldedSyncState } from '@renderer/api/types'
import {
  SHIELDED_ADDRESS_BATCH_SIZE,
  SHIELDED_ADDRESS_MIN_POOL,
  SHIELDED_DECODE_COMMIT_MAX_RETRIES,
  SHIELDED_DECODE_COMMIT_RETRY_MS,
  SHIELDED_SYNC_ACTIVE_POLL_MS,
  SHIELDED_SYNC_SETTLE_MAX_POLLS,
} from '@renderer/constants'
import { ShieldedSyncPhase } from '@renderer/enums/ShieldedSyncPhase'
import type { EnsureShieldedAddressPoolParams, ShieldedAddressPoolApi } from '@renderer/types/ShieldedAddresses'
import { unclaimedReceiveShieldedAddresses } from './receiveDefaults'
import { shieldedBalancesByAddress } from './shieldedBalances'

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

function isSyncRunning(phase: ShieldedSyncState['phase']): boolean {
  return phase === ShieldedSyncPhase.Syncing || phase === ShieldedSyncPhase.Recovering
}

async function deriveAddressDelta(
  walletId: string,
  password: string,
  current: string[],
  delta: number,
  api: Pick<ShieldedAddressPoolApi, 'addShieldedAddress'>,
): Promise<string[]> {
  let latest = current
  const targetCount = current.length + delta
  for (let i = 0; i < delta && latest.length < targetCount; i++) {
    const next = await api.addShieldedAddress(walletId, password)
    if (next.length <= latest.length) return next
    latest = next
  }
  return latest
}

export async function deriveShieldedAddressBatch(
  walletId: string,
  password: string,
  batchSize: number = SHIELDED_ADDRESS_BATCH_SIZE,
  api: Pick<ShieldedAddressPoolApi, 'getShieldedAddresses' | 'addShieldedAddress'> = API,
): Promise<string[]> {
  const initial = (await api.getShieldedAddresses(walletId)) ?? []
  return deriveAddressDelta(walletId, password, initial, batchSize, api)
}

export async function ensureShieldedAddressPool({
  walletId,
  password,
  notes,
  minPool = SHIELDED_ADDRESS_MIN_POOL,
  batchSize = SHIELDED_ADDRESS_BATCH_SIZE,
  api = API,
}: EnsureShieldedAddressPoolParams): Promise<string[]> {
  const [initial, requests] = await Promise.all([
    api.getShieldedAddresses(walletId, password),
    api.getPaymentRequests(walletId).catch(() => []),
  ])
  const current = initial ?? []
  const balances = shieldedBalancesByAddress(notes)
  const claimed = new Set((requests ?? []).map((request) => request.address))
  const available = unclaimedReceiveShieldedAddresses(current, balances, claimed)

  if (available.length >= minPool) return current
  return deriveAddressDelta(walletId, password, current, batchSize, api)
}

export async function waitForShieldedSyncSettled(
  walletId: string,
  initialState: ShieldedSyncState,
  api: Pick<ShieldedAddressPoolApi, 'getShieldedSyncState' | 'getShieldedNotesInfo'> = API,
  pollMs: number = SHIELDED_SYNC_ACTIVE_POLL_MS,
  maxPolls: number = SHIELDED_SYNC_SETTLE_MAX_POLLS,
  decodeRetryMs: number = SHIELDED_DECODE_COMMIT_RETRY_MS,
  maxDecodeRetries: number = SHIELDED_DECODE_COMMIT_MAX_RETRIES,
): Promise<ShieldedSyncState | null> {
  let state = initialState
  for (let i = 0; i < maxPolls && isSyncRunning(state.phase); i++) {
    await sleep(pollMs)
    state = await api.getShieldedSyncState(walletId)
  }
  if (state.phase !== ShieldedSyncPhase.Done) return null

  // syncNotes marks phase='done' right before awaiting setShieldedDecodedCount, while addAddress rejects if undecodedCount > 0.
  for (let i = 0; i < maxDecodeRetries; i++) {
    const { undecodedCount } = await api.getShieldedNotesInfo(walletId)
    if (undecodedCount === 0) break
    await sleep(decodeRetryMs)
  }
  return state
}
