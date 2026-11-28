import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { bech32m, createBase58check } from '@scure/base'
import { sha256 } from '@noble/hashes/sha2.js'
import type { Contact } from '../../src/renderer/src/api/types'
import { DestinationKind } from '../../src/renderer/src/enums/DestinationKind'
import { ADDRESS_BOOK_COPY } from '../../src/renderer/src/constants/addressBook'
import {
  filterAddressBookContacts,
  filterOwnAddressBookOptions,
  validateContactForm,
} from '../../src/renderer/src/utils/addressBook'

const base58check = createBase58check(sha256)
const coreAddr1 = base58check.encode(Uint8Array.from([140, ...Array(20).fill(1)]))
const coreAddr2 = base58check.encode(Uint8Array.from([140, ...Array(20).fill(2)]))
const platformAddr = bech32m.encode('tdash', bech32m.toWords(Uint8Array.from([0xb0, ...Array(20).fill(3)])))
const identityAddr = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'

const sampleContacts: Contact[] = [
  { id: 1, label: 'Alice Core', address: coreAddr1, network: 'testnet', createdAt: 10 },
  { id: 2, label: 'Bob Platform', address: platformAddr, network: 'testnet', createdAt: 20 },
  { id: 3, label: 'Carol Identity', address: identityAddr, network: 'testnet', createdAt: 30 },
]

const modalHarness = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  contacts: [] as Contact[],
  addContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  reload: vi.fn(),
}))

vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: <T>(initial: T) => {
    const index = modalHarness.index++
    if (!(index in modalHarness.states)) modalHarness.states[index] = initial
    return [modalHarness.states[index], (update: T | ((previous: T) => T)) => {
      modalHarness.states[index] = typeof update === 'function' ? (update as (previous: T) => T)(modalHarness.states[index] as T) : update
    }]
  },
  useMemo: <T>(factory: () => T) => factory(),
  useEffect: () => {},
}))
vi.mock('dash-ui-kit/react', () => ({ Avatar: 'avatar' }))
vi.mock('@renderer/components/dash-ui-kit-extended', () => ({
  Button: 'button',
  DeleteIcon: 'delete-icon',
  HighlightedIdentifier: 'identifier',
  PencilIcon: 'pencil-icon',
  PlusIcon: 'plus-icon',
  Text: 'span',
  Tooltip: 'tooltip',
}))
vi.mock('@renderer/components/ui/CopyButton', () => ({ default: 'copy-button' }))
vi.mock('@renderer/components/ui/CustomBadge', () => ({ default: 'custom-badge' }))
vi.mock('@renderer/components/ui/Modal', () => ({ default: 'modal' }))
vi.mock('@renderer/components/ui/NoResults', () => ({ default: 'no-results' }))
vi.mock('@renderer/components/ui/RetryButton', () => ({ default: 'retry-button' }))
vi.mock('@renderer/components/ui/SearchField', () => ({ default: 'search-field' }))
vi.mock('@renderer/components/ui/SegmentedControl', () => ({ default: 'segmented-control' }))
vi.mock('@renderer/components/ui/Skeleton', () => ({ default: 'list-skeleton' }))
vi.mock('@renderer/components/ui/Toast', () => ({ toast: { error: vi.fn() } }))
vi.mock('@renderer/hooks/useAddressBook', () => ({
  useAddressBook: () => ({
    contacts: modalHarness.contacts,
    loading: false,
    err: null,
    network: 'testnet',
    reload: modalHarness.reload,
    addContact: modalHarness.addContact,
    updateContact: modalHarness.updateContact,
    deleteContact: modalHarness.deleteContact,
  }),
}))

import AddressBookModal from '../../src/renderer/src/components/modal/AddressBookModal'

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}

function renderModal(overrides: Partial<React.ComponentProps<typeof AddressBookModal>> = {}) {
  modalHarness.index = 0
  return AddressBookModal({
    open: true,
    onClose: vi.fn(),
    destination: DestinationKind.CoreAddress,
    network: 'testnet',
    currentValue: '',
    onSelect: vi.fn(),
    ownOptions: [
      { value: coreAddr2, label: coreAddr2, badge: 'Savings', description: 'Your receiving address', metadata: ['0 Dash', 'Tx count: 0'] },
    ],
    ...overrides,
  })
}

