import type { ReactNode } from 'react'
import type { MasternodeIdentityRole } from '@renderer/api/types'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'

export interface MasternodeIdentityBinding {
  proTxHash: string
  role: MasternodeIdentityRole
}

export interface MasternodeIdentityView {
  identity: IdentityApiDto
  bindings: MasternodeIdentityBinding[]
}

export interface IdentitiesSearchState {
  query: string
  setQuery: (query: string) => void
}

export interface IdentityRowProps {
  identity: IdentityApiDto
  votingNames: string[]
  badges?: ReactNode
  readOnly?: boolean
  onOpen: (identifier: string) => void
}

export interface IdentityVotingNameProps {
  name: string
  extraNames?: number
  onOpen?: () => void
}

export interface IdentityDetailProps {
  walletId: string
  identifier: string
}
