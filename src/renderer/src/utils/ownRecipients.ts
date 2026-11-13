import type { WalletAddressDto } from '../api/types'
import { DestinationKind } from '../enums/DestinationKind'
import type { DropdownFieldOption } from '../types/DropdownField'
import type { ReceiveRequestDto, ReceiveRequestKind } from '../types/ReceiveRequest'
import type { SendRecipientDraft } from '../types/SendDraft'
import type { OwnRecipientInventory } from '../types/SendRecipients'
import { creditsToDash, davToDash } from './balance'
import { addressLabelsByAddress } from './receiveDefaults'

export function walletAddressLabels(
  requests: ReadonlyArray<Pick<ReceiveRequestDto, 'address' | 'label'>> | undefined,
  receiving: WalletAddressDto[],
  change: WalletAddressDto[],
): Map<string, string> {
  const labels = addressLabelsByAddress(requests ?? [])
  for (const address of [...receiving, ...change]) {
    const trimmed = address.label?.trim() ?? ''
    if (trimmed !== '' && !labels.has(address.address)) {
      labels.set(address.address, trimmed)
    }
  }
  return labels
}

export function matchingOptionsByLabel(
  options: DropdownFieldOption[],
  query: string,
): DropdownFieldOption[] {
  const trimmed = query.trim()
  if (trimmed === '' || options.some(option => option.value === trimmed)) return []
  const needle = trimmed.toLowerCase()
  return options.filter(option => {
    const badge = option.badge?.trim()
    return badge != null && badge !== '' && badge.toLowerCase().includes(needle)
  })
}

export function availableOwnRecipientOptions(
  options: DropdownFieldOption[] | undefined,
  recipients: SendRecipientDraft[],
  currentId: string,
): DropdownFieldOption[] | undefined {
  if (options == null) return undefined
  const taken = new Set(
    recipients
      .filter(recipient => recipient.id !== currentId)
      .map(recipient => recipient.address.trim())
      .filter(Boolean),
  )
  if (taken.size === 0) return options
  return options.filter(option => !taken.has(option.value))
}

function labelForAddress(
  address: string,
  labelsByAddress: ReadonlyMap<string, string> | undefined,
  fallback?: string | null,
): string | undefined {
  const fromMap = labelsByAddress?.get(address)?.trim()
  if (fromMap) return fromMap
  const fromAddress = fallback?.trim()
  return fromAddress || undefined
}

function labeledRequestFallbacks(
  requests: ReadonlyArray<Pick<ReceiveRequestDto, 'address' | 'label' | 'kind'>> | undefined,
  kind: ReceiveRequestKind,
  labelsByAddress: ReadonlyMap<string, string> | undefined,
  description?: string,
): DropdownFieldOption[] {
  if (!requests) return []
  const options: DropdownFieldOption[] = []
  for (const request of requests) {
    if (request.kind !== kind) continue
    const badge = labelForAddress(request.address, labelsByAddress, request.label)
    if (!badge) continue
    options.push({
      value: request.address,
      label: request.address,
      badge,
      ...(description ? { description } : {}),
    })
  }
  return options
}

export function ownRecipientOptions(kind: DestinationKind, inventory: OwnRecipientInventory): DropdownFieldOption[] {
  let options: DropdownFieldOption[]
  switch (kind) {
    case DestinationKind.CoreAddress:
      options = [
        ...[...inventory.receiving, ...inventory.change]
          .filter(address => {
            const badge = labelForAddress(address.address, inventory.labelsByAddress, address.label)
            return badge != null || (!address.isUsed && address.balance === 0n && address.txCount === 0)
          })
          .map(address => {
            const badge = labelForAddress(address.address, inventory.labelsByAddress, address.label)
            return {
              value: address.address,
              label: address.address,
              ...(badge ? { badge } : {}),
              metadata: [`${davToDash(address.balance)} Dash`, `Tx count: ${address.txCount}`],
              description: address.isChange ? 'Your change address' : 'Your receiving address',
            }
          }),
        ...labeledRequestFallbacks(inventory.receiveRequests, 'core', inventory.labelsByAddress, 'Your receiving address'),
      ]
      break
    case DestinationKind.PlatformAddress:
      options = [
        ...inventory.platformAddresses
          .filter(address => {
            const badge = labelForAddress(address.platformAddress, inventory.labelsByAddress)
            return badge != null || (address.balanceCredits === 0n && address.nonce === 0)
          })
          .map(address => {
            const badge = labelForAddress(address.platformAddress, inventory.labelsByAddress)
            return {
              value: address.platformAddress,
              label: address.platformAddress,
              ...(badge ? { badge } : {}),
              metadata: [`${creditsToDash(address.balanceCredits)} Dash`, `Nonce: ${address.nonce}`],
            }
          }),
        ...labeledRequestFallbacks(inventory.receiveRequests, 'platform', inventory.labelsByAddress),
      ]
      break
    case DestinationKind.Shielded: {
      if (inventory.shieldedNotes === null) {
        options = [
          ...inventory.shieldedAddresses.flatMap(address => {
            const badge = labelForAddress(address, inventory.labelsByAddress)
            return badge ? [{ value: address, label: address, badge }] : []
          }),
          ...labeledRequestFallbacks(inventory.receiveRequests, 'shielded', inventory.labelsByAddress),
        ]
        break
      }
      const usedAddresses = new Set(inventory.shieldedNotes.map(note => note.address))
      const balancesByAddress = new Map<string, bigint>()
      for (const note of inventory.shieldedNotes) {
        if (!note.spent) {
          balancesByAddress.set(note.address, (balancesByAddress.get(note.address) ?? 0n) + note.amount)
        }
      }
      options = [
        ...inventory.shieldedAddresses
          .filter(address => {
            const badge = labelForAddress(address, inventory.labelsByAddress)
            return badge != null || !usedAddresses.has(address)
          })
          .map(address => {
            const badge = labelForAddress(address, inventory.labelsByAddress)
            const noteBalance = balancesByAddress.get(address) ?? 0n
            return {
              value: address,
              label: address,
              ...(badge ? { badge } : {}),
              metadata: [usedAddresses.has(address) ? `${creditsToDash(noteBalance)} Dash` : '0 Dash'],
            }
          }),
        ...labeledRequestFallbacks(inventory.receiveRequests, 'shielded', inventory.labelsByAddress),
      ]
      break
    }
    case DestinationKind.Identity:
      options = inventory.identities.map(identity => ({
        value: identity.identifier,
        label: identity.identifier,
        description: identity.usernames[0],
        metadata: [`${creditsToDash(identity.balance.amount)} Dash`],
      }))
      break
    default:
      return []
  }
  const deduped = new Map<string, DropdownFieldOption>()
  for (const option of options) {
    if (!deduped.has(option.value)) {
      deduped.set(option.value, option)
    }
  }
  return Array.from(deduped.values())
}
