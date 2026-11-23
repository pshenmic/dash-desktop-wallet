import { EVO_MASTERNODE_TYPE, REGULAR_MASTERNODE_TYPE } from '@renderer/constants/masternodes'
import type {
  MasternodeType,
  MasternodeTypeCardMeta,
  RegisterWizardStepMeta,
  RegistrationKeySource,
  RegistrationServiceMode,
  ResolvedRegistrationCollateralSource,
} from '@renderer/types/MasternodeRegistrationWizard'
import type { SegmentOption } from '@renderer/types/SegmentedControl'

export const REGISTER_WIZARD_STEPS: readonly RegisterWizardStepMeta[] = [
  { id: 'type', label: 'Node Type' },
  { id: 'collateral', label: 'Prepare Wallet' },
  { id: 'addresses', label: 'Addresses & Keys' },
  { id: 'network', label: 'Network' },
  { id: 'review', label: 'Review' },
] as const

export const REGISTER_WIZARD_COLLATERAL_SOURCE_OPTIONS: SegmentOption<ResolvedRegistrationCollateralSource>[] = [
  { value: 'prepare', label: 'Prepare wallet' },
  { value: 'wallet', label: 'Wallet UTXO' },
  { value: 'manual', label: 'Manual outpoint' },
]

export const REGISTER_WIZARD_OWNER_MODE_OPTIONS: SegmentOption<RegistrationKeySource>[] = [
  { value: 'wallet', label: 'Wallet DIP-9 key' },
  { value: 'external', label: 'Custom P2PKH address' },
]

export const REGISTER_WIZARD_PAYOUT_MODE_OPTIONS: SegmentOption<RegistrationKeySource>[] = [
  { value: 'wallet', label: 'Wallet receiving address' },
  { value: 'external', label: 'Custom address' },
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
  switchToPrepareButton: 'Prepare wallet',
  nodeTypeStepDescription: 'Choose the masternode tier before preparing collateral and configuring DIP-3 keys.',
  manualTxidLabel: 'Collateral txid',
  manualTxidPlaceholder: '64 hex characters',
  manualVoutLabel: 'Output index',
  manualVoutPlaceholder: '0',
  manualOutpointMissingTitle: 'Outpoint not found in this wallet',
  manualOutpointMissingDescription: 'To sign the ProRegTx funding input automatically, the collateral coin must belong to the active wallet.',
  feeSourceLabel: 'Transaction fee source',
  customFeesCheckboxLabel: 'Custom fees address',
  customFeesHint: 'Select a funded wallet P2PKH address with confirmed non-collateral coins to pay the ProRegTx fee and receive change.',
  customFeesInvalidAddress: 'Enter a valid wallet P2PKH fee source address.',
  customFeesNoEligibleCoins: 'No confirmed unlocked non-collateral coins are available on this address.',
  customFeesInsufficient: 'Confirmed coins on this address do not cover the ProRegTx network fee.',
  payoutKeyLabel: 'Payout address (payoutAddress)',
  payoutWalletNote: 'Uses an unused receiving address from this wallet (m/44\'/coin\'/0\'/0/index) to receive masternode block rewards.',
  payoutWalletEmpty: 'No wallet receiving address available yet. Switch to Custom address or create one in Receive.',
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
  previewLoadingLabel: 'Building ProRegTx preview…',
  previewErrorTitle: 'Cannot build ProRegTx preview',
  previewTransactionSection: 'Transaction & Fee Preview',
  feeInputsLabel: 'Fee inputs',
  changeOutputLabel: 'Change returned',
  unsignedHexSummary: 'Unsigned ProRegTx hex',
  unsignedHexLabel: 'Transaction hex',
  walletKeyIndexPrefix: 'Wallet #',
  customKeyBadge: 'Custom',
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
  apyLabel: 'Est. APY',
  collateralCardLabel: 'Collateral',
  votingCardLabel: 'Governance',
  apyDisclaimer: 'Estimated APY is an indicative placeholder and varies with active masternode count and network activity.',
} as const

export const MASTERNODE_TYPE_CARDS: ReadonlyArray<MasternodeTypeCardMeta> = [
  {
    type: REGULAR_MASTERNODE_TYPE as MasternodeType,
    title: REGISTER_WIZARD_COPY.regularTitle,
    amount: REGISTER_WIZARD_COPY.regularAmount,
    estimatedApy: '~6.5% APY',
    layerBadge: 'Core Layer',
    votingWeight: '1× DAO vote',
    summary: REGISTER_WIZARD_COPY.regularSummary,
    highlights: [
      'InstantSend & ChainLocks quorum rewards',
      'Standard IPv4:port Core setup',
    ],
  },
  {
    type: EVO_MASTERNODE_TYPE as MasternodeType,
    title: REGISTER_WIZARD_COPY.evoTitle,
    amount: REGISTER_WIZARD_COPY.evoAmount,
    estimatedApy: '~8.5% APY',
    layerBadge: 'Core + Platform',
    votingWeight: '4× DAO vote',
    summary: REGISTER_WIZARD_COPY.evoSummary,
    highlights: [
      'Core rewards + Dash Platform credit fees',
      'Requires Tenderdash P2P & HTTP ports',
    ],
  },
]
