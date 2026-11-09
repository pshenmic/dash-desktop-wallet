import { HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import { ChevronIcon, CopyIcon2, ExternalLinkIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import ContextMenu from '@renderer/components/ui/ContextMenu'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import StatusPill from '@renderer/components/ui/StatusPill'
import { NODE_DETAIL_COPY, NODE_ROW_COPY } from '@renderer/constants/masternodeNodes'
import { MASTERNODE_TABLE_GRID } from '@renderer/constants/masternodes'
import { SECTION_TABLE_ROW } from '@renderer/constants/sectionTable'
import { copyWithToast } from '@renderer/utils/clipboard'
import { masternodeStatus, masternodeType } from '@renderer/utils/masternodeNodes'
import type { NodeTableRowProps } from '@renderer/types/MasternodeNodes'

export default function NodeTableRow({ node, onOpen }: NodeTableRowProps): React.JSX.Element {
  const status = masternodeStatus(node.status)
  const access = node.votingKeyIndex == null ? NODE_DETAIL_COPY.votingKeyMissing : NODE_DETAIL_COPY.votingKeyStored

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
          onSelect: () => copyWithToast(node.proTxHash),
        },
      ]}
    >
      <button type={'button'} onClick={() => onOpen(node.proTxHash)} className={`${SECTION_TABLE_ROW} ${MASTERNODE_TABLE_GRID}`}>
        <div className={'flex min-w-0 flex-col gap-1'}>
          <div className={'flex min-w-0 items-center gap-2'}>
            <Text size={14} weight={'medium'} color={'brand'} className={'truncate'}>{node.serviceAddress}</Text>
            <CustomBadge {...masternodeType(node.type)} className={'shrink-0'} />
          </div>
          <HighlightedIdentifier className={'text-[.625rem]! opacity-70'}>{node.proTxHash}</HighlightedIdentifier>
        </div>
        <div className={'flex min-w-0'}>
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
        </div>
        <Text size={14} weight={'medium'} color={'brand'} className={'truncate'}>{access}</Text>
        <ChevronIcon size={12} color={'currentColor'} className={'-rotate-90 justify-self-end dash-text-default opacity-50'} />
      </button>
    </ContextMenu>
  )
}
