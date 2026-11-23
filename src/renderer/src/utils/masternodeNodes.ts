import type { ConnectionType, ImportedMasternodeKeyDto, MasternodeDto, MasternodeKeyRole, OwnedMasternodeShareDto } from '@renderer/api/types'
import { DASH_UNIT } from '@renderer/constants/balance'
import {
  MANAGE_KEYS_COPY,
  MASTERNODE_CHAIN_BADGES,
  MASTERNODE_KEY_ROLE_LABELS,
  MASTERNODE_META_SEPARATOR,
  NODES_TAB_COPY,
  NODE_CARD_COPY,
  NODE_DETAIL_COPY,
  NODE_MATCHED_FORMS,
  NODE_SHARES_COPY,
  NODE_SHARES_FORMS,
} from '@renderer/constants/masternodeNodes'
import {
  ENABLED_MASTERNODE_STATUS,
  EVO_MASTERNODE_TYPE,
  MASTERNODE_STATUS_PILLS,
  NODE_SEGMENT_LABELS,
  REGISTERING_MASTERNODE_STATUS,
  REGULAR_MASTERNODE_TYPE,
  SHARE_BASIS_DIVISOR,
  SHARE_BASIS_POINTS,
  SHARE_PERCENT_SCALE,
  UNASSIGNED_SERVICE_ADDRESS,
} from '@renderer/constants/masternodes'
import { MasternodeViewMode, NodeSegment } from '@renderer/enums/Masternodes'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { CustomBadgeProps } from '@renderer/types/CustomBadge'
import type { MasternodeShareSummary, NodeAccessDisplay, NodeRoleOrigin, NodeRolePill } from '@renderer/types/MasternodeNodes'
import type { SegmentOption } from '@renderer/types/SegmentedControl'
import { davToDash } from './balance'
import { countLabel } from './countLabel'
import { blsLegacyHexFromBasicHex } from './masternodeBls'

const WALLET_ROLE_ORDER: readonly MasternodeKeyRole[] = ['owner', 'operator', 'voting']

function roleKeyIndex(node: MasternodeDto, role: MasternodeKeyRole): number | null {
  switch (role) {
    case 'owner': return node.ownerKeyIndex
    case 'voting': return node.votingKeyIndex
    case 'operator': return node.operatorKeyIndex
  }
}

export function isSharedNode(node: MasternodeDto): boolean {
  return node.isShared === true || (node.shares != null && node.shares.length > 0)
}

export function soloMasternodes(nodes: MasternodeDto[]): MasternodeDto[] {
  return nodes.filter(node => !isSharedNode(node))
}

export function sharedMasternodes(nodes: MasternodeDto[]): MasternodeDto[] {
  return nodes.filter(isSharedNode)
}

export function isOwnedShare(share: OwnedMasternodeShareDto): boolean {
  return share.keyIndex != null || share.imported
}

export function hasVotingKey(node: MasternodeDto): boolean {
  return node.votingKeyIndex != null || node.importedRoles.includes('voting')
}

export function hasSignableVotingKey(node: MasternodeDto): boolean {
  return node.votingKeyIndex != null || node.importedSigningRoles.includes('voting')
}

export function hasRoleInWallet(node: MasternodeDto, role: MasternodeKeyRole): boolean {
  if (roleKeyIndex(node, role) != null || node.importedRoles.includes(role)) return true
  return role === 'owner' && (node.shares?.some(isOwnedShare) ?? false)
}

export function nodeWalletRoles(node: MasternodeDto): MasternodeKeyRole[] {
  return WALLET_ROLE_ORDER.filter(role => hasRoleInWallet(node, role))
}

export function nodeRolesLabel(node: MasternodeDto): string {
  const roles = nodeWalletRoles(node)
  return roles.length > 0
    ? roles.map(role => MASTERNODE_KEY_ROLE_LABELS[role]).join(MASTERNODE_META_SEPARATOR)
    : NODE_DETAIL_COPY.collateral
}

export function nodeVotingAccessLabel(node: MasternodeDto): string {
  if (node.votingKeyIndex != null) return NODE_DETAIL_COPY.votingKeyStored
  if (node.importedSigningRoles.includes('voting')) return NODE_DETAIL_COPY.votingKeyImported
  if (node.importedRoles.includes('voting')) return NODE_DETAIL_COPY.votingKeyImportedWatchOnly
  return NODE_DETAIL_COPY.votingKeyMissing
}

