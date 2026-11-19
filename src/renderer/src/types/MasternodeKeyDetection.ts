import type { MasternodeKeyRole, Network } from '@renderer/api/types'

export type DetectedMasternodeKey =
  | { kind: 'empty' }
  | {
      kind: 'bls'
      normalizedKey: string
      role: 'operator'
      publicKey: string
      matchedService: string | null
      alreadyImported: boolean
    }
  | {
      kind: 'wif'
      normalizedKey: string
      keyNetwork: Network
      address: string
      networkMismatch: boolean
      matchedRole: 'owner' | 'voting' | null
      matchedService: string | null
      alreadyImportedRoles: MasternodeKeyRole[]
    }
  | { kind: 'invalid'; message: string }
