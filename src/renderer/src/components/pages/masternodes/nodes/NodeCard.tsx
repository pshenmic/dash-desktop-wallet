import {
  CreditsIcon,
  HighlightedIdentifier,
  Text,
  Tooltip,
} from '@renderer/components/dash-ui-kit-extended'
import {
  ChevronIcon,
  CopyIcon2,
  ExternalLinkIcon,
  ServerIcon,
} from '@renderer/components/dash-ui-kit-extended/icons'
import ContextMenu from '@renderer/components/ui/ContextMenu'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import ShareBar from '@renderer/components/ui/ShareBar'
import StatusPill from '@renderer/components/ui/StatusPill'
import { EVO_MASTERNODE_TYPE } from '@renderer/constants/masternodes'
import {
  MASTERNODE_META_SEPARATOR,
  NODE_CARD_COPY,
  NODE_DETAIL_COPY,
  NODE_ROW_COPY,
  NODE_SHARES_COPY,
  NODE_SHARES_FORMS,
} from '@renderer/constants/masternodeNodes'
import type { NodeCardProps, NodeRoleOrigin } from '@renderer/types/MasternodeNodes'
import {
  calculateShareSummary,
  formatOwnedShareStake,
  formatServiceAddress,
  isSharedNode,
  masternodeChainBadge,
  masternodeStatus,
  nodeCardTitle,
  nodeCollateralDisplay,
  nodeLastPaidDisplay,
  nodeRolePills,
  nodeVotingWeightDisplay,
  shortProTxHash,
} from '@renderer/utils/masternodeNodes'

function rolePillToneClass(origin: NodeRoleOrigin): string {
  switch (origin) {
    case 'wallet':
    case 'imported':
      return 'border-dash-brand/25 bg-dash-brand/10 text-dash-brand dark:border-dash-mint/25 dark:bg-dash-mint/10 dark:text-dash-mint'
    case 'watch-only':
      return 'border-dash-orange/30 bg-dash-orange/12 text-amber-700 dark:border-dash-orange/30 dark:bg-dash-orange/15 dark:text-dash-orange'
    case 'external':
      return 'border-dash-primary-dark-blue/10 bg-dash-primary-dark-blue/[0.04] text-dash-primary-dark-blue/50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/45'
  }
}

function roleDotToneClass(origin: NodeRoleOrigin): string {
  switch (origin) {
    case 'wallet':
    case 'imported':
      return 'bg-dash-brand dark:bg-dash-mint'
    case 'watch-only':
      return 'bg-amber-600 dark:bg-dash-orange'
    case 'external':
      return 'bg-current opacity-50'
  }
}

