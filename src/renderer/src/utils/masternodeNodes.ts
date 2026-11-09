import type { MasternodeDto } from '@renderer/api/types'
import { NODE_DETAIL_COPY, SUMMARY_COPY } from '@renderer/constants/masternodeNodes'
import {
  ENABLED_MASTERNODE_STATUS,
  EVO_MASTERNODE_TYPE,
  MASTERNODE_STATUS_PILLS,
  NODE_SEGMENT_LABELS,
  REGULAR_MASTERNODE_TYPE,
} from '@renderer/constants/masternodes'
import { NodeSegment } from '@renderer/enums/Masternodes'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { CustomBadgeProps } from '@renderer/types/CustomBadge'
import type { SegmentOption } from '@renderer/types/SegmentedControl'

export function nodeSegmentOptions(nodes: MasternodeDto[], query: string): SegmentOption<NodeSegment>[] {
  return Object.values(NodeSegment).map(value => ({
    value,
    label: `${NODE_SEGMENT_LABELS[value]}${SUMMARY_COPY.separator}${filterNodes(nodes, query, value).length}`,
  }))
}

export function filterNodes(nodes: MasternodeDto[], query: string, segment: NodeSegment): MasternodeDto[] {
  const needle = query.trim().toLowerCase()
  return nodes.filter(node => {
    if (![node.proTxHash, node.serviceAddress].some(value => value.toLowerCase().includes(needle))) return false
    switch (segment) {
      case NodeSegment.VotingKey: return node.votingKeyIndex != null
      case NodeSegment.NoVotingKey: return node.votingKeyIndex == null
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
