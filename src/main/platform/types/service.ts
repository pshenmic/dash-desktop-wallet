import type {RecoveredNoteWASM} from 'dash-platform-shielded'

export interface InFlight {
  controller: AbortController
  settled: boolean
}

export interface CheckedNote {
  recoveredNote: RecoveredNoteWASM
  spent: boolean
}
