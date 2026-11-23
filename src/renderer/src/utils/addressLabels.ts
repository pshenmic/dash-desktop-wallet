import type { ResolvedAddressLabel } from '../types/AddressRow'

export function resolveAddressLabel(
  addressLabel: string | null | undefined,
  receiveRequestLabel: string | null | undefined,
): ResolvedAddressLabel {
  const receiveTrimmed = receiveRequestLabel?.trim() ?? ''
  if (receiveTrimmed !== '') {
    return { label: receiveTrimmed, lockedByReceive: true }
  }
  const ownTrimmed = addressLabel?.trim() ?? ''
  return {
    label: ownTrimmed !== '' ? ownTrimmed : null,
    lockedByReceive: false,
  }
}
