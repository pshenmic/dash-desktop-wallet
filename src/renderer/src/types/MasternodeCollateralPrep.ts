import type { Network, SelectableUtxo, WalletAddressDto } from '@renderer/api/types'
import type { FeeSelectableUtxo, MasternodeType } from './MasternodeRegistrationWizard'
import type { ReceiveRequestDto } from './ReceiveRequest'

export interface CollateralPrepSummary {
  requiredDuffs: bigint
  selectedCount: number
  selectedTotal: bigint
  feeDuffs: bigint | null
  changeDuffs: bigint | null
  shortfallDuffs: bigint
  enough: boolean
}

export interface CollateralInvoiceSyncPlan {
  deleteRequestId: number | null
  createRequest: { label: string; amountDuffs: bigint } | null
}

export type CollateralPrepCoinMode = 'auto' | 'manual'

export interface PrepareCollateralSectionProps {
  walletId: string
  type: MasternodeType
  network: Network | null
  utxos: FeeSelectableUtxo[]
  receiving: WalletAddressDto[]
  requests: ReceiveRequestDto[]
  claimedAddresses: ReadonlySet<string>
  labelsByAddress: ReadonlyMap<string, string>
  badgeFor: (address: string) => string | undefined
  addressesLoading: boolean
  addressesError: string | null
  onRetryAddresses: () => void
  onPrepared: (outpoint: string, refreshedUtxos: SelectableUtxo[]) => void
}
