import type { Contact } from '../api/types'
import { RECIPIENT_AUTOCOMPLETE_MIN_CHARS } from '../constants/addressField'

export function matchingContacts(contacts: Contact[], query: string, isValid: (address: string) => boolean): Contact[] {
  const needle = query.trim().toLowerCase()
  return contacts.filter(contact =>
    isValid(contact.address)
    && (contact.address.toLowerCase().includes(needle) || contact.label.toLowerCase().includes(needle)))
}

export function autocompleteContacts(
  contacts: Contact[],
  query: string,
  isValid: (address: string) => boolean,
  minChars = RECIPIENT_AUTOCOMPLETE_MIN_CHARS,
): Contact[] {
  const trimmed = query.trim()
  if (trimmed.length < minChars || isValid(trimmed)) return []
  return matchingContacts(contacts, trimmed, isValid)
}
