import type { MasternodeKeyRole, RevocationReason } from '@renderer/api/types'
import { NodeSegment, PayoutChoiceKind, RegistrarKeyChoiceKind } from '@renderer/enums/Masternodes'
import type { SegmentOption } from '@renderer/types/SegmentedControl'

export const MASTERNODE_META_SEPARATOR = ' · '

export const NODES_TAB_COPY = {
  searchPlaceholder: 'ProTxHash, service or owner address',
  searchLabel: 'Search nodes',
  segmentsLabel: 'Node filter',
  emptyTitle: 'No masternodes discovered',
  emptyDescription: 'Masternodes and shared masternode shares linked to this wallet’s keys or collateral appear here after discovery.',
  rpcEmptyDescription: 'Masternodes linked to this wallet appear here after discovery. Shared masternode shares held only by an owner key require P2P mode.',
  p2pSyncing: 'Waiting for the network masternode list to sync…',
  p2pDiscovery: 'Waiting for the network masternode list or no masternodes linked to this wallet yet.',
  rpcSharedTitle: 'Shared masternode shares require P2P mode',
  rpcSharedDescription: 'RPC mode only lists shared nodes whose voting or operator key is in this wallet, without share amounts or participant addresses.',
  switchToP2P: 'Switch to P2P',
  noMatch: 'No nodes match',
  clearSearch: 'Clear search',
  registerButton: 'Register masternode',
  importedKeysButton: 'Imported keys',
} as const

export const NODE_TABLE_COLUMNS = ['Node', 'Status', 'Roles & Stake'] as const

export const NODE_SEGMENT_EMPTY: Record<NodeSegment, string> = {
  [NodeSegment.All]: 'No nodes',
  [NodeSegment.Shared]: 'No shared masternodes in this wallet',
  [NodeSegment.VotingKey]: 'No nodes with a voting key in this wallet',
  [NodeSegment.NoVotingKey]: 'All discovered nodes have a voting key in this wallet',
  [NodeSegment.Issues]: 'No issues',
}

export const NODE_ROW_COPY = {
  menuTitle: 'Node',
  open: 'Open',
  copy: 'Copy ProTxHash',
} as const

export const NODE_DETAIL_COPY = {
  typeTitle: 'Masternode',
  proTxHash: 'ProTxHash',
  type: 'Type',
  status: 'Status',
  service: 'Service',
  unassignedService: 'Unassigned',
  pendingIndex: 'Pending index',
  unavailable: '—',
  votingKey: 'Voting key',
  votingKeyStored: 'In this wallet',
  votingKeyImported: 'Imported key',
  votingKeyMissing: 'Outside this wallet',
  lastPaid: 'Last paid block',
  registeredHeight: 'Registered block',
  neverPaid: 'Never',
  payoutAddress: 'Payout address',
  sharedPayoutValue: 'Distributed per share',
  ownerAddress: 'Owner address',
  votingAddress: 'Voting address',
  operatorPublicKey: 'Operator public key',
  collateral: 'Collateral',
  collateralOutpoint: 'Collateral outpoint',
  platformNodeId: 'Platform Node ID',
  platformPorts: 'Platform ports',
  pose: 'PoSe',
  heightPrefix: '#',
  unknownNode: 'This node hasn’t been discovered in this wallet',
  back: 'Back',
  sharedBadge: 'Shared',
  sharedRegistration: 'Shared collateral',
  soloRegistration: 'Solo collateral',
  updateRegistrar: 'Update registrar',
  updateService: 'Update service',
  revoke: 'Revoke',
  ownerKeyRequired: 'Owner key is not derived by this wallet',
  operatorKeyRequired: 'Operator key is not derived by this wallet',
  sharedUpdateRegistrarUnsupported: 'Registrar updates on a shared masternode require every share owner to sign',
  sharedOperatorUnsupported: 'Operator actions are not supported for shared masternodes yet',
  walletKeyBadge: 'Wallet key',
  importedKeyBadge: 'Imported',
  externalKeyBadge: 'External',
} as const

