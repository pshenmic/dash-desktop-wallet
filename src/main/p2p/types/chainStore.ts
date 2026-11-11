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

// When the object list, and each proposal's votes, were last answered, and when
// each `peer/proposal` (`peer/` for the list) was asked, which Core holds against a repeat.
export interface GovernanceSyncState {
  syncedAt: number
  votesSyncedAt: Record<string, number>
  asked: Record<string, number>
}
