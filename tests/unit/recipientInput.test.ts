import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { createBase58check } from '@scure/base'
import { sha256 } from '@noble/hashes/sha2.js'

const harness = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  contacts: [] as Array<{ id: number; label: string; address: string; network: 'testnet'; createdAt: number }>,
  addContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  reload: vi.fn(),
}))

vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: <T>(initial: T) => {
    const index = harness.index++
    if (!(index in harness.states)) harness.states[index] = initial
    return [harness.states[index], (update: T | ((previous: T) => T)) => {
      harness.states[index] = typeof update === 'function' ? (update as (previous: T) => T)(harness.states[index] as T) : update
    }]
  },
  useRef: () => ({ current: null }),
  useEffect: () => {},
}))
vi.mock('@renderer/components/dash-ui-kit-extended', () => ({
  AddressBookIcon: 'address-book-icon',
  Button: 'button',
  HighlightedIdentifier: 'identifier',
  Input: 'input',
  Text: 'span',
  ChevronIcon: 'chevron',
}))
vi.mock('@renderer/components/dash-ui-kit-extended/icons', () => ({ RefreshIcon: 'refresh' }))
vi.mock('dash-ui-kit/react', () => ({ Avatar: 'avatar', Badge: 'badge' }))
vi.mock('@renderer/hooks/useClickOutside', () => ({ useClickOutside: () => {} }))
vi.mock('@renderer/hooks/useAddressBook', () => ({
  useAddressBook: () => ({
    contacts: harness.contacts,
    loading: false,
    err: null,
    network: 'testnet',
    reload: harness.reload,
    addContact: harness.addContact,
    updateContact: harness.updateContact,
    deleteContact: harness.deleteContact,
  }),
}))
vi.mock('@renderer/components/modal/AddressBookModal', () => ({ default: 'address-book-modal' }))
vi.mock('@renderer/components/ui/Toast', () => ({ toast: { error: vi.fn() } }))

import RecipientInput from '../../src/renderer/src/components/pages/transfer/RecipientInput'
import DropdownField from '../../src/renderer/src/components/ui/DropdownField'
import CustomBadge from '../../src/renderer/src/components/ui/CustomBadge'
import { ADDRESS_BOOK_COPY } from '../../src/renderer/src/constants/addressBook'
import { sendPageData } from '../../src/renderer/src/constants/sendPages'
import type { DropdownFieldOption, DropdownFieldProps } from '../../src/renderer/src/types/DropdownField'

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}

function renderRecipient(
  value: string,
  onChange = vi.fn(),
  ownOptions: DropdownFieldOption[] = [{ value: 'own', label: 'own' }],
  valueBadge?: string,
) {
  harness.index = 0
  return RecipientInput({ value, valueBadge, onChange, ownOptions, data: sendPageData.recipient })
}

beforeEach(() => {
  vi.stubGlobal('React', React)
  harness.states = []
  harness.contacts = []
  harness.addContact.mockReset().mockResolvedValue(undefined)
  harness.updateContact.mockReset().mockResolvedValue(undefined)
  harness.deleteContact.mockReset().mockResolvedValue(undefined)
  harness.reload.mockReset()
})

afterEach(() => vi.unstubAllGlobals())

