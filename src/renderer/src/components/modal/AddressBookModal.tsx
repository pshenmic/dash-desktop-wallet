import { useEffect, useMemo, useState } from 'react'
import { Avatar } from 'dash-ui-kit/react'
import type { Contact } from '@renderer/api/types'
import {
  Button,
  DeleteIcon,
  HighlightedIdentifier,
  PencilIcon,
  PlusIcon,
  Text,
  Tooltip,
} from '@renderer/components/dash-ui-kit-extended'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import Modal from '@renderer/components/ui/Modal'
import NoResults from '@renderer/components/ui/NoResults'
import RetryButton from '@renderer/components/ui/RetryButton'
import SearchField from '@renderer/components/ui/SearchField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import { toast } from '@renderer/components/ui/Toast'
import {
  ADDRESS_BOOK_COPY,
  ADDRESS_BOOK_LABEL_MAX_LENGTH,
  ADDRESS_BOOK_SCOPE_OPTIONS,
  CONTACT_DESTINATION_LABELS,
} from '@renderer/constants/addressBook'
import { ADDRESS_INPUT, ADDRESS_INPUT_TEXT_SIZES, CONTACT_IDENTIFIER_CLASS, FIELD_INVALID, FIELD_SUBTLE } from '@renderer/constants/addressField'
import { ADDRESS_ROW_ICON_BUTTON_CLASS } from '@renderer/constants/addressRow'
import { SURFACE_ROW, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { DestinationKind } from '@renderer/enums/DestinationKind'
import { ModalSize } from '@renderer/enums/ModalSize'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import { useAddressBook } from '@renderer/hooks/useAddressBook'
import type {
  AddressBookModalProps,
  AddressBookTab,
  ContactFilterScope,
  ContactFormMode,
} from '@renderer/types/AddressBook'
import { filterAddressBookContacts, filterOwnAddressBookOptions, validateContactForm } from '@renderer/utils/addressBook'
import { isValidDestinationAddress } from '@renderer/utils/destinationAddress'
import { getErrorMessage } from '@renderer/utils/error'

export default function AddressBookModal({
  open,
  onClose,
  destination,
  network,
  currentValue,
  onSelect,
  ownOptions,
  ownOptionsLoading = false,
  ownOptionsError = null,
  onRetryOwnOptions,
  valueAvatar = false,
}: AddressBookModalProps): React.JSX.Element | null {
  const { contacts, loading: contactsLoading, err: contactsError, reload, addContact, updateContact, deleteContact } = useAddressBook()

  const [activeTab, setActiveTab] = useState<AddressBookTab>('contacts')
  const [scope, setScope] = useState<ContactFilterScope>('compatible')
  const [contactQuery, setContactQuery] = useState('')
  const [ownQuery, setOwnQuery] = useState('')
  const [formMode, setFormMode] = useState<ContactFormMode | null>(null)
  const [formLabel, setFormLabel] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setActiveTab('contacts')
    setScope('compatible')
    setContactQuery('')
    setOwnQuery('')
    setFormMode(null)
    setFormLabel('')
    setFormAddress('')
    setFormError(null)
    setSaving(false)
    setConfirmDeleteId(null)
    setDeletingId(null)
  }, [open, destination])

  useEffect(() => {
    if (!open || formMode === null) return
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      setFormMode(null)
      setFormLabel('')
      setFormAddress('')
      setFormError(null)
    }
    window.addEventListener('keydown', handleEscape, true)
    return () => window.removeEventListener('keydown', handleEscape, true)
  }, [open, formMode])

  const trimmedCurrent = currentValue.trim()
  const isCurrentValid = trimmedCurrent !== '' && isValidDestinationAddress(destination, trimmedCurrent, network)
  const currentAlreadySaved = contacts.some(contact => contact.address === trimmedCurrent)
  const canSaveCurrent = isCurrentValid && !currentAlreadySaved && formMode === null

  const { entries: filteredContacts } = useMemo(
    () => filterAddressBookContacts({ contacts, destination, network, scope, query: contactQuery }),
    [contacts, destination, network, scope, contactQuery],
  )

  const filteredOwnOptions = useMemo(
    () => filterOwnAddressBookOptions(ownOptions ?? [], ownQuery),
    [ownOptions, ownQuery],
  )

  const editingId = formMode?.kind === 'edit' ? formMode.contact.id : null
  const formValidation = useMemo(
    () => validateContactForm({
      label: formLabel,
      address: formAddress,
      destination,
      network,
      scope,
      contacts,
      editingId,
    }),
    [formLabel, formAddress, destination, network, scope, contacts, editingId],
  )

  if (!open) return null

  const openAddForm = (prefillAddress = ''): void => {
    setFormMode({ kind: 'add' })
    setFormLabel('')
    setFormAddress(prefillAddress)
    setFormError(null)
    setConfirmDeleteId(null)
  }

  const openEditForm = (contact: Contact): void => {
    setFormMode({ kind: 'edit', contact })
    setFormLabel(contact.label)
    setFormAddress(contact.address)
    setFormError(null)
    setConfirmDeleteId(null)
  }

  const closeForm = (): void => {
    setFormMode(null)
    setFormLabel('')
    setFormAddress('')
    setFormError(null)
  }

  const handleSaveForm = async (event?: React.FormEvent): Promise<void> => {
    event?.preventDefault()
    if (!formMode || !formValidation.valid || saving) return
    setSaving(true)
    setFormError(null)
    try {
      if (formMode.kind === 'add') {
        await addContact(formLabel.trim(), formAddress.trim())
      } else {
        await updateContact(formMode.contact, formLabel.trim(), formAddress.trim())
      }
      closeForm()
    } catch (error) {
      const prefix = formMode.kind === 'add' ? ADDRESS_BOOK_COPY.saveFailed : ADDRESS_BOOK_COPY.updateFailed
      setFormError(`${prefix}: ${getErrorMessage(error)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number): Promise<void> => {
    if (deletingId !== null) return
    setDeletingId(id)
    try {
      await deleteContact(id)
      setConfirmDeleteId(null)
      if (formMode?.kind === 'edit' && formMode.contact.id === id) {
        closeForm()
      }
    } catch (error) {
      toast.error(`**${ADDRESS_BOOK_COPY.deleteFailed}** ${getErrorMessage(error)}`)
    } finally {
      setDeletingId(null)
    }
  }

  const handleSelectAddress = (address: string): void => {
    onSelect(address)
    onClose()
  }

  const isIdentity = destination === DestinationKind.Identity
  const ownTabLabel = isIdentity ? ADDRESS_BOOK_COPY.ownIdentitiesTab : ADDRESS_BOOK_COPY.ownAddressesTab
  const tabOptions: Array<{ value: AddressBookTab; label: string }> = [
    { value: 'contacts', label: ADDRESS_BOOK_COPY.contactsTab },
    { value: 'own', label: ownTabLabel },
  ]

  const destinationKindLabel = destination === DestinationKind.NewIdentity
    ? ''
    : CONTACT_DESTINATION_LABELS[destination]

  let contactsEmptyMessage = ADDRESS_BOOK_COPY.emptyContacts as string
  if (contactQuery.trim() !== '') {
    contactsEmptyMessage = ADDRESS_BOOK_COPY.emptySearchContacts
  } else if (scope === 'compatible' && destinationKindLabel !== '') {
    contactsEmptyMessage = ADDRESS_BOOK_COPY.emptyCompatibleContacts.replace('{kind}', destinationKindLabel)
  }

  return (
    <Modal open={open} onClose={onClose} title={ADDRESS_BOOK_COPY.title} size={ModalSize.Lg}>
      <div className="mt-4 flex flex-col gap-4">
        {ownOptions !== undefined && (
          <SegmentedControl
            appearance={SegmentedControlAppearance.Pill}
            ariaLabel="Address book sections"
            options={tabOptions}
            value={activeTab}
            onChange={(nextTab) => {
              setActiveTab(nextTab)
              setConfirmDeleteId(null)
            }}
          />
        )}

        {activeTab === 'contacts' ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <SearchField
                value={contactQuery}
                onChange={setContactQuery}
                placeholder={ADDRESS_BOOK_COPY.searchContactsPlaceholder}
                ariaLabel={ADDRESS_BOOK_COPY.searchContactsPlaceholder}
                className="min-w-44 flex-1"
              />
              <SegmentedControl
                appearance={SegmentedControlAppearance.Boxed}
                ariaLabel="Contact filter scope"
                options={ADDRESS_BOOK_SCOPE_OPTIONS}
                value={scope}
                onChange={setScope}
              />
              <Button
                type="button"
                size="compact"
                colorScheme="primary"
                onClick={() => openAddForm()}
                className="gap-1.5 shrink-0 normal-case!"
              >
                <PlusIcon size={12} color="currentColor" />
                {ADDRESS_BOOK_COPY.addContactButton}
              </Button>
            </div>

            {canSaveCurrent && (
              <div className={`flex flex-wrap items-center justify-between gap-3 ${SURFACE_SECTION}`}>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Text size={12} weight="medium" color="brand" opacity={60}>
                    {ADDRESS_BOOK_COPY.saveCurrentBanner}
                  </Text>
                  <HighlightedIdentifier className={CONTACT_IDENTIFIER_CLASS}>
                    {trimmedCurrent}
                  </HighlightedIdentifier>
                </div>
                <Button
                  type="button"
                  size="compact"
                  colorScheme="lightBlue-mint"
                  onClick={() => openAddForm(trimmedCurrent)}
                  className="shrink-0 normal-case!"
                >
                  {ADDRESS_BOOK_COPY.saveCurrentButton}
                </Button>
              </div>
            )}

            {formMode !== null && (
              <form
                onSubmit={(e) => { void handleSaveForm(e) }}
                className={`flex flex-col gap-3 ${SURFACE_SECTION}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Text size={12} weight="extrabold" color="brand">
                    {formMode.kind === 'add' ? ADDRESS_BOOK_COPY.addFormTitle : ADDRESS_BOOK_COPY.editFormTitle}
                  </Text>
                  {formValidation.detectedKind && (
                    <CustomBadge
                      text={CONTACT_DESTINATION_LABELS[formValidation.detectedKind]}
                      variant="accent"
                      size="xs"
                    />
                  )}
                </div>

                <label className="flex flex-col gap-1.5">
                  <Text size={12} weight="medium" color="brand" opacity={50}>
                    {ADDRESS_BOOK_COPY.labelField}
                  </Text>
                  <div className={`flex items-center ${FIELD_SUBTLE}`}>
                    <input
                      type="text"
                      aria-label={ADDRESS_BOOK_COPY.labelField}
                      maxLength={ADDRESS_BOOK_LABEL_MAX_LENGTH}
                      value={formLabel}
                      disabled={saving}
                      autoFocus
                      onChange={(e) => {
                        setFormError(null)
                        setFormLabel(e.target.value)
                      }}
                      placeholder={ADDRESS_BOOK_COPY.labelPlaceholder}
                      className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[12]}`}
                    />
                  </div>
                </label>

                <label className="flex flex-col gap-1.5">
                  <Text size={12} weight="medium" color="brand" opacity={50}>
                    {ADDRESS_BOOK_COPY.addressField}
                  </Text>
                  <div className={`flex items-center ${FIELD_SUBTLE} ${formValidation.addressError ? FIELD_INVALID : ''}`}>
                    <input
                      type="text"
                      aria-label={ADDRESS_BOOK_COPY.addressField}
                      value={formAddress}
                      disabled={saving}
                      onChange={(e) => {
                        setFormError(null)
                        setFormAddress(e.target.value)
                      }}
                      placeholder={ADDRESS_BOOK_COPY.addressPlaceholder}
                      className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[12]} font-mono`}
                    />
                  </div>
                </label>

                {formValidation.addressError && (
                  <Text size={12} weight="medium" color="red">
                    {formValidation.addressError}
                  </Text>
                )}

                {formValidation.incompatibleNotice && (
                  <Text size={12} weight="medium" color="brand" opacity={60}>
                    {formValidation.incompatibleNotice}
                  </Text>
                )}

                {formError && (
                  <Text size={12} weight="medium" color="red">
                    {formError}
                  </Text>
                )}

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    size="compact"
                    colorScheme="primary-light"
                    disabled={saving}
                    onClick={closeForm}
                    className="normal-case!"
                  >
                    {ADDRESS_BOOK_COPY.cancelButton}
                  </Button>
                  <Button
                    type="submit"
                    size="compact"
                    colorScheme="primary"
                    disabled={!formValidation.valid || saving}
                    className="normal-case!"
                  >
                    {saving ? ADDRESS_BOOK_COPY.savingButton : ADDRESS_BOOK_COPY.saveButton}
                  </Button>
                </div>
              </form>
            )}

            {contactsLoading ? (
              <ListSkeleton rows={4} rowClassName="h-[3.5rem] rounded-[.875rem]" />
            ) : contactsError ? (
              <NoResults
                tone={NoResultsTone.Error}
                noResults={contactsError}
                action={<RetryButton onRetry={reload} />}
              />
            ) : filteredContacts.length === 0 ? (
              <NoResults
                noResults={contactsEmptyMessage}
                action={
                  scope === 'compatible' && contactQuery.trim() === '' && contacts.length > 0 ? (
                    <Button
                      type="button"
                      size="compact"
                      colorScheme="lightBlue-mint"
                      onClick={() => setScope('all')}
                      className="normal-case!"
                    >
                      {ADDRESS_BOOK_COPY.showAllContacts}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="flex max-h-[22rem] flex-col gap-2 overflow-y-auto pr-1 scrollbar-custom">
                {filteredContacts.map(({ contact, kind, compatible }) => {
                  const isSelected = contact.address === trimmedCurrent
                  const isConfirming = confirmDeleteId === contact.id
                  const isDeleting = deletingId === contact.id

                  const rowBody = (
                    <>
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <Text size={14} weight="bold" color="brand" className="break-words">
                          {contact.label}
                        </Text>
                        {kind && (scope === 'all' || !compatible) && (
                          <CustomBadge text={CONTACT_DESTINATION_LABELS[kind]} variant="muted" size="xs" />
                        )}
                        {!compatible && (
                          <CustomBadge text={ADDRESS_BOOK_COPY.incompatibleBadge} variant="muted" size="xs" />
                        )}
                        {isSelected && (
                          <CustomBadge text={ADDRESS_BOOK_COPY.selectedBadge} variant="accent" size="xs" />
                        )}
                      </div>
                      <HighlightedIdentifier className={CONTACT_IDENTIFIER_CLASS}>
                        {contact.address}
                      </HighlightedIdentifier>
                      {!compatible && (
                        <Text size={10} weight="medium" color="brand" opacity={50}>
                          {ADDRESS_BOOK_COPY.incompatibleSelectHint}
                        </Text>
                      )}
                    </>
                  )

                  return (
                    <div
                      key={contact.id}
                      className={`flex items-start justify-between gap-3 ${SURFACE_ROW} ${isSelected ? 'dash-block-accent-5' : ''}`}
                    >
                      {compatible ? (
                        <button
                          type="button"
                          onClick={() => handleSelectAddress(contact.address)}
                          className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 text-left transition-opacity hover:opacity-80"
                        >
                          {rowBody}
                        </button>
                      ) : (
                        <div aria-disabled="true" className="flex min-w-0 flex-1 cursor-not-allowed flex-col gap-1 opacity-65">
                          {rowBody}
                        </div>
                      )}

                      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                        {isConfirming ? (
                          <>
                            <Button
                              type="button"
                              size="compact"
                              colorScheme="red-strong"
                              disabled={isDeleting}
                              onClick={() => void handleDelete(contact.id)}
                              className="h-7! px-2.5! text-xs! normal-case!"
                            >
                              {isDeleting ? ADDRESS_BOOK_COPY.removingButton : ADDRESS_BOOK_COPY.confirmDeleteButton}
                            </Button>
                            <Button
                              type="button"
                              size="compact"
                              colorScheme="primary-light"
                              disabled={isDeleting}
                              onClick={() => setConfirmDeleteId(null)}
                              className="h-7! px-2.5! text-xs! normal-case!"
                            >
                              {ADDRESS_BOOK_COPY.cancelButton}
                            </Button>
                          </>
                        ) : (
                          <>
                            <CopyButton text={contact.address} label="Copy address" />
                            <Tooltip label={ADDRESS_BOOK_COPY.editAction}>
                              <button
                                type="button"
                                aria-label={`${ADDRESS_BOOK_COPY.editAction} ${contact.label}`}
                                onClick={() => openEditForm(contact)}
                                className={ADDRESS_ROW_ICON_BUTTON_CLASS}
                              >
                                <PencilIcon size={10} color="currentColor" className="dash-text-default opacity-50" />
                              </button>
                            </Tooltip>
                            <Tooltip label={ADDRESS_BOOK_COPY.deleteAction}>
                              <button
                                type="button"
                                aria-label={`${ADDRESS_BOOK_COPY.deleteAction} ${contact.label}`}
                                onClick={() => setConfirmDeleteId(contact.id)}
                                className={ADDRESS_ROW_ICON_BUTTON_CLASS}
                              >
                                <DeleteIcon size={10} color="currentColor" className="dash-text-default opacity-50" />
                              </button>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <SearchField
              value={ownQuery}
              onChange={setOwnQuery}
              placeholder={isIdentity ? ADDRESS_BOOK_COPY.searchOwnIdentitiesPlaceholder : ADDRESS_BOOK_COPY.searchOwnAddressesPlaceholder}
              ariaLabel={isIdentity ? ADDRESS_BOOK_COPY.searchOwnIdentitiesPlaceholder : ADDRESS_BOOK_COPY.searchOwnAddressesPlaceholder}
            />

            {ownOptionsLoading ? (
              <ListSkeleton rows={4} rowClassName="h-[3.5rem] rounded-[.875rem]" />
            ) : ownOptionsError ? (
              <NoResults
                tone={NoResultsTone.Error}
                noResults={ownOptionsError}
                action={onRetryOwnOptions && <RetryButton onRetry={onRetryOwnOptions} />}
              />
            ) : filteredOwnOptions.length === 0 ? (
              <NoResults
                noResults={
                  ownQuery.trim() !== ''
                    ? ADDRESS_BOOK_COPY.emptyOwnSearch
                    : (isIdentity ? ADDRESS_BOOK_COPY.emptyOwnIdentities : ADDRESS_BOOK_COPY.emptyOwnAddresses)
                }
              />
            ) : (
              <div className="flex max-h-[22rem] flex-col gap-2 overflow-y-auto pr-1 scrollbar-custom">
                {filteredOwnOptions.map((option) => {
                  const isSelected = option.value === trimmedCurrent
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelectAddress(option.value)}
                      className={`flex w-full cursor-pointer items-center gap-3 text-left transition-colors hover:dash-block-accent-10 ${SURFACE_ROW} ${isSelected ? 'dash-block-accent-5' : ''}`}
                    >
                      {valueAvatar && <Avatar username={option.value} className="size-6 shrink-0" />}
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <HighlightedIdentifier className={CONTACT_IDENTIFIER_CLASS}>
                            {option.label}
                          </HighlightedIdentifier>
                          {option.badge && (
                            <CustomBadge text={option.badge} variant="accent" size="xs" className="shrink-0" />
                          )}
                          {isSelected && (
                            <CustomBadge text={ADDRESS_BOOK_COPY.selectedBadge} variant="accent" size="xs" className="shrink-0" />
                          )}
                        </div>
                        {option.description && (
                          <Text size={12} weight="medium" color="brand" opacity={50}>
                            {option.description}
                          </Text>
                        )}
                      </div>
                      {option.metadata && option.metadata.length > 0 && (
                        <div className="ml-auto flex shrink-0 flex-col gap-0.5 text-right">
                          {option.metadata.map(detail => (
                            <Text key={detail} size={12} weight="medium" color="brand" opacity={70}>
                              {detail}
                            </Text>
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
