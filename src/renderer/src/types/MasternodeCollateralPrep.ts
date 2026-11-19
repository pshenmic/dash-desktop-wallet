import type { Network, SelectableUtxo, WalletAddressDto } from '@renderer/api/types'
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
  receiving: WalletAddressDto[]
  claimedAddresses: ReadonlySet<string>
  labelsByAddress: ReadonlyMap<string, string>
  badgeFor: (address: string) => string | undefined
  addressesLoading: boolean
  addressesError: string | null
  onRetryAddresses: () => void
  onPrepared: (outpoint: string, refreshedUtxos: SelectableUtxo[]) => void
  onClose: () => void
}
