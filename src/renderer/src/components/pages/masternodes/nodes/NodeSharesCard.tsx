import { Button, HighlightedIdentifier, InfoCircleIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import DashboardHeading from '@renderer/components/pages/dashboard/DashboardHeading'
import Alert from '@renderer/components/ui/Alert'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import { DASH_UNIT } from '@renderer/constants/balance'
import { MASTERNODE_META_SEPARATOR, NODE_SHARES_COPY, NODES_TAB_COPY } from '@renderer/constants/masternodeNodes'
import { SURFACE_ROW, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { TRANSACTION_DETAIL_CARD_CLASS } from '@renderer/constants/transactionsPage'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { AlertTone } from '@renderer/enums/AlertTone'
import type { NodeSharesCardProps } from '@renderer/types/MasternodeNodes'
import { davToDash } from '@renderer/utils/balance'
import {
  calculateShareSummary,
  formatSharePercent,
  shareOriginBadge,
  shareRatio,
} from '@renderer/utils/masternodeNodes'
import ShareBar from '../contested-resources/ShareBar'

export default function NodeSharesCard({ node }: NodeSharesCardProps): React.JSX.Element {
  const { desired, setDesired } = useConnectionModeContext()
  const summary = calculateShareSummary(node.shares)

  return (
    <section className={TRANSACTION_DETAIL_CARD_CLASS}>
      <div className={'flex flex-wrap items-center justify-between gap-3 px-1'}>
        <DashboardHeading>
          {summary != null ? `${NODE_SHARES_COPY.title}${MASTERNODE_META_SEPARATOR}${summary.totalCount}` : NODE_SHARES_COPY.title}
        </DashboardHeading>
        {summary != null && (
          summary.ownedDuffs > 0n ? (
            <Text size={12} weight={'medium'} color={'brand'} opacity={70} className={'tabular-nums'}>
              {`${NODE_SHARES_COPY.yourStake}: ${davToDash(summary.ownedDuffs)} / ${davToDash(summary.totalDuffs)} ${DASH_UNIT} (${formatSharePercent(summary.ownedRatio)})`}
            </Text>
          ) : (
            <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'tabular-nums'}>
              {`${NODE_SHARES_COPY.totalCollateral}: ${davToDash(summary.totalDuffs)} ${DASH_UNIT}${MASTERNODE_META_SEPARATOR}${NODE_SHARES_COPY.noOwnedShares}`}
            </Text>
          )
        )}
      </div>

      {summary != null && summary.ownedDuffs > 0n && <ShareBar share={summary.ownedRatio} />}

      {node.shares != null && node.shares.length > 0 && summary != null ? (
        <div className={'flex flex-col gap-1.5'}>
          {node.shares.map((share, index) => {
            const ratio = shareRatio(share.amountDuffs, summary.totalDuffs)
            return (
              <div key={`${share.ownerAddress}:${index}`} className={`flex flex-col gap-2 ${SURFACE_ROW}`}>
                <div className={'flex min-w-0 flex-wrap items-center justify-between gap-3'}>
                  <div className={'flex min-w-0 flex-1 items-center gap-2.5'}>
                    <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'shrink-0 tabular-nums'}>
                      {`#${index + 1}`}
                    </Text>
                    <CustomBadge {...shareOriginBadge(share)} className={'shrink-0'} />
                    <HighlightedIdentifier className={'min-w-0 font-medium!'}>{share.ownerAddress}</HighlightedIdentifier>
                    <CopyButton text={share.ownerAddress} className={'shrink-0'} />
                  </div>
                  <div className={'flex shrink-0 items-baseline gap-2'}>
                    <Text size={14} weight={'extrabold'} color={'brand'} className={'tabular-nums'}>
                      {`${davToDash(share.amountDuffs)} ${DASH_UNIT}`}
                    </Text>
                    <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'tabular-nums'}>
                      {formatSharePercent(ratio)}
                    </Text>
                  </div>
                </div>
                <ShareBar share={ratio} />
              </div>
            )
          })}
        </div>
      ) : desired === 'rpc' ? (
        <Alert
          tone={AlertTone.Info}
          icon={<InfoCircleIcon size={16} color={'currentColor'} />}
          title={NODES_TAB_COPY.rpcSharedTitle}
          description={NODE_SHARES_COPY.rpcSharesUnavailable}
          actions={(
            <Button
              type={'button'}
              size={'compact'}
              colorScheme={'lightBlue-mint'}
              onClick={() => setDesired('p2p')}
            >
              {NODES_TAB_COPY.switchToP2P}
            </Button>
          )}
        />
      ) : (
        <div className={SURFACE_SECTION}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
            {NODE_SHARES_COPY.p2pSharesPending}
          </Text>
        </div>
      )}
    </section>
  )
}
