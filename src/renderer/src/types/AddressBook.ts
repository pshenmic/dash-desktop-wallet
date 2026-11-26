import type { Contact, Network } from '@renderer/api/types'
import type { DestinationKind } from '@renderer/enums/DestinationKind'
import type { DropdownFieldOption } from './DropdownField'

export type AddressBookTab = 'contacts' | 'own'

export type ContactFilterScope = 'compatible' | 'all'

export type ContactDestinationKind = Exclude<DestinationKind, DestinationKind.NewIdentity>

export type ContactFormMode =
  | { kind: 'add' }
  | { kind: 'edit'; contact: Contact }

export interface AddressBookContactEntry {
  contact: Contact
  kind: ContactDestinationKind | null
  compatible: boolean
}

export interface ContactFilterParams {
  contacts: Contact[]
  destination: DestinationKind
  network: Network | null
  scope: ContactFilterScope
  query: string
}

export interface ContactFilterResult {
  entries: AddressBookContactEntry[]
  compatibleCount: number
}

export interface ContactFormValidationParams {
  label: string
  address: string
  destination: DestinationKind
  network: Network | null
  scope: ContactFilterScope
  contacts: Contact[]
  editingId: number | null
}

export interface ContactFormValidationResult {
  valid: boolean
  detectedKind: ContactDestinationKind | null
  addressError: string | null
  incompatibleNotice: string | null
}

export interface UseAddressBook {
  contacts: Contact[]
  loading: boolean
  err: string | null
  network: Network | undefined
  reload: () => void
  addContact: (label: string, address: string) => Promise<void>
  updateContact: (contact: Contact, label: string, address: string) => Promise<void>
  deleteContact: (id: number) => Promise<void>
}

export interface AddressBookModalProps {
  open: boolean
  onClose: () => void
  destination: DestinationKind
  network: Network | null
  currentValue: string
  onSelect: (address: string) => void
  ownOptions?: DropdownFieldOption[]
  ownOptionsHeading?: string
  ownOptionsLoading?: boolean
  ownOptionsError?: string | null
  onRetryOwnOptions?: () => void
  valueAvatar?: boolean
}
