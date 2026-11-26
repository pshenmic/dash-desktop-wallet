import type { ReactNode } from 'react'
import type { PlatformAddressDto } from '../api/types'
import type { DestinationKind } from '../enums/DestinationKind'
import type { SourceKind } from '../enums/SourceKind'
import type { IdentityApiDto } from '../hooks/useIdentities'
import type { DropdownFieldOption } from './DropdownField'

export interface EndpointKindIconProps {
  kind: string
}

export interface EndpointKindEntry {
  kind: string
  label: string
}

export interface KindDropdownProps {
  kinds: EndpointKindEntry[]
  selected: string
  onSelect: (kind: string) => void
}

export interface SourcePickerProps {
  kind: SourceKind
  onKindChange: (kind: SourceKind) => void
  kinds?: Array<{kind: SourceKind; label: string}>
  label?: string
  platformAddresses: PlatformAddressDto[]
  selectedPlatformAddress: PlatformAddressDto | undefined
  onPlatformAddressChange: (address: string) => void
  platformAutomaticLabel?: string
  platformAddressesLoading?: boolean
  platformAddressesError?: string | null
  onRetryPlatformAddresses?: () => void
  showPlatformAddress?: boolean
  identities: IdentityApiDto[]
  identitiesLoading: boolean
  identitiesError: string | null
  selectedIdentity: IdentityApiDto | undefined
  onIdentityChange: (identifier: string) => void
  onRetryIdentities: () => void
  compact?: boolean
  trailingControl?: ReactNode
}

export interface DestinationPickerProps {
  kind: DestinationKind
  kinds: EndpointKindEntry[]
  onKindChange: (kind: DestinationKind) => void
  value: string
  valueBadge?: string
  onValueChange: (value: string) => void
  placeholder: string
  error: string | null
  showValueInput: boolean
  ownOptions?: DropdownFieldOption[]
  ownOptionsLoading?: boolean
  ownOptionsError?: string | null
  onRetryOwnOptions?: () => void
  compact?: boolean
  trailingControl?: ReactNode
}
