import { useCallback } from 'react'
import { API } from '@renderer/api'
import type { Contact, Network } from '@renderer/api/types'
import { ADDRESS_BOOK_COPY, EMPTY_CONTACTS } from '@renderer/constants/addressBook'
import { useAuth } from '@renderer/contexts/AuthContext'
import type { UseAddressBook } from '@renderer/types/AddressBook'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export type { UseAddressBook }

const fetchContacts = (network: Network): Promise<Contact[]> =>
  API.getContacts(network).then(list => list ?? [])

export function prefetchContacts(network: Network): Promise<void> {
  return prefetchAsyncCache('contacts', network, () => fetchContacts(network))
}

export function refreshContacts(network: Network): Promise<void> {
  invalidateAsyncCache('contacts', network)
  return prefetchContacts(network)
}

export function useAddressBook(): UseAddressBook {
  const { status } = useAuth()
  const network = (status?.network ?? undefined) as Network | undefined
  const { data: contacts, loading, err } = useAsyncWithCache<Contact[]>(
    'contacts',
    network,
    () => fetchContacts(network!),
    EMPTY_CONTACTS,
    { errorMessage: ADDRESS_BOOK_COPY.loadFailed },
  )

  const reload = useCallback(() => {
    if (!network) return
    void refreshContacts(network)
  }, [network])

  const addContact = useCallback(
    async (label: string, address: string) => {
      if (!network) {
        throw new Error('No active network')
      }
      await API.addContact(label.trim(), address.trim(), network)
      await refreshContacts(network)
    },
    [network],
  )

  const updateContact = useCallback(
    async (contact: Contact, label: string, address: string) => {
      if (!network) {
        throw new Error('No active network')
      }
      const trimmedLabel = label.trim()
      const trimmedAddress = address.trim()
      if (trimmedLabel.length === 0) {
        throw new Error('Label is required')
      }
      if (trimmedAddress.length === 0) {
        throw new Error('Address is required')
      }
      if (trimmedLabel === contact.label && trimmedAddress === contact.address) {
        return
      }
      if (contacts.some(entry => entry.id !== contact.id && entry.address === trimmedAddress)) {
        throw new Error(ADDRESS_BOOK_COPY.duplicateAddressError)
      }

      await API.deleteContact(contact.id)
      try {
        await API.addContact(trimmedLabel, trimmedAddress, network)
      } catch (error) {
        await API.addContact(contact.label, contact.address, network).catch(() => {})
        throw error
      } finally {
        await refreshContacts(network)
      }
    },
    [contacts, network],
  )

  const deleteContact = useCallback(
    async (id: number) => {
      await API.deleteContact(id)
      if (network) {
        await refreshContacts(network)
      }
    },
    [network],
  )

  return { contacts, loading, err, network, reload, addContact, updateContact, deleteContact }
}
