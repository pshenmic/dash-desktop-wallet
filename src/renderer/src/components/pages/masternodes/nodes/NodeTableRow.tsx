import { HighlightedIdentifier, Text, Tooltip } from '@renderer/components/dash-ui-kit-extended'
import { ChevronIcon, CopyIcon2, ExternalLinkIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import ContextMenu from '@renderer/components/ui/ContextMenu'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import StatusPill from '@renderer/components/ui/StatusPill'
import { NODE_DETAIL_COPY, NODE_ROW_COPY } from '@renderer/constants/masternodeNodes'
import { MASTERNODE_TABLE_GRID } from '@renderer/constants/masternodes'
import { SECTION_TABLE_ROW } from '@renderer/constants/sectionTable'
import { formatServiceAddress, isSharedNode, masternodeChainBadge, masternodeStatus, nodeAccessDisplay } from '@renderer/utils/masternodeNodes'
import type { NodeTableRowProps } from '@renderer/types/MasternodeNodes'

export default function NodeTableRow({ node, onOpen }: NodeTableRowProps): React.JSX.Element {
  const status = masternodeStatus(node.status)
  const chainBadge = masternodeChainBadge(node.type)
  const access = nodeAccessDisplay(node)
  const shared = isSharedNode(node)

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
      <div className={`relative ${SECTION_TABLE_ROW} ${MASTERNODE_TABLE_GRID}`}>
        <button
          type={'button'}
          onClick={() => onOpen(node.proTxHash)}
          aria-label={`${NODE_ROW_COPY.open} ${node.proTxHash}`}
          className={'absolute inset-0 cursor-pointer outline-none focus-visible:bg-dash-primary-dark-blue/4 dark:focus-visible:bg-white/5'}
        />
        <div className={'pointer-events-none flex min-w-0 flex-col gap-1'}>
          <div className={'flex min-w-0 items-start gap-2'}>
            <Tooltip label={chainBadge.label}>
              <span
                className={'pointer-events-auto relative z-10 inline-flex shrink-0 mt-0.5 cursor-pointer'}
                title={''}
                onClick={() => onOpen(node.proTxHash)}
              >
                <CustomBadge text={chainBadge.text} size={'s'} className={`w-11 shrink-0 ${chainBadge.className}`} />
              </span>
            </Tooltip>
            <HighlightedIdentifier className={'min-w-0 max-w-[32ch] break-all font-mono text-xs! leading-[1.15rem]! font-medium!'}>
              {node.proTxHash}
            </HighlightedIdentifier>
            <span className={'pointer-events-auto relative z-10 mt-0.5 shrink-0'}>
              <CopyButton text={node.proTxHash} label={NODE_ROW_COPY.copy} />
            </span>
          </div>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'truncate tabular-nums'}>
            {formatServiceAddress(node.serviceAddress)}
          </Text>
        </div>
        <div className={'pointer-events-none flex min-w-0 items-center'}>
          <CustomBadge
            variant={shared ? 'accent' : 'muted'}
            size={'xs'}
            text={shared ? NODE_DETAIL_COPY.sharedBadge : NODE_DETAIL_COPY.soloBadge}
            className={'shrink-0'}
          />
        </div>
        <div className={'pointer-events-none flex min-w-0'}>
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
        </div>
        <div className={'pointer-events-none flex min-w-0 flex-col gap-0.5'}>
          <Text size={14} weight={'medium'} color={'brand'} className={'truncate'}>{access.primary}</Text>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'truncate'}>{access.secondary}</Text>
        </div>
        <ChevronIcon size={12} color={'currentColor'} className={'pointer-events-none -rotate-90 justify-self-end dash-text-default opacity-50'} />
      </div>
    </ContextMenu>
  )
}