beforeEach(() => {
  vi.stubGlobal('React', React)
  modalHarness.states = []
  modalHarness.contacts = sampleContacts
  modalHarness.addContact.mockReset().mockResolvedValue(undefined)
  modalHarness.updateContact.mockReset().mockResolvedValue(undefined)
  modalHarness.deleteContact.mockReset().mockResolvedValue(undefined)
  modalHarness.reload.mockReset()
})

afterEach(() => vi.unstubAllGlobals())

describe('addressBook utilities', () => {
  it('filters contacts by compatible destination vs all and searches by label or address', () => {
    const compatible = filterAddressBookContacts({
      contacts: sampleContacts,
      destination: DestinationKind.CoreAddress,
      network: 'testnet',
      scope: 'compatible',
      query: '',
    })
    expect(compatible.compatibleCount).toBe(1)
    expect(compatible.entries.map(entry => entry.contact.id)).toEqual([1])

    const all = filterAddressBookContacts({
      contacts: sampleContacts,
      destination: DestinationKind.CoreAddress,
      network: 'testnet',
      scope: 'all',
      query: '',
    })
    expect(all.entries.map(entry => [entry.contact.id, entry.compatible])).toEqual([
      [1, true],
      [2, false],
      [3, false],
    ])

    const searched = filterAddressBookContacts({
      contacts: sampleContacts,
      destination: DestinationKind.CoreAddress,
      network: 'testnet',
      scope: 'all',
      query: 'bob',
    })
    expect(searched.entries.map(entry => entry.contact.id)).toEqual([2])
  })

  it('filters own options by label, address, and identity usernames without min-length gating', () => {
    const options = [
      { value: coreAddr2, label: coreAddr2, badge: 'Savings', description: 'Your receiving address' },
      { value: identityAddr, label: identityAddr, description: 'alice.dash', searchTerms: ['alice.dash'] },
    ]
    expect(filterOwnAddressBookOptions(options, '')).toHaveLength(2)
    expect(filterOwnAddressBookOptions(options, 'sa').map(o => o.value)).toEqual([coreAddr2])
    expect(filterOwnAddressBookOptions(options, 'al').map(o => o.value)).toEqual([identityAddr])
    expect(filterOwnAddressBookOptions(options, 'receiving')).toEqual([])
  })

  it('validates contact form against scope, duplicates, and edits', () => {
    // Rejects Platform address in Compatible Core mode
    expect(validateContactForm({
      label: 'Test',
      address: coreAddr2,
      destination: DestinationKind.CoreAddress,
      network: 'testnet',
      scope: 'compatible',
      contacts: sampleContacts,
      editingId: null,
    }).valid).toBe(true)

    const incompatibleInCompatibleScope = validateContactForm({
      label: 'Test',
      address: platformAddr,
      destination: DestinationKind.CoreAddress,
      network: 'testnet',
      scope: 'compatible',
      contacts: sampleContacts.filter(c => c.id === 1),
      editingId: null,
    })
    expect(incompatibleInCompatibleScope.valid).toBe(false)
    expect(incompatibleInCompatibleScope.addressError).toContain('Core')

    // Allows saving another address type in All scope with an explanatory notice
    const incompatibleInAllScope = validateContactForm({
      label: 'Test',
      address: platformAddr,
      destination: DestinationKind.CoreAddress,
      network: 'testnet',
      scope: 'all',
      contacts: sampleContacts.filter(c => c.id === 1),
      editingId: null,
    })
    expect(incompatibleInAllScope.valid).toBe(true)
    expect(incompatibleInAllScope.incompatibleNotice).toBe(ADDRESS_BOOK_COPY.incompatibleSaveNotice)

    // Rejects duplicates except when editing the same contact
    expect(validateContactForm({
      label: 'Dup',
      address: coreAddr1,
      destination: DestinationKind.CoreAddress,
      network: 'testnet',
      scope: 'compatible',
      contacts: sampleContacts,
      editingId: null,
    }).addressError).toBe(ADDRESS_BOOK_COPY.duplicateAddressError)

    expect(validateContactForm({
      label: 'Alice Renamed',
      address: coreAddr1,
      destination: DestinationKind.CoreAddress,
      network: 'testnet',
      scope: 'compatible',
      contacts: sampleContacts,
      editingId: 1,
    }).valid).toBe(true)
  })
})

