import type { PaymentRequestDto, PlatformAddressDto, WalletAddressDto } from '../api/types'
import type { ReceiveRequestDto, ReceiveRequestKind } from '../types/ReceiveRequest'
import { isValidPlatformAddress } from './platformAddress'
import { isLikelyShieldedAddress } from './shieldedAddress'

export function receiveRequestKind(address: string): ReceiveRequestKind {
  if (isLikelyShieldedAddress(address)) return 'shielded'
  if (isValidPlatformAddress(address)) return 'platform'
  return 'core'
}

export function toReceiveRequest(request: PaymentRequestDto): ReceiveRequestDto {
  return {
    id: request.id,
    walletId: request.walletId,
    kind: receiveRequestKind(request.address),
    address: request.address,
    label: request.label,
    amountDuffs: request.amountDuffs,
    createdAt: request.createdAt,
  }
}

export function isUnusedPlatformAddress(address: PlatformAddressDto): boolean {
  return address.nonce === 0 && address.balanceCredits === 0n
}

export function receivePlatformAddresses(addresses: PlatformAddressDto[]): PlatformAddressDto[] {
  return addresses.filter(isUnusedPlatformAddress)
}

export function defaultReceivePlatformAddress(addresses: PlatformAddressDto[]): PlatformAddressDto | undefined {
  return receivePlatformAddresses(addresses)[0]
}

export function nextReceivePlatformAddress(
  addresses: PlatformAddressDto[],
  claimedAddresses: ReadonlySet<string>,
): PlatformAddressDto | undefined {
  return receivePlatformAddresses(addresses).find((address) => !claimedAddresses.has(address.platformAddress))
}

export function receiveCoreAddresses(addresses: WalletAddressDto[]): WalletAddressDto[] {
  return addresses.filter((address) => !address.isUsed && address.txCount === 0 && address.balance === 0n)
}

export function defaultReceiveCoreAddress(
  addresses: WalletAddressDto[],
  preferred?: string | null,
): WalletAddressDto | undefined {
  const receiveAddresses = receiveCoreAddresses(addresses)
  return receiveAddresses.find((address) => address.address === preferred) ?? receiveAddresses[0]
}

export function nextReceiveCoreAddress(
  addresses: WalletAddressDto[],
  claimedAddresses: ReadonlySet<string>,
  preferred?: string | null,
): WalletAddressDto | undefined {
  const unclaimed = receiveCoreAddresses(addresses).filter((address) => !claimedAddresses.has(address.address))
  return unclaimed.find((address) => address.address === preferred) ?? unclaimed[0]
}

export function defaultReceiveShieldedAddress(
  addresses: string[],
  balances: Map<string, bigint>,
): string | undefined {
  return receiveShieldedAddresses(addresses, balances)[0]
}

export function receiveShieldedAddresses(
  addresses: string[],
  balances: Map<string, bigint>,
): string[] {
  return addresses.filter((address) => (balances.get(address) ?? 0n) === 0n)
}

export function nextReceiveShieldedAddress(
  addresses: string[],
  balances: Map<string, bigint>,
  claimedAddresses: ReadonlySet<string>,
): string | undefined {
  return receiveShieldedAddresses(addresses, balances).find((address) => !claimedAddresses.has(address))
}

export function claimedReceiveAddresses(
  requests: ReadonlyArray<Pick<ReceiveRequestDto, 'address'>>,
): Set<string> {
  return new Set(requests.map((request) => request.address))
}

export function addressLabelsByAddress(
  requests: ReadonlyArray<Pick<ReceiveRequestDto, 'address' | 'label'>>,
): Map<string, string> {
  const labels = new Map<string, string>()
  for (const request of requests) {
    const trimmed = request.label?.trim() ?? ''
    if (trimmed !== '' && !labels.has(request.address)) {
      labels.set(request.address, trimmed)
    }
  }
  return labels
}
