import { Button, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import {
  BoxIcon,
  CalendarIconHighlighted,
  CheckIcon,
  DocumentIcon,
  KeyIcon,
  ServerIcon,
  WalletIcon,
  WebIcon,
} from '@renderer/components/dash-ui-kit-extended/icons'
import DetailToken from '@renderer/components/pages/transactions/TransactionDetailToken'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'
import PageHeader from '@renderer/components/ui/PageHeader'
import RetryButton from '@renderer/components/ui/RetryButton'
import StatusPill from '@renderer/components/ui/StatusPill'
import { NODE_DETAIL_COPY, NODE_DETAIL_ICON_CLASS, NODE_DETAIL_ROW_CLASS } from '@renderer/constants/masternodeNodes'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { ICON_CHIP, SURFACE_PANEL } from '@renderer/constants/surfaces'
import { TRANSACTION_DETAIL_CARD_CLASS } from '@renderer/constants/transactionsPage'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { refreshMasternodes, useMasternodes } from '@renderer/hooks/useMasternodes'
import { formatBlockHeight, masternodeStatus, masternodeType } from '@renderer/utils/masternodeNodes'
import type { NodeDetailProps } from '@renderer/types/MasternodeScreens'

export default function NodeDetail({ walletId, proTxHash, onBack }: NodeDetailProps): React.JSX.Element {
  const { nodes, loading, err } = useMasternodes(walletId)
  const node = nodes.find(candidate => candidate.proTxHash === proTxHash) ?? null

  if (node === null) {
    return (
      <div className={'pt-2'}>
        <PageHeader title={NODE_DETAIL_COPY.typeTitle} onBack={onBack} backLabel={PAGE_HEADERS.masternodeDetail.back} />
        {loading ? (
          <ListSkeleton rows={3} rowClassName={'h-[4.25rem] rounded-[.875rem]'} />
        ) : (
          <div className={SURFACE_PANEL}>
            <NoResults
              tone={err == null ? undefined : NoResultsTone.Error}
              noResults={err ?? NODE_DETAIL_COPY.unknownNode}
              action={err == null
                ? <Button type={'button'} size={'compact'} colorScheme={'primary-light'} onClick={onBack}>{NODE_DETAIL_COPY.back}</Button>
                : <RetryButton onRetry={() => refreshMasternodes(walletId)} />}
            />
          </div>
        )}
      </div>
    )
  }

  const status = masternodeStatus(node.status)
  const typeBadge = masternodeType(node.type)

  return (
    <>
      <PageHeader
        title={node.serviceAddress}
        onBack={onBack}
        backLabel={PAGE_HEADERS.masternodeDetail.back}
        titleAddon={(
          <>
            <CustomBadge {...typeBadge} className={'shrink-0'} />
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
          </>
        )}
      />

      <div className={'flex flex-col gap-4'}>
        <div className={TRANSACTION_DETAIL_CARD_CLASS}>
          <div className={'flex flex-col gap-3'}>
            <div className={NODE_DETAIL_ROW_CLASS}>
              <span className={ICON_CHIP}><DocumentIcon size={14} color={'currentColor'} /></span>
              <Text size={14} weight={'medium'} color={'brand'} className={'shrink-0'}>{NODE_DETAIL_COPY.proTxHash}</Text>
              <HighlightedIdentifier className={'min-w-0 font-medium!'}>{node.proTxHash}</HighlightedIdentifier>
              <CopyButton text={node.proTxHash} className={'shrink-0'} />
            </div>
            <div className={NODE_DETAIL_ROW_CLASS}>
              <span className={ICON_CHIP}><WalletIcon size={14} color={'currentColor'} /></span>
              <Text size={14} weight={'medium'} color={'brand'} className={'shrink-0'}>{NODE_DETAIL_COPY.payoutAddress}</Text>
              <HighlightedIdentifier className={'min-w-0 font-medium!'}>{node.payeeAddress}</HighlightedIdentifier>
              <CopyButton text={node.payeeAddress} className={'shrink-0'} />
            </div>
          </div>
          <div className={'grid grid-cols-1 lg:grid-cols-2 gap-3'}>
            <DetailToken
              icon={<ServerIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.type}
              value={<Text size={14} weight={'extrabold'} color={'brand'}>{typeBadge.text}</Text>}
            />
            <DetailToken
              icon={<CheckIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.status}
              value={<Text size={14} weight={'extrabold'} color={'brand'}>{status.label}</Text>}
              subValue={`${NODE_DETAIL_COPY.pose} ${node.posePenaltyScore}`}
            />
            <DetailToken
              icon={<WebIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.service}
              value={<Text size={14} weight={'medium'} color={'brand'} className={'tabular-nums'}>{node.serviceAddress}</Text>}
            />
            <DetailToken
              icon={<KeyIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.votingKey}
              value={<Text size={14} weight={'medium'} color={'brand'}>{node.votingKeyIndex == null ? NODE_DETAIL_COPY.votingKeyMissing : NODE_DETAIL_COPY.votingKeyStored}</Text>}
            />
            <DetailToken
              icon={<BoxIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.collateral}
              value={<HighlightedIdentifier className={'min-w-0 font-medium!'}>{node.collateralAddress}</HighlightedIdentifier>}
            />
            <DetailToken
              icon={<CalendarIconHighlighted size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.lastPaid}
              value={(
                <Text size={14} weight={'medium'} color={'brand'} className={'tabular-nums'}>
                  {node.lastPaidBlock <= 0 ? NODE_DETAIL_COPY.neverPaid : formatBlockHeight(node.lastPaidBlock)}
                </Text>
              )}
            />
          </div>
        </div>
      </div>
    </>
  )
}
