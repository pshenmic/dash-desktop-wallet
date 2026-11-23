import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { ADDRESS_ROW_ADD_LABEL, ADDRESS_ROW_EDIT_LABEL, ADDRESS_ROW_LABEL_LOCKED_TOOLTIP } from '../../src/renderer/src/constants/addressRow'

const rowHarness = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
}))

vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: <T>(initial: T) => {
    const index = rowHarness.index++
    if (!(index in rowHarness.states)) rowHarness.states[index] = initial
    return [rowHarness.states[index], (update: T | ((previous: T) => T)) => {
      rowHarness.states[index] = typeof update === 'function' ? (update as (previous: T) => T)(rowHarness.states[index] as T) : update
    }]
  },
  useEffect: () => {},
}))
vi.mock('@renderer/components/dash-ui-kit-extended', () => ({
  Button: 'button',
  ExternalLinkIcon: 'external-link-icon',
  HighlightedIdentifier: 'identifier',
  KeyIcon: 'key-icon',
  PencilIcon: 'pencil-icon',
  Text: 'span',
  Tooltip: 'tooltip',
}))
vi.mock('@renderer/components/ui/CopyButton', () => ({ default: 'copy-button' }))
vi.mock('@renderer/components/ui/CustomBadge', () => ({ default: 'custom-badge' }))
vi.mock('@renderer/components/ui/QrButton', () => ({ default: 'qr-button' }))
vi.mock('@renderer/components/ui/SensitiveValue', () => ({ default: 'sensitive-value' }))
vi.mock('@renderer/components/ui/Toast', () => ({ toast: { error: vi.fn() } }))
vi.mock('@renderer/hooks/useFiat', () => ({ useFiat: () => ({ format: () => '$0', rateReady: false }) }))

import AddressRow from '../../src/renderer/src/components/ui/AddressRow'
import CustomBadge from '../../src/renderer/src/components/ui/CustomBadge'

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}

function renderRow(overrides: Partial<React.ComponentProps<typeof AddressRow>> = {}) {
  rowHarness.index = 0
  return AddressRow({
    address: 'yTestAddress123',
    amount: '1 DASH',
    ...overrides,
  })
}

beforeEach(() => {
  vi.stubGlobal('React', React)
  rowHarness.states = []
})

afterEach(() => vi.unstubAllGlobals())

describe('AddressRow label editing', () => {
  it('renders Receive and address labels identically via CustomBadge and locks editing for Receive labels', () => {
    const lockedTree = renderRow({ label: 'Invoice #1', labelLocked: true })
    const lockedNodes = elements(lockedTree)
    expect(lockedNodes.find(node => node.type === CustomBadge)?.props.text).toBe('Invoice #1')
    const tooltip = lockedNodes.find(node => node.type === 'tooltip')!
    expect(tooltip.props.label).toBe(ADDRESS_ROW_LABEL_LOCKED_TOOLTIP)
    const disabledBtn = lockedNodes.find(node => node.type === 'button' && node.props.disabled === true)!
    expect(disabledBtn).toBeDefined()
    expect(lockedNodes.some(node => node.type === 'form')).toBe(false)
  })

  it('opens inline editor, trims and saves new labels, and clears label when saved empty', async () => {
    const onSaveLabel = vi.fn().mockResolvedValue(undefined)
    let tree = renderRow({ label: null, onSaveLabel })
    const addBtn = elements(tree).find(node => node.props['aria-label'] === ADDRESS_ROW_ADD_LABEL)!
    ;(addBtn.props.onClick as () => void)()

    tree = renderRow({ label: null, onSaveLabel })
    const input = elements(tree).find(node => node.props['aria-label'] === ADDRESS_ROW_EDIT_LABEL)!
    ;(input.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: '  Treasury  ' } })
    tree = renderRow({ label: null, onSaveLabel })
    const form = elements(tree).find(node => node.type === 'form')!
    await (form.props.onSubmit as (e: { preventDefault: () => void }) => Promise<void>)({ preventDefault: () => {} })
    expect(onSaveLabel).toHaveBeenCalledWith('Treasury')

    // Clearing label when saved empty
    rowHarness.states = []
    tree = renderRow({ label: 'Treasury', onSaveLabel })
    const editBtn = elements(tree).find(node => node.props['aria-label'] === ADDRESS_ROW_EDIT_LABEL)!
    ;(editBtn.props.onClick as () => void)()
    tree = renderRow({ label: 'Treasury', onSaveLabel })
    const clearInput = elements(tree).find(node => node.props['aria-label'] === ADDRESS_ROW_EDIT_LABEL)!
    ;(clearInput.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: '   ' } })
    tree = renderRow({ label: 'Treasury', onSaveLabel })
    const clearForm = elements(tree).find(node => node.type === 'form')!
    await (clearForm.props.onSubmit as (e: { preventDefault: () => void }) => Promise<void>)({ preventDefault: () => {} })
    expect(onSaveLabel).toHaveBeenCalledWith('')
  })
})
