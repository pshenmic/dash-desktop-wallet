import { SharedRegistrationStage } from '@renderer/enums/Masternodes'
import type { SegmentOption } from '@renderer/types/SegmentedControl'

export const SHARED_TAB_COPY = {
  searchPlaceholder: 'ProTxHash, service or share owner address',
  searchLabel: 'Search shared masternodes',
  segmentsLabel: 'Shared node filter',
  emptyTitle: 'No shared masternodes discovered',
  emptyDescription: 'Shared masternodes where this wallet holds a share owner, voting, or operator key appear here.',
  addSharedButton: 'Add shared node',
  participateButton: 'Participate in registration',
  noMatch: 'No shared nodes match',
  clearSearch: 'Clear search',
  segmentEmpty: 'No shared masternodes match this filter',
} as const

export const ADD_SHARED_MODAL_COPY = {
  title: 'Add shared masternode',
  description: 'Sign a coordinator’s shared registration transaction or import existing shared masternode keys.',
  participateTitle: 'Participate in registration',
  participateDescription: 'Preview a prepared or combined shared ProRegTx hex and sign share consent or funding inputs.',
  importTitle: 'Import keys',
  importDescription: 'Paste share Owner, Voting (WIF) or Operator (BLS) private keys to discover and sign for shared nodes.',
} as const

export const SHARED_STAGE_OPTIONS: SegmentOption<SharedRegistrationStage>[] = [
  { value: SharedRegistrationStage.Consent, label: 'Step 1 · Sign consent' },
  { value: SharedRegistrationStage.Funding, label: 'Step 2 · Sign funding' },
]

export const SHARED_WIZARD_COPY = {
  pageTitle: 'Shared masternode registration',
  pageSubtitle: 'Review a coordinator’s shared ProRegTx, verify share stakes and outputs, then sign consent or funding inputs.',
  backLabel: 'Back to Shared',
  resetButton: 'Reset',
  stageLabel: 'Signing stage',
  stageHints: {
    [SharedRegistrationStage.Consent]: 'Paste the prepared shared ProRegTx hex from the coordinator to inspect shares and sign your share owner consent.',
    [SharedRegistrationStage.Funding]: 'Paste the combined ProRegTx hex (after the coordinator ran shared_combine with all joinSigs) to sign only your funding inputs.',
  },
  txHexLabel: 'Prepared / combined ProRegTx hex',
  txHexPlaceholder: 'Paste the hexadecimal shared ProRegTx from the coordinator…',
  previewLoading: 'Decoding and verifying shared registration…',
  invalidTxHexHint: 'Enter a valid hexadecimal transaction payload.',
  summarySection: 'Registration summary',
  consentHashLabel: 'Consent digest',
  collateralLabel: 'Total collateral',
  signableSharesLabel: 'Your signable shares',
  walletFundingLabel: 'Your funding inputs',
  otherInputsLabel: 'Other / external inputs',
  sharesSection: 'Collateral share table',
  yourShareBadge: 'Your share',
  participantBadge: 'Participant',
  rewardAddressPrefix: 'Reward: ',
  refundAddressPrefix: 'Refund: ',
  fundingInputsSection: 'Funding inputs owned by this wallet',
  noWalletFundingInputs: 'No funding inputs in this transaction belong to this wallet.',
  outputsSection: 'Transaction outputs',
  collateralOutputBadge: 'Shared collateral',
  changeOutputFallback: 'Script output',
  noSignableShares: 'This wallet holds no share owner key with a signing secret for this registration. Import your share owner key or switch wallets.',
  noFundingInputs: 'This wallet owns no unlocked funding input in this transaction. Make sure the input address or imported key is in this wallet.',
  importKeysAction: 'Import keys',
  authorizeLabel: 'Authorize with wallet password',
  signConsentButton: 'Sign consent',
  signFundingButton: 'Sign funding inputs',
  signingConsent: 'Signing consent…',
  signingFunding: 'Signing funding inputs…',
  cancelButton: 'Cancel',
  consentDoneHeadline: 'Share consent signed',
  consentDoneDescription: 'Send these base64 consent signatures to the coordinator so they can assemble joinSigs with shared_combine.',
  copyAllSignatures: 'Copy all signatures',
  copiedAllSignatures: 'Copied all',
  shareSignatureLabelPrefix: 'Share #',
  proceedToFunding: 'Continue to Step 2 · Sign funding',
  fundingDoneHeadline: 'Funding inputs signed',
  fundingDoneDescription: 'Only this wallet’s funding inputs were signed. Return the updated transaction hex to the coordinator.',
  signedInputsLabel: 'Signed input indices',
  signedHexLabel: 'Partially signed ProRegTx hex',
  backToShared: 'Back to Shared',
} as const

export const MIN_SHARED_TX_HEX_LENGTH = 64
