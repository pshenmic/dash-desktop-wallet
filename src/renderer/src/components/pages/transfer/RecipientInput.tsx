import { useState } from 'react'
import { AddressBookIcon, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import { RefreshIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import AddressBookModal from '@renderer/components/modal/AddressBookModal'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import DropdownField from '@renderer/components/ui/DropdownField'
import Spinner from '@renderer/components/ui/Spinner'
import { ADDRESS_BOOK_COPY } from '@renderer/constants/addressBook'
import {
  CONTACT_IDENTIFIER_CLASS,
  FIELD_INVALID,
  RECIPIENT_AUTOCOMPLETE_MIN_CHARS,
  RECIPIENT_FIELD_STYLES,
} from '@renderer/constants/addressField'
import { POPOVER_OPTION } from '@renderer/constants/surfaces'
import { DestinationKind } from '@renderer/enums/DestinationKind'
import { useAddressBook } from '@renderer/hooks/useAddressBook'
import type { RecipientInputProps } from '@renderer/types/SendRecipients'
import { isValidDestinationAddress } from '@renderer/utils/destinationAddress'
import { autocompleteContacts } from '@renderer/utils/matchingContacts'
import { matchingOwnOptions, recipientAddressBadge } from '@renderer/utils/ownRecipients'

export default function RecipientInput({
  value,
  valueBadge,
  hideValueBadge = false,
  onChange,
  data,
  destination = DestinationKind.CoreAddress,
  compact = false,
  appearance = 'default',
  ariaLabel,
  validate,
  invalid = false,
  valueAvatar = false,
  ownOptions,
  ownOptionsHeading = 'Your addresses',
  ownOptionsLoading = false,
  ownOptionsError = null,
  onRetryOwnOptions,
  hideAddressBook = false,
}: RecipientInputProps): React.JSX.Element {
  const [bookOpen, setBookOpen] = useState(false)
  const [menuKey, setMenuKey] = useState(0)

  const { contacts, network } = useAddressBook()
  const style = RECIPIENT_FIELD_STYLES[appearance]
  const isValid = validate ?? ((address: string) => isValidDestinationAddress(destination, address, network ?? null))

  const trimmedValue = value.trim()
  const filteredContacts = hideAddressBook ? [] : autocompleteContacts(contacts, value, isValid)
  const isValidRecipient = isValid(trimmedValue)
  const hasOwnOptions = ownOptions != null && ownOptions.length > 0
  const hasOwnMatches = ownOptions != null && matchingOwnOptions(ownOptions, value).length > 0
  const hasQueryMatches =
    trimmedValue.length >= RECIPIENT_AUTOCOMPLETE_MIN_CHARS
    && !isValidRecipient
    && (hasOwnMatches || filteredContacts.length > 0)
  const invalidRecipient = !hasQueryMatches && (invalid || (trimmedValue.length > 0 && !isValidRecipient))
  const resolvedBadge = valueBadge?.trim() || (hideAddressBook ? undefined : recipientAddressBadge(value, undefined, contacts))

  const handleSelectAddress = (address: string): void => {
    onChange(address)
    setMenuKey(key => key + 1)
  }

  let ownOptionsStatus: React.JSX.Element | undefined
  if (ownOptionsLoading || (ownOptionsError && onRetryOwnOptions)) {
    ownOptionsStatus = (
      <span className="flex items-center gap-2">
        {ownOptionsLoading && (
          <span role="status" aria-label="Loading recipient options">
            <Spinner size={12} className="dash-text-primary" />
          </span>
        )}
        {!ownOptionsLoading && ownOptionsError && onRetryOwnOptions && (
          <button
            type="button"
            onClick={onRetryOwnOptions}
            aria-label="Reload recipient options"
            title="Reload recipient options"
            className="dash-text-primary cursor-pointer hover:opacity-70"
          >
            <RefreshIcon size={14} color="currentColor" />
          </button>
        )}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {!compact && (
        <Text size={12} weight="medium" color="brand" opacity={50} className="leading-[120%]">
          {data.label}
        </Text>
      )}
      <DropdownField
        key={menuKey}
        editable
        disableMenuToggle={!hideAddressBook}
        minAutocompleteChars={RECIPIENT_AUTOCOMPLETE_MIN_CHARS}
        highlightValue
        valueAvatar={valueAvatar}
        valueBadge={resolvedBadge}
        hideValueBadge={hideValueBadge}
        hasExtraMatches={query => !hideAddressBook && autocompleteContacts(contacts, query, isValid).length > 0}
        ariaLabel={ariaLabel ?? data.label}
        value={value}
        onChange={onChange}
        options={ownOptions ?? []}
        menuHeading={ownOptions != null && ownOptions.length > 0 ? ownOptionsHeading : undefined}
        placeholder={data.placeholder}
        textSize={style.textSize}
        triggerClassName={`${style.field} ${invalidRecipient ? FIELD_INVALID : ''}`}
        inputInvalid={invalidRecipient}
        inputSuffix={ownOptionsStatus}
        onActionClick={hideAddressBook ? undefined : () => setBookOpen(true)}
        actionAriaLabel={hideAddressBook ? undefined : ADDRESS_BOOK_COPY.openAction}
        actionTitle={hideAddressBook ? undefined : ADDRESS_BOOK_COPY.openAction}
        actionIcon={hideAddressBook ? undefined : <AddressBookIcon size={style.bookIconSize} className="dash-text-default opacity-60" />}
      >
        {filteredContacts.length > 0 ? (
          <div className={`flex flex-col ${hasOwnMatches ? 'mb-1.5 border-b border-dash-primary-dark-blue/8 pb-1.5 dark:border-white/8' : ''}`}>
            <div className="px-[.625rem] pt-1.5 pb-2">
              <Text size={12} weight="medium" color="brand" opacity={50}>
                {data.addressBook}
              </Text>
            </div>
            {filteredContacts.map(entry => (
              <button
                key={entry.id}
                type="button"
                onClick={() => handleSelectAddress(entry.address)}
                className={`flex w-full flex-col gap-1 text-left ${POPOVER_OPTION}`}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <HighlightedIdentifier className={CONTACT_IDENTIFIER_CLASS}>
                    {entry.address}
                  </HighlightedIdentifier>
                  <CustomBadge text={entry.label} variant="accent" size="xs" className="shrink-0" />
                </div>
              </button>
            ))}
          </div>
        ) : hideAddressBook && !ownOptionsLoading && !hasOwnOptions ? (
          <div className="px-[.625rem] py-2">
            <Text size={12} weight="medium" color="brand" opacity={50}>
              {data.noResults}
            </Text>
          </div>
        ) : null}
      </DropdownField>

      {!hideAddressBook && (
        <AddressBookModal
          open={bookOpen}
          onClose={() => setBookOpen(false)}
          destination={destination}
          network={network ?? null}
          currentValue={value}
          onSelect={handleSelectAddress}
          ownOptions={ownOptions}
          ownOptionsHeading={ownOptionsHeading}
          ownOptionsLoading={ownOptionsLoading}
          ownOptionsError={ownOptionsError}
          onRetryOwnOptions={onRetryOwnOptions}
          valueAvatar={valueAvatar}
        />
      )}
    </div>
  )
}
