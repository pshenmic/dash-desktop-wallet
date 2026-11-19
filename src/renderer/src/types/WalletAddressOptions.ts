import type { DropdownFieldOption } from './DropdownField'

export interface WalletAddressOptionsResult {
  options: DropdownFieldOption[]
  labelsByAddress: ReadonlyMap<string, string>
  badgeFor: (address: string) => string | undefined
  loading: boolean
  err: string | null
  retry: () => void
}
