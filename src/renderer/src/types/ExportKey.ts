import type { PlatformAddressDto, WalletAddressDto } from '@renderer/api/types'

export interface ExportKeyTarget {
  address: string
  path?: string
}

export interface ExportKeyModalProps {
  target: ExportKeyTarget | null
  onClose: () => void
}

export interface AddressListProps {
  coreGated?: boolean
  onExportKey?: (target: ExportKeyTarget) => void
}

export interface AddressCardProps extends WalletAddressDto {
  onExportKey?: () => void
}

export interface PlatformAddressCardProps extends PlatformAddressDto {
  label?: string | null
  onExportKey?: () => void
}

export interface FormattedAddressKey {
  address: string
  path: string
  wif: string
  privateKeyHex: string
  publicKeyHex: string
}
