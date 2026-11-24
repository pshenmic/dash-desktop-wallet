import type { CollateralPrepCoinMode } from '@renderer/types/MasternodeCollateralPrep'
import type { SegmentOption } from '@renderer/types/SegmentedControl'

export const COLLATERAL_PREP_COIN_MODE_OPTIONS: SegmentOption<CollateralPrepCoinMode>[] = [
  { value: 'auto', label: 'Auto-select' },
  { value: 'manual', label: 'Manual' },
]

export const MASTERNODE_COLLATERAL_PREP_COPY = {
  buttonLabel: 'Prepare wallet',
  sectionTitle: 'Create collateral transfer',
  sectionDescription: 'Select an existing exact collateral UTXO in your wallet or combine coins into a single exact collateral output without leaving registration.',
  emptyHintPrefix: 'No single exact collateral UTXO was found. Unlocked spendable coins total',
  targetAddressSection: 'Destination address',
  labelField: 'Label',
  labelPlaceholder: 'e.g. Evonode #1 collateral',
  defaultRegularLabel: 'Regular masternode collateral',
  defaultEvoLabel: 'Evonode collateral',
  coinsSection: 'Select wallet coins',
  coinModeAriaLabel: 'Coin selection mode',
  selectAllButton: 'Select all',
  clearSelectionButton: 'Clear',
  noSpendableCoins: 'No unlocked non-collateral UTXOs are available in this wallet.',
  summarySection: 'Transaction summary',
  collateralOutputLabel: 'Collateral output',
  selectedInputsLabel: 'Selected inputs',
  networkFeeLabel: 'Network fee',
  changeReturnedLabel: 'Change returned',
  estimatingFee: 'Estimating…',
  insufficientPrefix: 'Need at least',
  insufficientSuffix: 'more DASH from selected coins to cover the collateral output and fee.',
  authorizeLabel: 'Authorize with wallet password',
  submitButton: 'Create internal transfer',
  submitting: 'Creating internal transfer…',
  preparedTitle: 'Prepared collateral UTXO selected',
  preparedDescription: 'Your collateral transaction has been broadcast and selected above. You can continue configuring your masternode steps now.',
  exactCollateralBadge: 'Collateral ready',
  sufficientCoinBadge: 'Sufficient funds',
  exactSelectedReadyTitle: 'Exact collateral UTXO selected',
  exactSelectedReadyDescription: 'This coin already matches the exact collateral amount and stays in your wallet. Click Continue below to configure masternode keys.',
  combineOtherCoinsButton: 'Combine other coins into a new collateral UTXO',
  coinsTooltip: 'Green "Collateral ready" coins match the exact collateral amount and can be selected immediately. Green "Sufficient funds" coins can cover the collateral and fee on their own; otherwise combine multiple coins into a new exact collateral output.',
  targetAddressTooltip: 'Automatically assigned unused receiving address in this wallet that will hold the exact collateral UTXO under your control.',
  labelTooltip: 'Optional wallet label saved for this collateral address so you can identify your node easily across Masternodes and Receive.',
  summaryTooltip: 'Shows the exact collateral output sent to your wallet address, selected input coins, estimated network fee, and any change returned to this wallet.',
  authorizeTooltip: 'Enter your wallet password to unlock local signing keys and broadcast this internal collateral transfer.',
  confirmingCoinBadge: 'Confirming',
  invalidAddressError: 'Choose or enter a valid wallet P2PKH address.',
  noCoinsSelectedError: 'Select at least one spendable UTXO.',
} as const

export const COLLATERAL_PREP_FEE_BUFFER_DUFFS = 25_000n