export function keyOriginBadge(node: MasternodeDto, role: MasternodeKeyRole): Pick<CustomBadgeProps, 'variant' | 'text'> {
  if (roleKeyIndex(node, role) != null) return { variant: 'accent', text: NODE_DETAIL_COPY.walletKeyBadge }
  if (node.importedSigningRoles.includes(role)) return { variant: 'accent', text: NODE_DETAIL_COPY.importedKeyBadge }
  if (node.importedRoles.includes(role)) return { variant: 'muted', text: NODE_DETAIL_COPY.importedWatchOnlyBadge }
  return { variant: 'muted', text: NODE_DETAIL_COPY.externalKeyBadge }
}

export function shareOriginBadge(share: OwnedMasternodeShareDto): Pick<CustomBadgeProps, 'variant' | 'text'> {
  if (share.keyIndex != null) return { variant: 'accent', text: NODE_DETAIL_COPY.walletKeyBadge }
  if (share.imported) {
    return share.canSign
      ? { variant: 'accent', text: NODE_DETAIL_COPY.importedKeyBadge }
      : { variant: 'muted', text: NODE_DETAIL_COPY.importedWatchOnlyBadge }
  }
  return { variant: 'muted', text: NODE_DETAIL_COPY.externalKeyBadge }
}

export function shareRatio(amountDuffs: bigint, totalDuffs: bigint): number {
  return totalDuffs > 0n ? Number((amountDuffs * SHARE_BASIS_POINTS) / totalDuffs) / SHARE_BASIS_DIVISOR : 0
}

export function formatSharePercent(ratio: number): string {
  return `${Number((ratio * SHARE_PERCENT_SCALE).toFixed(2))}%`
}

export function calculateShareSummary(shares: OwnedMasternodeShareDto[] | null): MasternodeShareSummary | null {
  if (shares == null || shares.length === 0) return null
  let totalDuffs = 0n
  let ownedDuffs = 0n
  let ownedCount = 0
  for (const share of shares) {
    totalDuffs += share.amountDuffs
    if (isOwnedShare(share)) {
      ownedDuffs += share.amountDuffs
      ownedCount++
    }
  }
  return {
    totalDuffs,
    ownedDuffs,
    ownedCount,
    totalCount: shares.length,
    ownedRatio: shareRatio(ownedDuffs, totalDuffs),
  }
}

export function formatOwnedShareStake(summary: MasternodeShareSummary): string {
  return `${davToDash(summary.ownedDuffs)} / ${davToDash(summary.totalDuffs)} ${DASH_UNIT} (${formatSharePercent(summary.ownedRatio)})`
}

export function nodeAccessDisplay(node: MasternodeDto): NodeAccessDisplay {
  if (node.status === REGISTERING_MASTERNODE_STATUS) {
    return {
      primary: NODE_DETAIL_COPY.pendingRegistrationPrimary,
      secondary: NODE_DETAIL_COPY.pendingRegistrationSecondary,
    }
  }
  if (isSharedNode(node)) {
    const summary = calculateShareSummary(node.shares)
    if (summary != null && summary.ownedDuffs > 0n) {
      return {
        primary: formatOwnedShareStake(summary),
        secondary: `${summary.ownedCount} ${NODE_SHARES_COPY.ofShares} ${countLabel(summary.totalCount, NODE_SHARES_FORMS)}${hasVotingKey(node) ? `${MASTERNODE_META_SEPARATOR}${MASTERNODE_KEY_ROLE_LABELS.voting}` : ''}`,
      }
    }
    if (summary != null) {
      return {
        primary: nodeRolesLabel(node),
        secondary: `0 ${NODE_SHARES_COPY.ofShares} ${countLabel(summary.totalCount, NODE_SHARES_FORMS)}${MASTERNODE_META_SEPARATOR}${nodeVotingAccessLabel(node)}`,
      }
    }
    return {
      primary: nodeRolesLabel(node),
      secondary: `${NODE_SHARES_COPY.sharedCollateral}${MASTERNODE_META_SEPARATOR}${nodeVotingAccessLabel(node)}`,
    }
  }
  return {
    primary: nodeRolesLabel(node),
    secondary: nodeVotingAccessLabel(node),
  }
}

export function formatServiceAddress(serviceAddress: string | null): string {
  const trimmed = serviceAddress?.trim() ?? ''
  if (trimmed === '' || trimmed === UNASSIGNED_SERVICE_ADDRESS) return NODE_DETAIL_COPY.unassignedService
  return trimmed
}

export function nodeSegmentOptions(nodes: MasternodeDto[], query: string): SegmentOption<NodeSegment>[] {
  return Object.values(NodeSegment).map(value => ({
    value,
    label: `${NODE_SEGMENT_LABELS[value]}${MASTERNODE_META_SEPARATOR}${filterNodes(nodes, query, value).length}`,
  }))
}

