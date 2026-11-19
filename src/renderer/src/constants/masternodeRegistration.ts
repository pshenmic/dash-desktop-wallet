import { EVO_MASTERNODE_TYPE, REGULAR_MASTERNODE_TYPE } from '@renderer/constants/masternodes'
import type {
  MasternodeType,
  RegisterWizardStepMeta,
  RegistrationCollateralSource,
  RegistrationFeeSource,
  RegistrationKeySource,
  RegistrationServiceMode,
} from '@renderer/types/MasternodeRegistrationWizard'
import type { SegmentOption } from '@renderer/types/SegmentedControl'

export const REGISTER_WIZARD_STEPS: readonly RegisterWizardStepMeta[] = [
  { id: 'collateral', label: 'Type & Collateral' },
  { id: 'addresses', label: 'Addresses & Keys' },
  { id: 'network', label: 'Network & Platform' },
  { id: 'review', label: 'Review & Register' },
] as const

export const REGISTER_WIZARD_COLLATERAL_SOURCE_OPTIONS: SegmentOption<RegistrationCollateralSource>[] = [
  { value: 'wallet', label: 'Wallet UTXO' },
  { value: 'manual', label: 'Manual outpoint' },
]

export const REGISTER_WIZARD_FEE_SOURCE_OPTIONS: SegmentOption<RegistrationFeeSource>[] = [
  { value: 'auto', label: 'Automatic wallet coin' },
  { value: 'address', label: 'Specific address' },
]

export const REGISTER_WIZARD_OWNER_MODE_OPTIONS: SegmentOption<RegistrationKeySource>[] = [
  { value: 'wallet', label: 'Wallet DIP-9 key' },
  { value: 'external', label: 'Custom P2PKH address' },
]

export const REGISTER_WIZARD_VOTING_MODE_OPTIONS: SegmentOption<RegistrationKeySource>[] = [
  { value: 'wallet', label: 'Wallet DIP-9 key' },
  { value: 'external', label: 'External P2PKH address' },
]

export const REGISTER_WIZARD_OPERATOR_MODE_OPTIONS: SegmentOption<RegistrationKeySource>[] = [
  { value: 'wallet', label: 'Wallet BLS key' },
  { value: 'external', label: 'External BLS key' },
]

export const REGISTER_WIZARD_SERVICE_MODE_OPTIONS: SegmentOption<RegistrationServiceMode>[] = [
  { value: 'now', label: 'Assign IP:port now' },
  { value: 'later', label: 'Set later via Update service' },
]

export const OPERATOR_REWARD_PRESETS = ['0', '5', '10', '25'] as const

export const REGISTER_WIZARD_COPY = {
  pageTitle: 'Register masternode',
  pageSubtitle: 'Configure collateral, DIP-3 keys, payout addresses, and Core/Platform endpoints step by step.',
  backLabel: 'Back to Masternodes',
  cancel: 'Cancel',
  back: 'Back',
  continue: 'Continue',
  submit: 'Sign & register',
  submitting: 'Broadcasting ProRegTx…',
  regularTitle: 'Regular Masternode',
  regularAmount: '1,000 DASH',
  regularSummary: 'Core L1 services (InstantSend, ChainLocks) · 1× governance voting weight',
  evoTitle: 'Evonode',
  evoAmount: '4,000 DASH',
  evoSummary: 'Dash Core + Dash Platform / DAPI · 4× governance voting weight',
  collateralSourceLabel: 'Collateral source',
  manualTxidLabel: 'Collateral txid',
  manualTxidPlaceholder: '64 hex characters',
  manualVoutLabel: 'Output index',
  manualVoutPlaceholder: '0',
  manualOutpointMissingTitle: 'Outpoint not found in this wallet',
  manualOutpointMissingDescription: 'To sign the ProRegTx funding input automatically, the collateral coin must belong to the active wallet.',
  feeSourceLabel: 'Transaction fee source (fundAddress)',
  feeSourceAutoNote: 'Automatically selects non-collateral wallet coins to pay the ProRegTx mining fee.',
  feeSourceCustomNote: 'Specified for planning clarity; the active signer selects non-collateral UTXOs from this wallet on broadcast.',
  payoutHint: 'Receives the owner share of masternode block rewards.',
  ownerKeyLabel: 'Owner key address (ownerKeyAddr)',
  ownerWalletNote: 'Auto-derived at m/9\'/coin\'/3\'/1\'/index from this wallet’s seed. Required to sign future ProUpRegTx updates.',
  votingKeyLabel: 'Voting key address (votingKeyAddr)',
  votingWalletNote: 'Auto-derived at m/9\'/coin\'/3\'/2\'/index. Lets this wallet cast governance votes directly.',
  operatorKeyLabel: 'Operator BLS public key (operatorPubKey)',
  operatorWalletNote: 'Auto-derived BLS key at m/9\'/coin\'/3\'/3\'/index. Can also be rotated later with Update registrar.',
  operatorExternalPlaceholder: '96-character hex BLS public key',
  operatorRewardPresetsLabel: 'Presets:',
  operatorRewardHint: 'Basis points in ProRegTx (0.00% – 100.00%, i.e. 0 – 10,000 bps).',
  operatorPayoutHint: 'Optional in UI: DIP-3 locks the operator’s payout address when they broadcast ProUpServTx (Update service).',
  customKeysNoticeTitle: 'Initial ProRegTx uses wallet-derived DIP-9 keys',
  customKeysNoticeDescription: 'The built-in signer generates initial Owner, Voting and Operator keys from this wallet’s seed. Switch back to Wallet DIP-9 / BLS keys to broadcast now (you can delegate Voting or Operator afterward via Update registrar).',
  useWalletKeys: 'Use wallet keys',
  serviceModeLabel: 'Core P2P endpoint (ipAndPort)',
  serviceLaterNote: 'Registers with 0.0.0.0:0. Your masternode stays registered until the operator sets its IP:port with Update service.',
  serviceIpLabel: 'Public IPv4 address',
  serviceIpPlaceholder: 'e.g. 45.67.89.10 (or paste ip:port)',
  servicePortLabel: 'Core P2P port',
  mainnetPortHint: 'Mainnet Core masternodes must use port 9999 and platform ports 26656 / 443.',
  summaryCollateralSection: 'Type & Collateral',
  summaryAddressesSection: 'Addresses & Keys',
  summaryNetworkSection: 'Network & Platform',
  walletDerivedValue: 'Wallet DIP-9 derived',
  autoFeeSourceValue: 'Automatic wallet coin',
  doneHeadline: 'Masternode registration broadcast',
  doneDescription: 'ProRegTx has been relayed to peers and added to your Nodes list with status Registering while awaiting block confirmation.',
  viewNode: 'View node',
  backToMasternodes: 'Back to Masternodes',
  authorizeLabel: 'Authorize with wallet password',
  retryButton: 'Retry',
  resetForm: 'Reset form',
} as const

export const MASTERNODE_TYPE_CARDS: ReadonlyArray<{
  type: MasternodeType
  title: string
  amount: string
  summary: string
}> = [
  {
    type: REGULAR_MASTERNODE_TYPE as MasternodeType,
    title: REGISTER_WIZARD_COPY.regularTitle,
    amount: REGISTER_WIZARD_COPY.regularAmount,
    summary: REGISTER_WIZARD_COPY.regularSummary,
  },
  {
    type: EVO_MASTERNODE_TYPE as MasternodeType,
    title: REGISTER_WIZARD_COPY.evoTitle,
    amount: REGISTER_WIZARD_COPY.evoAmount,
    summary: REGISTER_WIZARD_COPY.evoSummary,
  },
]
