import type { Network, SelectableUtxo } from '@renderer/api/types'
import type { DropdownFieldOption } from './DropdownField'
import type { FeeSelectableUtxo, MasternodeType } from './MasternodeRegistrationWizard'

export interface CollateralPrepSummary {
  requiredDuffs: bigint
  selectedCount: number
  selectedTotal: bigint
  feeDuffs: bigint | null
  changeDuffs: bigint | null
  shortfallDuffs: bigint
  enough: boolean
}

export interface PrepareCollateralModalProps {
  open: boolean
  walletId: string
  type: MasternodeType
  network: Network | null
  utxos: FeeSelectableUtxo[]
  addressOptions: DropdownFieldOption[]
  badgeFor: (address: string) => string | undefined
  addressesLoading: boolean
  addressesError: string | null
  onRetryAddresses: () => void
  onPrepared: (outpoint: string, refreshedUtxos: SelectableUtxo[]) => void
  onClose: () => void
}