export function filterNodes(nodes: MasternodeDto[], query: string, segment: NodeSegment = NodeSegment.All): MasternodeDto[] {
  const needle = query.trim().toLowerCase()
  return nodes.filter(node => {
    if (needle !== '') {
      const fields = [
        node.proTxHash,
        node.serviceAddress,
        node.ownerAddress,
        node.payeeAddress,
        node.collateralAddress,
        ...(node.shares?.map(share => share.ownerAddress) ?? []),
      ]
      if (!fields.some(value => value != null && value.toLowerCase().includes(needle))) return false
    }
    switch (segment) {
      case NodeSegment.VotingKey: return hasVotingKey(node)
      case NodeSegment.NoVotingKey: return !hasVotingKey(node)
      case NodeSegment.Banned: return node.status !== ENABLED_MASTERNODE_STATUS && node.status !== REGISTERING_MASTERNODE_STATUS
      default: return true
    }
  }).sort((a, b) => {
    const aPending = a.status === REGISTERING_MASTERNODE_STATUS ? 0 : 1
    const bPending = b.status === REGISTERING_MASTERNODE_STATUS ? 0 : 1
    if (aPending !== bPending) return aPending - bPending
    return a.proTxHash.localeCompare(b.proTxHash)
  })
}

export function masternodeStatus(status: string) {
  return MASTERNODE_STATUS_PILLS.get(status) ?? { tone: StatusPillTone.Inactive, label: status }
}

export function masternodeType(type: string): Pick<CustomBadgeProps, 'variant' | 'text'> {
  if (type === EVO_MASTERNODE_TYPE) return { variant: 'accent', text: 'Evonode' }
  return { variant: 'muted', text: type === REGULAR_MASTERNODE_TYPE ? 'Masternode' : type }
}

export function masternodeChainBadge(type: string) {
  return MASTERNODE_CHAIN_BADGES[type] ?? { text: type.toLowerCase(), label: type, className: '' }
}

export function shortProTxHash(proTxHash: string): string {
  return proTxHash.length > 20 ? `${proTxHash.slice(0, 10)}…${proTxHash.slice(-6)}` : proTxHash
}

export function formatBlockHeight(height: number): string {
  return `${NODE_DETAIL_COPY.heightPrefix}${height.toLocaleString('en-US')}`
}

export function emptyNodesDescription(connectionMode: ConnectionType, discovered: boolean): string {
  if (connectionMode === 'p2p' && !discovered) return NODES_TAB_COPY.p2pSyncing
  if (connectionMode === 'rpc') return NODES_TAB_COPY.rpcEmptyDescription
  return NODES_TAB_COPY.emptyDescription
}

export function importedKeyStatusMessage(matched: MasternodeDto[] | null, connectionMode: ConnectionType, role: MasternodeKeyRole): string {
  if (connectionMode === 'rpc' && role === 'owner' && matched != null && matched.length === 0) return MANAGE_KEYS_COPY.keySavedForP2PNotice
  if (matched == null) return MANAGE_KEYS_COPY.keyImportedNotice
  return `${MANAGE_KEYS_COPY.keyImportedNotice} (${countLabel(matched.length, NODE_MATCHED_FORMS)})`
}

export function canUpdateNodeRegistrar(node: MasternodeDto): boolean {
  return !isSharedNode(node) && node.ownerKeyIndex != null
}

export function updateRegistrarDisabledReason(node: MasternodeDto): string | undefined {
  if (canUpdateNodeRegistrar(node)) return undefined
  return isSharedNode(node) ? NODE_DETAIL_COPY.sharedUpdateRegistrarUnsupported : NODE_DETAIL_COPY.ownerKeyRequired
}

export function canUpdateNodeService(node: MasternodeDto): boolean {
  return node.operatorKeyIndex != null || node.importedSigningRoles.includes('operator')
}

export function updateServiceDisabledReason(node: MasternodeDto): string | undefined {
  return canUpdateNodeService(node) ? undefined : NODE_DETAIL_COPY.operatorKeyRequired
}

export function canRevokeNode(node: MasternodeDto): boolean {
  return !isSharedNode(node) && (node.operatorKeyIndex != null || node.importedSigningRoles.includes('operator'))
}

export function revokeNodeDisabledReason(node: MasternodeDto): string | undefined {
  if (canRevokeNode(node)) return undefined
  return isSharedNode(node) ? NODE_DETAIL_COPY.sharedRevokeUnsupported : NODE_DETAIL_COPY.operatorKeyRequired
}

