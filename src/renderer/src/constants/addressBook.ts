import type { Contact } from '@renderer/api/types'
import { DestinationKind } from '@renderer/enums/DestinationKind'
import type { ContactDestinationKind, ContactFilterScope } from '@renderer/types/AddressBook'
import { RECEIVE_LABEL_MAX_LENGTH } from './receivePage'

export const ADDRESS_BOOK_LABEL_MAX_LENGTH = RECEIVE_LABEL_MAX_LENGTH

export const EMPTY_CONTACTS: Contact[] = []

export const ADDRESS_BOOK_SCOPE_OPTIONS: Array<{ value: ContactFilterScope; label: string }> = [
  { value: 'compatible', label: 'Compatible' },
  { value: 'all', label: 'All' },
]

export const CONTACT_DESTINATION_LABELS: Record<ContactDestinationKind, string> = {
  [DestinationKind.CoreAddress]: 'Core',
  [DestinationKind.PlatformAddress]: 'Platform',
  [DestinationKind.Shielded]: 'Shielded',
  [DestinationKind.Identity]: 'Identity',
}

export const ADDRESS_BOOK_COPY = {
  title: 'Address Book',
  openAction: 'Open address book',
  contactsTab: 'Contacts',
  ownAddressesTab: 'My addresses',
  ownIdentitiesTab: 'My identities',
  searchContactsPlaceholder: 'Search by name or address…',
  searchOwnAddressesPlaceholder: 'Search by label or address…',
  searchOwnIdentitiesPlaceholder: 'Search by username or identity ID…',
  addContactButton: 'Add contact',
  saveCurrentBanner: 'Current recipient is not in your contacts yet.',
  saveCurrentButton: 'Save current address',
  addFormTitle: 'New contact',
  editFormTitle: 'Edit contact',
  labelField: 'Label',
  labelPlaceholder: 'Contact name',
  addressField: 'Address',
  addressPlaceholder: 'Enter address or identity ID…',
  saveButton: 'Save',
  savingButton: 'Saving…',
  cancelButton: 'Cancel',
  editAction: 'Edit contact',
  deleteAction: 'Delete contact',
  confirmDeleteButton: 'Remove',
  removingButton: 'Removing…',
  selectedBadge: 'Selected',
  incompatibleBadge: 'Incompatible',
  incompatibleSelectHint: 'Not compatible with the selected transfer type',
  incompatibleSaveNotice: 'This address belongs to another transfer type — it will be saved to your address book, but cannot be selected for this transfer.',
  unknownKindError: 'Enter a valid Dash Core, Platform, Shielded address, or Identity ID for this network.',
  incompatibleKindError: 'Enter a valid {kind} address for this network.',
  duplicateAddressError: 'This address is already in your address book.',
  emptyContacts: 'No saved contacts yet.',
  emptyCompatibleContacts: 'No {kind} contacts saved yet.',
  showAllContacts: 'Show all contacts',
  emptySearchContacts: 'No contacts match your search.',
  emptyOwnAddresses: 'No addresses available in this wallet.',
  emptyOwnIdentities: 'No identities available in this wallet.',
  emptyOwnSearch: 'No matching entries found.',
  loadFailed: 'Could not load contacts',
  saveFailed: 'Could not save contact',
  updateFailed: 'Could not update contact',
  deleteFailed: 'Could not remove contact',
} as const