export const NODE_DETAIL_ROW_CLASS = 'flex min-w-0 items-center gap-[.625rem]'
export const NODE_DETAIL_ICON_CLASS = 'dash-text-primary'

export const NODE_SHARES_FORMS = { one: 'share', other: 'shares' } as const

export const NODE_SHARES_COPY = {
  title: 'Collateral shares',
  yourStake: 'Your stake',
  totalCollateral: 'Total collateral',
  noOwnedShares: 'No shares held in this wallet',
  ofShares: 'of',
  sharedCollateral: 'Shared collateral',
  rpcSharesUnavailable: 'Individual share amounts and owner addresses are indexed from the on-chain registration in P2P connection mode.',
  p2pSharesPending: 'Indexing the on-chain registration to load share owners and collateral amounts…',
} as const

export const MASTERNODE_KEY_ROLE_LABELS: Record<MasternodeKeyRole, string> = {
  owner: 'Owner',
  voting: 'Voting',
  operator: 'Operator',
}

export const MASTERNODE_KEY_ROLE_HINTS: Record<MasternodeKeyRole, string> = {
  owner: 'WIF private key (solo or shared share owner)',
  voting: 'WIF private key (voting address)',
  operator: 'BLS secret key (64 hex characters)',
}

export const MASTERNODE_KEY_ROLE_OPTIONS: SegmentOption<MasternodeKeyRole>[] = [
  { value: 'owner', label: MASTERNODE_KEY_ROLE_LABELS.owner },
  { value: 'voting', label: MASTERNODE_KEY_ROLE_LABELS.voting },
  { value: 'operator', label: MASTERNODE_KEY_ROLE_LABELS.operator },
]

export const NODE_MATCHED_FORMS = { one: 'node matched', other: 'nodes matched' } as const

export const MANAGE_KEYS_COPY = {
  title: 'Imported masternode keys',
  description: 'Import an external owner, share-owner, voting or operator private key to track its masternodes in this wallet.',
  roleLabel: 'Key role',
  rpcOwnerNoticeTitle: 'Share-owner keys match in P2P mode',
  rpcOwnerNoticeDescription: 'In RPC mode, an imported share-owner key is saved to this wallet and matches its shared masternodes once switched to P2P.',
  privateKeyLabel: 'Private key',
  importButton: 'Import key',
  importing: 'Importing…',
  importedTitle: 'Imported keys',
  noImportedKeys: 'No external masternode keys imported yet.',
  remove: 'Remove',
  close: 'Done',
  keyImportedNotice: 'Masternode key imported',
  keySavedForP2PNotice: 'Masternode key saved — switch to P2P to match shared masternode shares',
  keyRemovedNotice: 'Masternode key removed',
} as const

export const REGISTER_MASTERNODE_COPY = {
  title: 'Register masternode',
  description: 'Register a Regular masternode (1,000 DASH) or Evonode (4,000 DASH) with keys derived by this wallet.',
  typeLabel: 'Masternode type',
  regularOption: 'Regular · 1,000 DASH',
  evoOption: 'Evonode · 4,000 DASH',
  collateralLabel: 'Collateral UTXO',
  noCollateralUtxos: 'No confirmed unspent coin of the required collateral amount is available in this wallet.',
  payoutLabel: 'Payout address',
  payoutPlaceholder: 'Core address for block rewards',
  pickWalletAddress: 'Use wallet address',
  serviceLabel: 'Service address (optional)',
  servicePlaceholder: 'IPv4:port (leave empty to set later via service update)',
  operatorRewardLabel: 'Operator reward (%)',
  operatorRewardPlaceholder: '0 – 100 (e.g. 0 or 5.5)',
  platformNodeIdLabel: 'Platform Node ID',
  platformNodeIdPlaceholder: '40 hex characters (Tenderdash node ID)',
  platformP2PPortLabel: 'Platform P2P port',
  platformHttpPortLabel: 'Platform HTTP port',
  review: 'Review registration',
  confirm: 'Register masternode',
  pending: 'Broadcasting ProRegTx…',
  doneHeadline: 'Masternode registered',
  proTxHashLabel: 'ProTxHash',
  networkFee: 'Network fee',
  peersAcked: 'Peers acknowledged',
} as const

