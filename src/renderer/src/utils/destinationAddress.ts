import type { Network } from '../api/types'
import { DestinationKind } from '../enums/DestinationKind'
import type { ContactDestinationKind } from '../types/AddressBook'
import { isValidDashAddress } from './address'
import { isValidPlatformAddress } from './platformAddress'
import { isLikelyShieldedAddress } from './shieldedAddress'
import { isLikelyIdentityId } from './transferMatrix'

export function isValidDestinationAddress(destination: DestinationKind, address: string, network: Network | null): boolean {
  switch (destination) {
    case DestinationKind.CoreAddress:
      return isValidDashAddress(address.trim(), network ?? undefined)
    case DestinationKind.PlatformAddress:
      return isValidPlatformAddress(address, network ?? undefined)
    case DestinationKind.Identity:
      return isLikelyIdentityId(address)
    case DestinationKind.Shielded:
      return isLikelyShieldedAddress(address)
    case DestinationKind.NewIdentity:
      return false
  }
}

export function classifyDestinationAddress(address: string, network: Network | null): ContactDestinationKind | null {
  const trimmed = address.trim()
  if (trimmed.length === 0) return null
  if (isValidDashAddress(trimmed, network ?? undefined)) return DestinationKind.CoreAddress
  if (isValidPlatformAddress(trimmed, network ?? undefined)) return DestinationKind.PlatformAddress
  if (isLikelyShieldedAddress(trimmed)) return DestinationKind.Shielded
  if (isLikelyIdentityId(trimmed)) return DestinationKind.Identity
  return null
}
