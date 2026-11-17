import { HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import { ChevronIcon, CopyIcon2, ExternalLinkIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import ContextMenu from '@renderer/components/ui/ContextMenu'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import StatusPill from '@renderer/components/ui/StatusPill'
import { NODE_DETAIL_COPY, NODE_ROW_COPY } from '@renderer/constants/masternodeNodes'
import { MASTERNODE_TABLE_GRID } from '@renderer/constants/masternodes'
import { SECTION_TABLE_ROW } from '@renderer/constants/sectionTable'
import { formatServiceAddress, isSharedNode, masternodeStatus, masternodeType, nodeAccessDisplay } from '@renderer/utils/masternodeNodes'
import type { NodeTableRowProps } from '@renderer/types/MasternodeNodes'

export default function NodeTableRow({ node, onOpen }: NodeTableRowProps): React.JSX.Element {
  const status = masternodeStatus(node.status)
  const access = nodeAccessDisplay(node)

  return (
    <ContextMenu
      title={NODE_ROW_COPY.menuTitle}
      items={[
        {
          id: 'open',
          label: NODE_ROW_COPY.open,
          icon: <ExternalLinkIcon size={10} color={'currentColor'} />,
          onSelect: () => onOpen(node.proTxHash),
        },
        {
          id: 'copy',
          label: NODE_ROW_COPY.copy,
          icon: <CopyIcon2 size={10} color={'currentColor'} />,
          onSelect: () => { void navigator.clipboard.writeText(node.proTxHash) },
        },
      ]}
    >
      <button type={'button'} onClick={() => onOpen(node.proTxHash)} className={`${SECTION_TABLE_ROW} ${MASTERNODE_TABLE_GRID}`}>
        <div className={'flex min-w-0 flex-col gap-1'}>
          <div className={'flex min-w-0 items-center gap-2'}>
            <Text size={14} weight={'medium'} color={'brand'} className={'truncate'}>{formatServiceAddress(node.serviceAddress)}</Text>
            <CustomBadge {...masternodeType(node.type)} className={'shrink-0'} />
            {isSharedNode(node) && <CustomBadge variant={'default'} text={NODE_DETAIL_COPY.sharedBadge} className={'shrink-0'} />}
          </div>
          <HighlightedIdentifier className={'text-[.625rem]! opacity-70'}>{node.proTxHash}</HighlightedIdentifier>
        </div>
        <div className={'flex min-w-0'}>
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
        </div>
        <div className={'flex min-w-0 flex-col gap-0.5'}>
          <Text size={14} weight={'medium'} color={'brand'} className={'truncate'}>{access.primary}</Text>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'truncate'}>{access.secondary}</Text>
        </div>
        <ChevronIcon size={12} color={'currentColor'} className={'-rotate-90 justify-self-end dash-text-default opacity-50'} />
      </button>
    </ContextMenu>
  )
}
