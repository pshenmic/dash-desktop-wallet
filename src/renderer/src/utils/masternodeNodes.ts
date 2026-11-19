import type { ConnectionType, MasternodeDto, MasternodeKeyRole, OwnedMasternodeShareDto } from '@renderer/api/types'
import { DASH_UNIT } from '@renderer/constants/balance'
import {
  MANAGE_KEYS_COPY,
  MASTERNODE_KEY_ROLE_LABELS,
  NODES_TAB_COPY,
  NODE_DETAIL_COPY,
  NODE_MATCHED_FORMS,
  NODE_SHARES_COPY,
  NODE_SHARES_FORMS,
  SUMMARY_COPY,
} from '@renderer/constants/masternodeNodes'
import {
  ENABLED_MASTERNODE_STATUS,
  EVO_MASTERNODE_TYPE,
  MASTERNODE_STATUS_PILLS,
  NODE_SEGMENT_LABELS,
  REGULAR_MASTERNODE_TYPE,
  SHARE_BASIS_DIVISOR,
  SHARE_BASIS_POINTS,
  SHARE_PERCENT_SCALE,
  UNASSIGNED_SERVICE_ADDRESS,
} from '@renderer/constants/masternodes'
import { NodeSegment } from '@renderer/enums/Masternodes'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { CustomBadgeProps } from '@renderer/types/CustomBadge'
import type { MasternodeShareSummary, NodeAccessDisplay } from '@renderer/types/MasternodeNodes'
import type { SegmentOption } from '@renderer/types/SegmentedControl'
import { davToDash } from './balance'
import { countLabel } from './countLabel'

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

export function isOwnedShare(share: OwnedMasternodeShareDto): boolean {
  return share.keyIndex != null || share.imported
}

export function hasVotingKey(node: MasternodeDto): boolean {
  return node.votingKeyIndex != null || node.importedRoles.includes('voting')
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
    ? roles.map(role => MASTERNODE_KEY_ROLE_LABELS[role]).join(SUMMARY_COPY.separator)
    : NODE_DETAIL_COPY.collateral
}

export function nodeVotingAccessLabel(node: MasternodeDto): string {
  if (node.votingKeyIndex != null) return NODE_DETAIL_COPY.votingKeyStored
  if (node.importedRoles.includes('voting')) return NODE_DETAIL_COPY.votingKeyImported
  return NODE_DETAIL_COPY.votingKeyMissing
}

export function keyOriginBadge(node: MasternodeDto, role: MasternodeKeyRole): Pick<CustomBadgeProps, 'variant' | 'text'> {
  if (roleKeyIndex(node, role) != null) return { variant: 'accent', text: NODE_DETAIL_COPY.walletKeyBadge }
  if (node.importedRoles.includes(role)) return { variant: 'accent', text: NODE_DETAIL_COPY.importedKeyBadge }
  return { variant: 'muted', text: NODE_DETAIL_COPY.externalKeyBadge }
}

export function shareOriginBadge(share: OwnedMasternodeShareDto): Pick<CustomBadgeProps, 'variant' | 'text'> {
  if (share.keyIndex != null) return { variant: 'accent', text: NODE_DETAIL_COPY.walletKeyBadge }
  if (share.imported) return { variant: 'accent', text: NODE_DETAIL_COPY.importedKeyBadge }
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
  if (isSharedNode(node)) {
    const summary = calculateShareSummary(node.shares)
    if (summary != null && summary.ownedDuffs > 0n) {
      return {
        primary: formatOwnedShareStake(summary),
        secondary: `${summary.ownedCount} ${NODE_SHARES_COPY.ofShares} ${countLabel(summary.totalCount, NODE_SHARES_FORMS)}${hasVotingKey(node) ? `${SUMMARY_COPY.separator}${MASTERNODE_KEY_ROLE_LABELS.voting}` : ''}`,
      }
    }
    if (summary != null) {
      return {
        primary: nodeRolesLabel(node),
        secondary: `0 ${NODE_SHARES_COPY.ofShares} ${countLabel(summary.totalCount, NODE_SHARES_FORMS)}${SUMMARY_COPY.separator}${nodeVotingAccessLabel(node)}`,
      }
    }
    return {
      primary: nodeRolesLabel(node),
      secondary: `${NODE_SHARES_COPY.sharedCollateral}${SUMMARY_COPY.separator}${nodeVotingAccessLabel(node)}`,
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
    label: `${NODE_SEGMENT_LABELS[value]}${SUMMARY_COPY.separator}${filterNodes(nodes, query, value).length}`,
  }))
}

export function filterNodes(nodes: MasternodeDto[], query: string, segment: NodeSegment): MasternodeDto[] {
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
      case NodeSegment.Shared: return isSharedNode(node)
      case NodeSegment.VotingKey: return hasVotingKey(node)
      case NodeSegment.NoVotingKey: return !hasVotingKey(node)
      case NodeSegment.Issues: return node.status !== ENABLED_MASTERNODE_STATUS
      default: return true
    }
  }).sort((a, b) => a.proTxHash.localeCompare(b.proTxHash))
}

export function masternodeStatus(status: string) {
  return MASTERNODE_STATUS_PILLS.get(status) ?? { tone: StatusPillTone.Inactive, label: status }
}

export function masternodeType(type: string): Pick<CustomBadgeProps, 'variant' | 'text'> {
  if (type === EVO_MASTERNODE_TYPE) return { variant: 'accent', text: 'Evonode' }
  return { variant: 'muted', text: type === REGULAR_MASTERNODE_TYPE ? 'Masternode' : type }
}

export function formatBlockHeight(height: number): string {
  return `${NODE_DETAIL_COPY.heightPrefix}${height.toLocaleString('en-US')}`
}

export function emptyNodesDescription(connectionMode: ConnectionType, discovered: boolean): string {
  if (connectionMode === 'p2p' && !discovered) return NODES_TAB_COPY.p2pSyncing
  if (connectionMode === 'rpc') return NODES_TAB_COPY.rpcEmptyDescription
  return NODES_TAB_COPY.emptyDescription
}

export function importedKeyToastMessage(matched: MasternodeDto[] | null, connectionMode: ConnectionType, role: MasternodeKeyRole): string {
  if (connectionMode === 'rpc' && role === 'owner' && matched != null && matched.length === 0) return MANAGE_KEYS_COPY.keySavedForP2PToast
  if (matched == null) return MANAGE_KEYS_COPY.keyImportedToast
  return `${MANAGE_KEYS_COPY.keyImportedToast} (${countLabel(matched.length, NODE_MATCHED_FORMS)})`
}
