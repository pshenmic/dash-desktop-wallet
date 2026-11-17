import type { WalletAddressDto } from '@renderer/api/types'
import { DASH_UNIT } from '@renderer/constants/balance'
import {
  MASTERNODE_CHANGE_ADDRESS_DESCRIPTION,
  MASTERNODE_REQUEST_ADDRESS_DESCRIPTION,
} from '@renderer/constants/masternodeAddresses'
import type { DropdownFieldOption } from '@renderer/types/DropdownField'
import type { ReceiveRequestDto } from '@renderer/types/ReceiveRequest'
import { davToDash } from './balance'

function resolveBadge(
  address: string,
  labelsByAddress: ReadonlyMap<string, string>,
  fallback?: string | null,
): string | undefined {
  const fromMap = labelsByAddress.get(address)?.trim()
  if (fromMap) return fromMap
  const fromFallback = fallback?.trim()
  return fromFallback || undefined
}

export function masternodeWalletAddressOptions(
  receiving: WalletAddressDto[],
  change: WalletAddressDto[],
  requests: ReadonlyArray<Pick<ReceiveRequestDto, 'address' | 'label' | 'kind'>>,
  labelsByAddress: ReadonlyMap<string, string>,
): DropdownFieldOption[] {
  const deduped = new Map<string, DropdownFieldOption>()

  for (const addr of receiving) {
    if (deduped.has(addr.address)) continue
    const badge = resolveBadge(addr.address, labelsByAddress, addr.label)
    deduped.set(addr.address, {
      value: addr.address,
      label: addr.address,
      ...(badge ? { badge } : {}),
      description: addr.derivationPath,
      metadata: [`${davToDash(addr.balance)} ${DASH_UNIT}`, `Tx count: ${addr.txCount}`],
    })
  }

  for (const addr of change) {
    if (deduped.has(addr.address)) continue
    const badge = resolveBadge(addr.address, labelsByAddress, addr.label)
    if (!badge) continue
    deduped.set(addr.address, {
      value: addr.address,
      label: addr.address,
      badge,
      description: MASTERNODE_CHANGE_ADDRESS_DESCRIPTION,
      metadata: [`${davToDash(addr.balance)} ${DASH_UNIT}`, `Tx count: ${addr.txCount}`],
    })
  }

  for (const req of requests) {
    if (req.kind !== 'core' || deduped.has(req.address)) continue
    const badge = resolveBadge(req.address, labelsByAddress, req.label)
    if (!badge) continue
    deduped.set(req.address, {
      value: req.address,
      label: req.address,
      badge,
      description: MASTERNODE_REQUEST_ADDRESS_DESCRIPTION,
    })
  }

  return Array.from(deduped.values())
}
