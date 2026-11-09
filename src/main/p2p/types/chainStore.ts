export interface PersistedHeader {
  height: number
  hash: string
  prevHash: string
  time: number
  nBits: number
  raw: Uint8Array
}

export interface ChainTipState {
  tipHeight: number
  tipHash: string | null
}

export interface StoredState extends ChainTipState {
  updatedAt: number
}

// When the object list, and each proposal's votes, were last asked for.
export interface GovernanceSyncState {
  syncedAt: number
  votesSyncedAt: Record<string, number>
}