export function nodeImportedKeys(
  node: MasternodeDto,
  importedKeys: ImportedMasternodeKeyDto[],
): ImportedMasternodeKeyDto[] {
  const operatorHex = node.operatorPublicKey.trim().toLowerCase()
  return importedKeys.filter((key) => {
    switch (key.role) {
      case 'owner':
        return node.ownerAddress === key.publicKey
          || (node.shares?.some(share => share.ownerAddress === key.publicKey) ?? false)
      case 'voting':
        return node.votingAddress === key.publicKey
      case 'operator': {
        const basicHex = key.publicKey.trim().toLowerCase()
        if (operatorHex === '' || basicHex === '') return false
        return operatorHex === basicHex || operatorHex === blsLegacyHexFromBasicHex(basicHex)
      }
    }
  })
}

export function parseMasternodeViewMode(raw: string | null | undefined): MasternodeViewMode {
  return raw === MasternodeViewMode.List ? MasternodeViewMode.List : MasternodeViewMode.Cards
}

export function nodeCustomLabel(
  node: MasternodeDto,
  labelsByAddress?: ReadonlyMap<string, string>,
): string | null {
  if (labelsByAddress == null || labelsByAddress.size === 0) return null
  const candidates = [
    node.collateralAddress,
    !isSharedNode(node) ? node.payeeAddress : null,
    ...(node.shares?.filter(isOwnedShare).map(share => share.ownerAddress) ?? []),
  ]
  for (const address of candidates) {
    if (address == null) continue
    const trimmed = labelsByAddress.get(address)?.trim() ?? ''
    if (trimmed !== '') return trimmed
  }
  return null
}

export function nodeCardTitle(
  node: MasternodeDto,
  labelsByAddress?: ReadonlyMap<string, string>,
): string {
  return nodeCustomLabel(node, labelsByAddress)
    ?? (node.type === EVO_MASTERNODE_TYPE ? NODE_CARD_COPY.evoTitle : NODE_CARD_COPY.regularTitle)
}

export function nodeCollateralDisplay(type: string): string {
  return type === EVO_MASTERNODE_TYPE ? NODE_CARD_COPY.evoCollateral : NODE_CARD_COPY.regularCollateral
}

export function nodeVotingWeightDisplay(type: string): string {
  return type === EVO_MASTERNODE_TYPE ? NODE_CARD_COPY.evoVotingWeight : NODE_CARD_COPY.regularVotingWeight
}

export function nodeLastPaidDisplay(node: MasternodeDto): string {
  if (node.status === REGISTERING_MASTERNODE_STATUS) return NODE_CARD_COPY.awaitingConfirmation
  if (node.lastPaidBlock == null) return NODE_DETAIL_COPY.unavailable
  if (node.lastPaidBlock <= 0) return NODE_CARD_COPY.neverPaid
  return formatBlockHeight(node.lastPaidBlock)
}

function resolveRoleOrigin(node: MasternodeDto, role: MasternodeKeyRole): NodeRoleOrigin {
  if (isSharedNode(node) && role === 'owner') {
    const ownedShares = node.shares?.filter(isOwnedShare) ?? []
    if (ownedShares.some(share => share.keyIndex != null)) return 'wallet'
    if (ownedShares.some(share => share.imported && share.canSign)) return 'imported'
    if (ownedShares.length > 0) return 'watch-only'
    return 'external'
  }
  if (roleKeyIndex(node, role) != null) return 'wallet'
  if (node.importedSigningRoles.includes(role)) return 'imported'
  if (node.importedRoles.includes(role)) return 'watch-only'
  return 'external'
}

function rolePillFromOrigin(role: MasternodeKeyRole, origin: NodeRoleOrigin): NodeRolePill {
  const label = MASTERNODE_KEY_ROLE_LABELS[role]
  switch (origin) {
    case 'wallet':
      return { role, label, origin, originLabel: NODE_CARD_COPY.walletOriginShort, inWallet: true, canSign: true }
    case 'imported':
      return { role, label, origin, originLabel: NODE_CARD_COPY.importedOriginShort, inWallet: true, canSign: true }
    case 'watch-only':
      return { role, label, origin, originLabel: NODE_CARD_COPY.watchOnlyOriginShort, inWallet: true, canSign: false }
    case 'external':
      return { role, label, origin, originLabel: NODE_CARD_COPY.externalOriginShort, inWallet: false, canSign: false }
  }
}

export function nodeRolePills(node: MasternodeDto): NodeRolePill[] {
  return WALLET_ROLE_ORDER.map(role => rolePillFromOrigin(role, resolveRoleOrigin(node, role)))
}
