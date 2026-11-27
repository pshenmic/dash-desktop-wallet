import { API } from '@renderer/api'
import type { WalletAddressDto } from '@renderer/api/types'
import { refreshAddresses } from '@renderer/hooks/useAdresses'
import { invalidateAsyncCache } from '@renderer/hooks/useAsyncWithCache'
import { nextReceiveCoreAddress, receiveCoreAddresses } from './receiveDefaults'

export function lockedAddressSet(addresses: ReadonlyArray<Pick<WalletAddressDto, 'address' | 'isLocked'>>): Set<string> {
  return new Set(addresses.filter(address => address.isLocked).map(address => address.address))
}

export function resolveActiveReceiveCoreAddress(params: {
  addresses: WalletAddressDto[]
  claimed: ReadonlySet<string>
  defaultAddress: string | null
  derivedAddress: string | null
}): string | null {
  const { addresses, claimed, defaultAddress, derivedAddress } = params
  const locked = lockedAddressSet(addresses)
  const next = nextReceiveCoreAddress(addresses, claimed, defaultAddress)
  if (next != null) return next.address
  if (derivedAddress != null && !locked.has(derivedAddress) && !claimed.has(derivedAddress)) {
    return derivedAddress
  }
  if (defaultAddress != null && !locked.has(defaultAddress) && !claimed.has(defaultAddress)) {
    return defaultAddress
  }
  const firstUnusedUnlocked = receiveCoreAddresses(addresses)[0]?.address
  if (firstUnusedUnlocked != null) return firstUnusedUnlocked
  if (defaultAddress != null && !locked.has(defaultAddress)) return defaultAddress
  return null
}

export async function toggleWalletAddressLock(
  walletId: string,
  address: string,
  nextLocked: boolean,
): Promise<void> {
  await API.setAddressLocked(walletId, address, nextLocked)
  invalidateAsyncCache('receiveAddress', walletId)
  await refreshAddresses(walletId)
}
