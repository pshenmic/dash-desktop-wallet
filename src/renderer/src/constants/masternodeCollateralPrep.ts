import type { TransferPageType } from '@renderer/constants'

export const MASTERNODE_PREP_COLLATERAL_RECIPIENT_COPY: TransferPageType['recipient'] = {
  label: 'Destination collateral address',
  placeholder: 'Enter Address…',
  addressBook: 'Address Book',
  addressManagement: 'Address Management',
  noResults: 'No addresses found',
}

export const MASTERNODE_COLLATERAL_PREP_COPY = {
  buttonLabel: 'Prepare wallet',
  modalTitle: 'Prepare collateral UTXO',
  modalDescription: 'Combine existing wallet coins into a single exact collateral output and label its receiving address without leaving registration.',
  emptyHintPrefix: 'No single exact collateral UTXO was found. Unlocked spendable coins total',
  targetAddressSection: 'Destination address',
  labelField: 'Address label',
  labelPlaceholder: 'e.g. Evonode #1 collateral',
  defaultRegularLabel: 'Regular masternode collateral',
  defaultEvoLabel: 'Evonode collateral',
  coinsSection: 'Select wallet coins',
  autoSelectButton: 'Auto-select',
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
  cancelButton: 'Cancel',
  submitPrefix: 'Create',
  submitSuffix: 'UTXO',
  submitting: 'Broadcasting…',
  preparedTitle: 'Prepared collateral UTXO selected',
  preparedDescription: 'Your collateral transaction has been broadcast and selected above. You can continue configuring your masternode steps now.',
  confirmingCoinBadge: 'Confirming',
  invalidAddressError: 'Choose or enter a valid wallet P2PKH address.',
  noCoinsSelectedError: 'Select at least one spendable UTXO.',
} as const

export const COLLATERAL_PREP_FEE_BUFFER_DUFFS = 25_000n
