import { ADDRESS_BOOK_COPY, CONTACT_DESTINATION_LABELS } from '@renderer/constants/addressBook'
import { DestinationKind } from '@renderer/enums/DestinationKind'
import type {
  AddressBookContactEntry,
  ContactFilterParams,
  ContactFilterResult,
  ContactFormValidationParams,
  ContactFormValidationResult,
} from '@renderer/types/AddressBook'
import type { DropdownFieldOption } from '@renderer/types/DropdownField'
import { classifyDestinationAddress, isValidDestinationAddress } from './destinationAddress'
import { optionMatchesQuery } from './ownRecipients'

export function filterAddressBookContacts({
  contacts,
  destination,
  network,
  scope,
  query,
}: ContactFilterParams): ContactFilterResult {
  const needle = query.trim().toLowerCase()
  let compatibleCount = 0
  const allEntries: AddressBookContactEntry[] = contacts.map((contact) => {
    const kind = classifyDestinationAddress(contact.address, network)
    const compatible = isValidDestinationAddress(destination, contact.address, network)
    if (compatible) compatibleCount++
    return { contact, kind, compatible }
  })

  const entries = allEntries.filter(({ contact, compatible }) => {
    if (scope === 'compatible' && !compatible) return false
    if (needle === '') return true
    return contact.label.toLowerCase().includes(needle) || contact.address.toLowerCase().includes(needle)
  })

  return { entries, compatibleCount }
}

export function filterOwnAddressBookOptions(
  options: DropdownFieldOption[],
  query: string,
): DropdownFieldOption[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return options
  return options.filter(option => optionMatchesQuery(option, needle))
}

export function validateContactForm({
  label,
  address,
  destination,
  network,
  scope,
  contacts,
  editingId,
}: ContactFormValidationParams): ContactFormValidationResult {
  const trimmedLabel = label.trim()
  const trimmedAddress = address.trim()
  const detectedKind = classifyDestinationAddress(trimmedAddress, network)
  const duplicate = trimmedAddress !== '' && contacts.some(
    contact => contact.id !== editingId && contact.address === trimmedAddress,
  )

  let addressError: string | null = null
  if (trimmedAddress !== '') {
    if (duplicate) {
      addressError = ADDRESS_BOOK_COPY.duplicateAddressError
    } else if (
      scope === 'compatible'
      && destination !== DestinationKind.NewIdentity
      && !isValidDestinationAddress(destination, trimmedAddress, network)
    ) {
      addressError = ADDRESS_BOOK_COPY.incompatibleKindError.replace(
        '{kind}',
        CONTACT_DESTINATION_LABELS[destination],
      )
    } else if (detectedKind === null) {
      addressError = ADDRESS_BOOK_COPY.unknownKindError
    }
  }

  const incompatibleNotice =
    addressError === null
    && trimmedAddress !== ''
    && destination !== DestinationKind.NewIdentity
    && !isValidDestinationAddress(destination, trimmedAddress, network)
      ? ADDRESS_BOOK_COPY.incompatibleSaveNotice
      : null

  return {
    valid: trimmedLabel.length > 0 && trimmedAddress.length > 0 && addressError === null,
    detectedKind,
    addressError,
    incompatibleNotice,
  }
}