describe('AddressBookModal component', () => {
  it('supports Save current address, selecting compatible contacts, and keeping incompatible contacts non-selectable in All mode', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    const tree = renderModal({ currentValue: coreAddr2, onSelect, onClose })
    const nodes = elements(tree)

    // Save current banner appears when currentValue is valid and unsaved
    const saveCurrentBtn = nodes.find(node => node.type === 'button' && node.props.children === ADDRESS_BOOK_COPY.saveCurrentButton)!
    expect(saveCurrentBtn).toBeDefined()

    // Selecting compatible Alice Core contact invokes onSelect and onClose
    const aliceButton = nodes.find(node => node.type === 'button' && elements(node).some(child => child.props.children === coreAddr1))!
    ;(aliceButton.props.onClick as () => void)()
    expect(onSelect).toHaveBeenCalledWith(coreAddr1)
    expect(onClose).toHaveBeenCalled()

    // Switch scope to 'all' and verify incompatible Bob Platform row is aria-disabled while keeping edit/delete actions
    modalHarness.states = ['contacts', 'all']
    const allTree = renderModal({ currentValue: '', onSelect, onClose })
    const allNodes = elements(allTree)
    const disabledRow = allNodes.find(node => node.props['aria-disabled'] === 'true' && elements(node).some(child => child.props.children === platformAddr))!
    expect(disabledRow).toBeDefined()
    expect(allNodes.some(node => node.props['aria-label'] === `${ADDRESS_BOOK_COPY.editAction} Bob Platform`)).toBe(true)
    expect(allNodes.some(node => node.props['aria-label'] === `${ADDRESS_BOOK_COPY.deleteAction} Bob Platform`)).toBe(true)
  })

  it('supports editing, inline delete confirmation, and selecting from My addresses tab', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()

    // Open Edit form via pencil button
    let tree = renderModal({ onSelect, onClose })
    const editBtn = elements(tree).find(node => node.props['aria-label'] === `${ADDRESS_BOOK_COPY.editAction} Alice Core`)!
    ;(editBtn.props.onClick as () => void)()
    tree = renderModal({ onSelect, onClose })
    const labelInput = elements(tree).find(node => node.props['aria-label'] === ADDRESS_BOOK_COPY.labelField)!
    ;(labelInput.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'Alice Updated' } })
    tree = renderModal({ onSelect, onClose })
    const form = elements(tree).find(node => node.type === 'form')!
    await (form.props.onSubmit as (e: { preventDefault: () => void }) => Promise<void>)({ preventDefault: () => {} })
    expect(modalHarness.updateContact).toHaveBeenCalledWith(sampleContacts[0], 'Alice Updated', coreAddr1)

    // Delete with inline confirmation
    modalHarness.states = []
    tree = renderModal({ onSelect, onClose })
    const deleteBtn = elements(tree).find(node => node.props['aria-label'] === `${ADDRESS_BOOK_COPY.deleteAction} Alice Core`)!
    ;(deleteBtn.props.onClick as () => void)()
    tree = renderModal({ onSelect, onClose })
    const confirmBtn = elements(tree).find(node => node.type === 'button' && node.props.children === ADDRESS_BOOK_COPY.confirmDeleteButton)!
    await (confirmBtn.props.onClick as () => Promise<void>)()
    expect(modalHarness.deleteContact).toHaveBeenCalledWith(1)

    // Switch to My addresses tab and select own address
    modalHarness.states = ['own']
    tree = renderModal({ onSelect, onClose })
    const ownOptionBtn = elements(tree).find(node => node.type === 'button' && elements(node).some(child => child.props.children === coreAddr2))!
    ;(ownOptionBtn.props.onClick as () => void)()
    expect(onSelect).toHaveBeenCalledWith(coreAddr2)
    expect(onClose).toHaveBeenCalled()
  })
})
