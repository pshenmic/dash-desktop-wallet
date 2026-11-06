import type { IdentityApiDto } from '@renderer/hooks/useIdentities'

export interface IdentitiesSearchState {
  query: string
  setQuery: (query: string) => void
}

export interface IdentityRowProps {
  identity: IdentityApiDto
  votingNames: string[]
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
