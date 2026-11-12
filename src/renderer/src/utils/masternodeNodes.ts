import type { MasternodeDto, MasternodeKeyRole } from '@renderer/api/types'
import { MASTERNODE_KEY_ROLE_LABELS, NODE_DETAIL_COPY, SUMMARY_COPY } from '@renderer/constants/masternodeNodes'
import {
  ENABLED_MASTERNODE_STATUS,
  EVO_MASTERNODE_TYPE,
  MASTERNODE_STATUS_PILLS,
  NODE_SEGMENT_LABELS,
  REGULAR_MASTERNODE_TYPE,
  UNASSIGNED_SERVICE_ADDRESS,
} from '@renderer/constants/masternodes'
import { NodeSegment } from '@renderer/enums/Masternodes'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { CustomBadgeProps } from '@renderer/types/CustomBadge'
import type { SegmentOption } from '@renderer/types/SegmentedControl'

export function hasVotingKey(node: MasternodeDto): boolean {
  return node.votingKeyIndex != null || node.importedRoles.includes('voting')
}

export function hasRoleInWallet(node: MasternodeDto, role: MasternodeKeyRole): boolean {
  const index = role === 'owner' ? node.ownerKeyIndex : role === 'voting' ? node.votingKeyIndex : node.operatorKeyIndex
  return index != null || node.importedRoles.includes(role)
}

export function nodeWalletRoles(node: MasternodeDto): MasternodeKeyRole[] {
  const roles: MasternodeKeyRole[] = ['owner', 'operator', 'voting']
  return roles.filter(role => hasRoleInWallet(node, role))
}

export function nodeRolesLabel(node: MasternodeDto): string {
  const roles = nodeWalletRoles(node)
  if (roles.length === 0) return NODE_DETAIL_COPY.votingKeyMissing
  return roles.map(role => MASTERNODE_KEY_ROLE_LABELS[role]).join(SUMMARY_COPY.separator)
}

export function nodeVotingAccessLabel(node: MasternodeDto): string {
  if (node.votingKeyIndex != null) return NODE_DETAIL_COPY.votingKeyStored
  if (node.importedRoles.includes('voting')) return NODE_DETAIL_COPY.votingKeyImported
  return NODE_DETAIL_COPY.votingKeyMissing
}

export function keyOriginBadge(node: MasternodeDto, role: MasternodeKeyRole): Pick<CustomBadgeProps, 'variant' | 'text'> {
  const keyIndex = role === 'owner' ? node.ownerKeyIndex : role === 'voting' ? node.votingKeyIndex : node.operatorKeyIndex
  if (keyIndex != null) return { variant: 'accent', text: NODE_DETAIL_COPY.walletKeyBadge }
  if (node.importedRoles.includes(role)) return { variant: 'accent', text: NODE_DETAIL_COPY.importedKeyBadge }
  return { variant: 'muted', text: NODE_DETAIL_COPY.externalKeyBadge }
}

export function formatServiceAddress(serviceAddress: string | null): string {
  if (serviceAddress == null || serviceAddress.trim() === '' || serviceAddress === UNASSIGNED_SERVICE_ADDRESS) {
    return NODE_DETAIL_COPY.unassignedService
  }
  return serviceAddress
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
    if (![node.proTxHash, node.serviceAddress ?? ''].some(value => value.toLowerCase().includes(needle))) return false
    switch (segment) {
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
