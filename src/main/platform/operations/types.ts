import {DashPlatformSDK} from 'dash-platform-sdk'
import {PlatformVersionWASM} from 'pshenmic-dpp'
import {Network} from '../../src/types/Network'
import {PlatformErrorCode, PlatformPhase} from '../types/messages'

// What an operation is given. No requestId: PlatformService binds the emitters,
// so nothing below this line knows about the transport.
export interface OperationContext {
  sdk: DashPlatformSDK
  network: Network
  // Fees and document ids are versioned, and consensus checks them at the version
  // the network runs, not the newest one this dpp build knows.
  platformVersion: Promise<PlatformVersionWASM>
  signal: AbortSignal
  progress: (phase: PlatformPhase, fetched: number, total: number) => void
  notesSpent: (indexes: number[]) => void
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new Error('request aborted')
}

// Carries an stHash when the transition reached the network, so main can tell
// "retry is safe" from "this may already be in a block".
export class OperationError extends Error {
  readonly code: PlatformErrorCode
  readonly stHash: string | null

  constructor(message: string, code: PlatformErrorCode, stHash: string | null = null) {
    super(message)
    this.name = 'OperationError'
    this.code = code
    this.stHash = stHash
  }
}
