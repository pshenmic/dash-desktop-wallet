import {PlatformError, PlatformKind, PlatformPhase} from '../../platform/types/messages'

export interface PendingRequest {
  kind: PlatformKind
  settle: (outcome: {ok: true; result: unknown} | {ok: false; error: PlatformError}) => void
}

export interface PlatformRequestOptions {
  onProgress?: (phase: PlatformPhase) => void
  onNotesSpent?: (indexes: number[]) => void
}