import type { WalletAddressDto } from '@renderer/api/types'
import type { DropdownFieldOption } from './DropdownField'

export interface WalletAddressOptionsResult {
  options: DropdownFieldOption[]
  receiving: WalletAddressDto[]
  change: WalletAddressDto[]
  labelsByAddress: ReadonlyMap<string, string>
  defaultPayoutAddress: string | null
  badgeFor: (address: string) => string | undefined
  loading: boolean
  err: string | null
  retry: () => void
}