export const REGISTER_MASTERNODE_TYPE_OPTIONS: Array<{ value: 'Regular' | 'Evo'; label: string }> = [
  { value: 'Regular', label: REGISTER_MASTERNODE_COPY.regularOption },
  { value: 'Evo', label: REGISTER_MASTERNODE_COPY.evoOption },
]

export const REGISTRAR_KEY_CHOICE_OPTIONS: SegmentOption<RegistrarKeyChoiceKind>[] = [
  { value: RegistrarKeyChoiceKind.Keep, label: 'Keep current' },
  { value: RegistrarKeyChoiceKind.Wallet, label: 'Use wallet key' },
  { value: RegistrarKeyChoiceKind.External, label: 'External' },
]

export const PAYOUT_CHOICE_OPTIONS: SegmentOption<PayoutChoiceKind>[] = [
  { value: PayoutChoiceKind.Keep, label: 'Keep current' },
  { value: PayoutChoiceKind.Custom, label: 'New address' },
]

export const UPDATE_REGISTRAR_COPY = {
  title: 'Update registrar (ProUpRegTx)',
  description: 'Signed with the masternode’s owner key. Updates payout address, operator key or voting key.',
  payoutSection: 'Payout address',
  payoutPlaceholder: 'New Core payout address',
  operatorSection: 'Operator key',
  operatorPlaceholder: '96-character hex BLS public key',
  operatorBanWarningTitle: 'Operator key change causes PoSe ban',
  operatorBanWarning: 'Assigning a new operator key PoSe-bans the masternode until the new operator broadcasts a ProUpServTx.',
  votingSection: 'Voting key',
  votingPlaceholder: 'External P2PKH voting address',
  review: 'Review update',
  confirm: 'Sign & broadcast',
  pending: 'Broadcasting ProUpRegTx…',
  doneHeadline: 'Registrar updated',
  txidLabel: 'Transaction ID',
} as const

export const UPDATE_SERVICE_COPY = {
  title: 'Update service (ProUpServTx)',
  description: 'Signed with the masternode’s operator BLS key. Restates the IP:port and platform endpoints.',
  serviceLabel: 'Service address (IPv4:port)',
  servicePlaceholder: 'e.g. 203.0.113.10:9999',
  operatorPayoutLabel: 'Operator payout address (optional)',
  operatorPayoutPlaceholder: 'Leave empty unless node has an operator reward',
  review: 'Review service update',
  confirm: 'Sign & broadcast',
  pending: 'Broadcasting ProUpServTx…',
  doneHeadline: 'Service updated',
  txidLabel: 'Transaction ID',
} as const

export const REVOCATION_REASON_OPTIONS: Array<{ value: RevocationReason; label: string }> = [
  { value: 'notSpecified', label: 'Not specified' },
  { value: 'termination', label: 'Termination of service' },
  { value: 'compromisedKeys', label: 'Compromised keys' },
  { value: 'changeOfKeys', label: 'Change of keys' },
]

export const REVOKE_MASTERNODE_COPY = {
  title: 'Revoke operator (ProUpRevTx)',
  description: 'Signed with the masternode’s operator key to terminate service.',
  warningTitle: 'Revoking PoSe-bans this masternode',
  warningDescription: 'This resets the service address and PoSe-bans the node. Only the owner can restore it with a registrar update (ProUpRegTx) assigning a new operator key.',
  reasonLabel: 'Revocation reason',
  review: 'Review revocation',
  confirm: 'Revoke masternode',
  pending: 'Broadcasting ProUpRevTx…',
  doneHeadline: 'Operator revoked',
  txidLabel: 'Transaction ID',
} as const