describe('RecipientInput', () => {
  it('replaces the search toggle with an Address Book button that opens AddressBookModal', () => {
    const onChange = vi.fn()
    let tree = renderRecipient('  unfinished  ', onChange)
    const dropdown = elements(tree).find(node => node.type === DropdownField)!
    const modal = elements(tree).find(node => node.type === 'address-book-modal')!
    const props = dropdown.props as unknown as DropdownFieldProps

    expect(props.value).toBe('  unfinished  ')
    expect(props.inputInvalid).toBe(true)
    expect(props.disableMenuToggle).toBe(true)
    expect(props.actionAriaLabel).toBe(ADDRESS_BOOK_COPY.openAction)
    expect(modal.props.open).toBe(false)

    harness.index = 0
    const renderedDropdown = DropdownField(props)
    const actionButton = elements(renderedDropdown).find(node => node.props['aria-label'] === ADDRESS_BOOK_COPY.openAction)!
    expect(elements(actionButton).some(node => node.type === 'address-book-icon')).toBe(true)
    ;(actionButton.props.onClick as () => void)()

    harness.index = 0
    tree = RecipientInput({ value: '  unfinished  ', onChange, ownOptions: [], data: sendPageData.recipient })
    const openedModal = elements(tree).find(node => node.type === 'address-book-modal')!
    expect(openedModal.props.open).toBe(true)
  })

  it('requires at least 3 characters for autocomplete suggestions across own addresses and contacts', () => {
    const savingsAddress = createBase58check(sha256).encode(Uint8Array.from([140, ...Array(20).fill(3)]))
    const contactAddress = createBase58check(sha256).encode(Uint8Array.from([140, ...Array(20).fill(5)]))
    const otherAddress = createBase58check(sha256).encode(Uint8Array.from([140, ...Array(20).fill(4)]))
    harness.contacts = [{ id: 1, label: 'Alice Vault', address: contactAddress, network: 'testnet', createdAt: 0 }]

    const options: DropdownFieldOption[] = [
      { value: savingsAddress, label: savingsAddress, badge: 'Savings Vault', description: 'Your receiving address', metadata: ['1.25 Dash', 'Tx count: 4'] },
      { value: otherAddress, label: otherAddress, description: 'Your receiving address' },
    ]
    const onChange = vi.fn()

    // 2 characters do not open autocomplete
    let dropdown = elements(renderRecipient('va', onChange, options)).find(node => node.type === DropdownField)!
    let props = dropdown.props as unknown as DropdownFieldProps
    harness.index = 0
    harness.states = [false, true]
    let tree = DropdownField(props)
    const shortInput = elements(tree).find(node => node.type === 'input')!
    ;(shortInput.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'va' } })
    expect(harness.states[0]).toBe(false)

    // 3+ characters open matching own + contact options
    harness.states = []
    dropdown = elements(renderRecipient('vau', onChange, options)).find(node => node.type === DropdownField)!
    props = dropdown.props as unknown as DropdownFieldProps
    harness.index = 0
    harness.states = [false, true]
    tree = DropdownField(props)
    const input = elements(tree).find(node => node.type === 'input')!
    ;(input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'vau' } })
    expect(onChange).toHaveBeenLastCalledWith('vau')
    expect(harness.states[0]).toBe(true)

    harness.index = 0
    harness.states = [true, true]
    const openNodes = elements(DropdownField(props))
    expect(openNodes.some(node => node.key === savingsAddress)).toBe(true)
    expect(openNodes.some(node => node.key === otherAddress)).toBe(false)
    expect(openNodes.some(node => elements(node).some(child => child.props.children === contactAddress))).toBe(true)

    // Selecting a contact suggestion passes address and closes popover
    const contactBtn = openNodes.find(node => node.type === 'button' && elements(node).some(child => child.props.children === contactAddress))!
    ;(contactBtn.props.onClick as () => void)()
    expect(onChange).toHaveBeenLastCalledWith(contactAddress)
  })

  it('displays contact label badge in the input and gives priority to wallet label badge', () => {
    const address = createBase58check(sha256).encode(Uint8Array.from([140, ...Array(20).fill(1)]))
    harness.contacts = [{ id: 7, label: 'Friend', address, network: 'testnet', createdAt: 0 }]

    // Contact badge only
    let dropdown = elements(renderRecipient(address, vi.fn(), [])).find(node => node.type === DropdownField)!
    let props = dropdown.props as unknown as DropdownFieldProps
    harness.index = 0
    harness.states = [false, false]
    let nodes = elements(DropdownField(props))
    expect(nodes.find(node => node.type === CustomBadge)?.props.text).toBe('Friend')

    // Wallet label overrides contact label when provided
    harness.states = []
    dropdown = elements(renderRecipient(address, vi.fn(), [], 'Savings Vault')).find(node => node.type === DropdownField)!
    props = dropdown.props as unknown as DropdownFieldProps
    harness.index = 0
    harness.states = [false, false]
    nodes = elements(DropdownField(props))
    expect(nodes.find(node => node.type === CustomBadge)?.props.text).toBe('Savings Vault')
  })

  it('marks addresses from another network invalid', () => {
    const mainnetAddress = createBase58check(sha256).encode(Uint8Array.from([76, ...Array(20).fill(2)]))
    const nodes = elements(renderRecipient(mainnetAddress))
    expect(nodes.find(node => node.type === DropdownField)?.props.inputInvalid).toBe(true)
  })
})