export default function NodeCard({ node, labelsByAddress, onOpen }: NodeCardProps): React.JSX.Element {
  const status = masternodeStatus(node.status)
  const chainBadge = masternodeChainBadge(node.type)
  const shared = isSharedNode(node)
  const isEvo = node.type === EVO_MASTERNODE_TYPE
  const title = nodeCardTitle(node, labelsByAddress)
  const summary = shared ? calculateShareSummary(node.shares) : null
  const rolePills = nodeRolePills(node)

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
      <div className={'relative flex flex-col justify-between gap-3 rounded-[.9375rem] border border-dash-primary-dark-blue/10 dark:border-white/10 dash-block-5 hover:border-dash-brand/50 dark:hover:border-dash-mint/50 hover:dash-block-accent-5 transition-colors p-4'}>
        <button
          type={'button'}
          onClick={() => onOpen(node.proTxHash)}
          aria-label={`${NODE_ROW_COPY.open} ${node.proTxHash}`}
          className={'absolute inset-0 cursor-pointer rounded-[.9375rem] outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/60 dark:focus-visible:ring-dash-mint/60'}
        />

        <div className={'pointer-events-none flex items-start justify-between gap-3'}>
          <div className={'flex min-w-0 flex-1 items-start gap-3'}>
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-[.75rem] border ${
                isEvo
                  ? 'border-violet-500/25 bg-violet-500/12 text-violet-700 dark:border-violet-400/25 dark:bg-violet-400/15 dark:text-violet-300'
                  : 'border-dash-brand/20 bg-dash-brand/10 text-dash-brand dark:border-dash-mint/20 dark:bg-dash-mint/10 dark:text-dash-mint'
              }`}
            >
              {isEvo ? <CreditsIcon size={16} color={'currentColor'} /> : <ServerIcon size={16} color={'currentColor'} />}
            </span>
            <div className={'flex min-w-0 flex-1 flex-col gap-1'}>
              <Text reset size={14} weight={'extrabold'} color={'brand'} className={'truncate'}>
                {title}
              </Text>
              <div className={'flex min-w-0 flex-wrap items-center gap-1.5'}>
                <Tooltip label={chainBadge.label}>
                  <span
                    className={'pointer-events-auto relative z-10 inline-flex shrink-0 cursor-pointer'}
                    title={''}
                    onClick={() => onOpen(node.proTxHash)}
                  >
                    <CustomBadge text={chainBadge.text} size={'s'} className={`w-11 shrink-0 ${chainBadge.className}`} />
                  </span>
                </Tooltip>
                {shared && (
                  <CustomBadge variant={'accent'} size={'xs'} text={NODE_DETAIL_COPY.sharedBadge} className={'shrink-0'} />
                )}
                <Text reset size={12} weight={'medium'} color={'brand'} opacity={50} className={'font-mono tabular-nums'}>
                  {shortProTxHash(node.proTxHash)}
                </Text>
                <span className={'pointer-events-auto relative z-10 inline-flex shrink-0'}>
                  <CopyButton text={node.proTxHash} label={NODE_ROW_COPY.copy} />
                </span>
              </div>
            </div>
          </div>

          <div className={'flex shrink-0 flex-col items-end gap-1'}>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
            {node.posePenaltyScore != null && node.posePenaltyScore > 0 && (
              <CustomBadge
                variant={'warning'}
                size={'xs'}
                text={`${NODE_CARD_COPY.posePenaltyPrefix} ${node.posePenaltyScore}`}
                className={'shrink-0 tabular-nums'}
              />
            )}
          </div>
        </div>

        <div className={'pointer-events-none grid grid-cols-2 gap-2.5'}>
          <div className={'flex min-w-0 flex-col gap-0.5'}>
            <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} transform={'uppercase'} className={'tracking-wider'}>
              {NODE_CARD_COPY.serviceLabel}
            </Text>
            <Text reset size={12} weight={'medium'} color={'brand'} className={'truncate tabular-nums'}>
              {formatServiceAddress(node.serviceAddress)}
            </Text>
            {node.platformP2PPort != null && node.platformHttpPort != null && (
              <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} className={'truncate tabular-nums'}>
                {`${NODE_DETAIL_COPY.platformPorts} /${node.platformP2PPort}/${node.platformHttpPort}`}
              </Text>
            )}
          </div>

          <div className={'flex min-w-0 flex-col gap-0.5'}>
            <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} transform={'uppercase'} className={'tracking-wider'}>
              {NODE_CARD_COPY.payoutLabel}
            </Text>
            {shared ? (
              <Text reset size={12} weight={'medium'} color={'brand'} opacity={80} className={'truncate'}>
                {NODE_DETAIL_COPY.sharedPayoutValue}
              </Text>
            ) : node.payeeAddress ? (
              <HighlightedIdentifier className={'min-w-0 font-mono text-xs! truncate [&>div]:truncate'}>
                {node.payeeAddress}
              </HighlightedIdentifier>
            ) : (
              <Text reset size={12} weight={'medium'} color={'brand'} opacity={50} className={'truncate'}>
                {NODE_DETAIL_COPY.pendingIndex}
              </Text>
            )}
          </div>
        </div>

        <div className={'pointer-events-none rounded-[.75rem] border border-dash-primary-dark-blue/[0.07] dark:border-white/[0.08] bg-dash-primary-dark-blue/[0.025] dark:bg-white/[0.03] px-3 py-2.5'}>
          {shared ? (
            <div className={'flex flex-col gap-2'}>
              <div className={'flex min-w-0 items-baseline justify-between gap-2'}>
                <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} transform={'uppercase'} className={'shrink-0 tracking-wider'}>
                  {NODE_CARD_COPY.yourStakeLabel}
                </Text>
                {summary != null && (
                  <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} className={'shrink-0 tabular-nums'}>
                    {`${summary.ownedCount}/${summary.totalCount} ${summary.totalCount === 1 ? NODE_SHARES_FORMS.one : NODE_SHARES_FORMS.other}`}
                  </Text>
                )}
              </div>
              <Text reset size={12} weight={'bold'} color={'brand'} className={'truncate tabular-nums'}>
                {summary != null && summary.ownedDuffs > 0n
                  ? formatOwnedShareStake(summary)
                  : NODE_SHARES_COPY.sharedCollateral}
              </Text>
              <ShareBar share={summary?.ownedRatio ?? 0} />
            </div>
          ) : (
            <div className={'grid grid-cols-3 gap-2.5'}>
              <div className={'flex min-w-0 flex-col gap-0.5'}>
                <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} transform={'uppercase'} className={'tracking-wider'}>
                  {NODE_CARD_COPY.collateralLabel}
                </Text>
                <Text reset size={12} weight={'bold'} color={'brand'} className={'truncate tabular-nums'}>
                  {nodeCollateralDisplay(node.type)}
                </Text>
              </div>
              <div className={'flex min-w-0 flex-col gap-0.5'}>
                <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} transform={'uppercase'} className={'tracking-wider'}>
                  {NODE_CARD_COPY.votingWeightLabel}
                </Text>
                <Text reset size={12} weight={'bold'} color={'brand'} className={'truncate tabular-nums'}>
                  {nodeVotingWeightDisplay(node.type)}
                </Text>
              </div>
              <div className={'flex min-w-0 flex-col gap-0.5'}>
                <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} transform={'uppercase'} className={'tracking-wider'}>
                  {NODE_CARD_COPY.lastPaidLabel}
                </Text>
                <Text reset size={12} weight={'bold'} color={'brand'} className={'truncate tabular-nums'}>
                  {nodeLastPaidDisplay(node)}
                </Text>
              </div>
            </div>
          )}
        </div>

        <div className={'pointer-events-none flex items-center justify-between gap-2'}>
          <div className={'flex min-w-0 flex-wrap items-center gap-1.5'} aria-label={NODE_CARD_COPY.rolesLabel}>
            {rolePills.map(pill => (
              <span
                key={pill.role}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${rolePillToneClass(pill.origin)}`}
              >
                <span aria-hidden={'true'} className={`size-1.5 shrink-0 rounded-full ${roleDotToneClass(pill.origin)}`} />
                <Text reset size={10} weight={'medium'} className={'whitespace-nowrap text-inherit!'}>
                  {`${pill.label}${MASTERNODE_META_SEPARATOR}${pill.originLabel}`}
                </Text>
              </span>
            ))}
          </div>
          <ChevronIcon size={12} color={'currentColor'} className={'shrink-0 -rotate-90 dash-text-default opacity-50'} />
        </div>
      </div>
    </ContextMenu>
  )
}
