import { useState } from 'react'
import { Button, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import {
  BoxIcon,
  CalendarIconHighlighted,
  CheckIcon,
  DocumentIcon,
  EditIcon,
  KeyIcon,
  ServerIcon,
  TurnOffIcon,
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
import { MasternodeDetailModal } from '@renderer/enums/Masternodes'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { refreshMasternodes, useMasternodes } from '@renderer/hooks/useMasternodes'
import {
  formatBlockHeight,
  formatServiceAddress,
  keyOriginBadge,
  masternodeStatus,
  masternodeType,
  nodeVotingAccessLabel,
} from '@renderer/utils/masternodeNodes'
import type { NodeDetailProps } from '@renderer/types/MasternodeScreens'
import RevokeMasternodeModal from './RevokeMasternodeModal'
import UpdateRegistrarModal from './UpdateRegistrarModal'
import UpdateServiceModal from './UpdateServiceModal'

export default function NodeDetail({ walletId, proTxHash, onBack }: NodeDetailProps): React.JSX.Element {
  const { nodes, loading, err } = useMasternodes(walletId)
  const [activeModal, setActiveModal] = useState<MasternodeDetailModal | null>(null)
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
  const canUpdateRegistrar = node.ownerKeyIndex != null
  const canOperate = node.operatorKeyIndex != null
  const ownerBadge = keyOriginBadge(node, 'owner')
  const votingBadge = keyOriginBadge(node, 'voting')
  const operatorBadge = keyOriginBadge(node, 'operator')

  const lastPaidText = node.lastPaidBlock == null
    ? NODE_DETAIL_COPY.pendingIndex
    : node.lastPaidBlock <= 0
      ? NODE_DETAIL_COPY.neverPaid
      : formatBlockHeight(node.lastPaidBlock)

  return (
    <>
      <PageHeader
        title={formatServiceAddress(node.serviceAddress)}
        onBack={onBack}
        backLabel={PAGE_HEADERS.masternodeDetail.back}
        titleAddon={(
          <>
            <CustomBadge {...typeBadge} className={'shrink-0'} />
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
          </>
        )}
        actions={(
          <div className={'flex flex-wrap items-center gap-2'}>
            <Button
              type={'button'}
              size={'compact'}
              colorScheme={'primary-light'}
              disabled={!canUpdateRegistrar}
              title={canUpdateRegistrar ? undefined : NODE_DETAIL_COPY.ownerKeyRequired}
              onClick={() => setActiveModal(MasternodeDetailModal.UpdateRegistrar)}
              className={'inline-flex items-center gap-1.5 rounded-[.75rem]'}
            >
              <EditIcon size={12} color={'currentColor'} />
              {NODE_DETAIL_COPY.updateRegistrar}
            </Button>
            <Button
              type={'button'}
              size={'compact'}
              colorScheme={'primary-light'}
              disabled={!canOperate}
              title={canOperate ? undefined : NODE_DETAIL_COPY.operatorKeyRequired}
              onClick={() => setActiveModal(MasternodeDetailModal.UpdateService)}
              className={'inline-flex items-center gap-1.5 rounded-[.75rem]'}
            >
              <WebIcon size={12} color={'currentColor'} />
              {NODE_DETAIL_COPY.updateService}
            </Button>
            <Button
              type={'button'}
              size={'compact'}
              colorScheme={'danger-light'}
              disabled={!canOperate}
              title={canOperate ? undefined : NODE_DETAIL_COPY.operatorKeyRequired}
              onClick={() => setActiveModal(MasternodeDetailModal.Revoke)}
              className={'inline-flex items-center gap-1.5 rounded-[.75rem]'}
            >
              <TurnOffIcon size={12} color={'currentColor'} />
              {NODE_DETAIL_COPY.revoke}
            </Button>
          </div>
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
              {node.payeeAddress != null ? (
                <>
                  <HighlightedIdentifier className={'min-w-0 font-medium!'}>{node.payeeAddress}</HighlightedIdentifier>
                  <CopyButton text={node.payeeAddress} className={'shrink-0'} />
                </>
              ) : (
                <Text size={14} weight={'medium'} color={'brand'} opacity={50}>{NODE_DETAIL_COPY.pendingIndex}</Text>
              )}
            </div>
            <div className={NODE_DETAIL_ROW_CLASS}>
              <span className={ICON_CHIP}><KeyIcon size={14} color={'currentColor'} /></span>
              <Text size={14} weight={'medium'} color={'brand'} className={'shrink-0'}>{NODE_DETAIL_COPY.ownerAddress}</Text>
              <CustomBadge {...ownerBadge} className={'shrink-0'} />
              {node.ownerAddress != null ? (
                <>
                  <HighlightedIdentifier className={'min-w-0 font-medium!'}>{node.ownerAddress}</HighlightedIdentifier>
                  <CopyButton text={node.ownerAddress} className={'shrink-0'} />
                </>
              ) : (
                <Text size={14} weight={'medium'} color={'brand'} opacity={50}>{NODE_DETAIL_COPY.pendingIndex}</Text>
              )}
            </div>
            <div className={NODE_DETAIL_ROW_CLASS}>
              <span className={ICON_CHIP}><KeyIcon size={14} color={'currentColor'} /></span>
              <Text size={14} weight={'medium'} color={'brand'} className={'shrink-0'}>{NODE_DETAIL_COPY.votingAddress}</Text>
              <CustomBadge {...votingBadge} className={'shrink-0'} />
              <HighlightedIdentifier className={'min-w-0 font-medium!'}>{node.votingAddress}</HighlightedIdentifier>
              <CopyButton text={node.votingAddress} className={'shrink-0'} />
            </div>
            <div className={NODE_DETAIL_ROW_CLASS}>
              <span className={ICON_CHIP}><KeyIcon size={14} color={'currentColor'} /></span>
              <Text size={14} weight={'medium'} color={'brand'} className={'shrink-0'}>{NODE_DETAIL_COPY.operatorPublicKey}</Text>
              <CustomBadge {...operatorBadge} className={'shrink-0'} />
              <HighlightedIdentifier className={'min-w-0 font-medium!'}>{node.operatorPublicKey}</HighlightedIdentifier>
              <CopyButton text={node.operatorPublicKey} className={'shrink-0'} />
            </div>
            {node.type === 'Evo' && node.platformNodeId != null && (
              <div className={NODE_DETAIL_ROW_CLASS}>
                <span className={ICON_CHIP}><ServerIcon size={14} color={'currentColor'} /></span>
                <Text size={14} weight={'medium'} color={'brand'} className={'shrink-0'}>{NODE_DETAIL_COPY.platformNodeId}</Text>
                <HighlightedIdentifier className={'min-w-0 font-medium!'}>{node.platformNodeId}</HighlightedIdentifier>
                <CopyButton text={node.platformNodeId} className={'shrink-0'} />
              </div>
            )}
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
              subValue={node.posePenaltyScore != null ? `${NODE_DETAIL_COPY.pose} ${node.posePenaltyScore}` : undefined}
            />
            <DetailToken
              icon={<WebIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.service}
              value={<Text size={14} weight={'medium'} color={'brand'} className={'tabular-nums'}>{formatServiceAddress(node.serviceAddress)}</Text>}
            />
            <DetailToken
              icon={<KeyIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.votingKey}
              value={<Text size={14} weight={'medium'} color={'brand'}>{nodeVotingAccessLabel(node)}</Text>}
            />
            <DetailToken
              icon={<BoxIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.collateral}
              value={node.collateralAddress != null ? (
                <HighlightedIdentifier className={'min-w-0 font-medium!'}>{node.collateralAddress}</HighlightedIdentifier>
              ) : (
                <Text size={14} weight={'medium'} color={'brand'} opacity={50}>{NODE_DETAIL_COPY.pendingIndex}</Text>
              )}
              subValue={node.collateralTxid != null && node.collateralVout != null
                ? `${node.collateralTxid.slice(0, 10)}…:${node.collateralVout}`
                : undefined}
            />
            <DetailToken
              icon={<CalendarIconHighlighted size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.lastPaid}
              value={(
                <Text size={14} weight={'medium'} color={'brand'} className={'tabular-nums'}>
                  {lastPaidText}
                </Text>
              )}
              subValue={node.registeredHeight != null
                ? `${NODE_DETAIL_COPY.registeredHeight} ${formatBlockHeight(node.registeredHeight)}`
                : undefined}
            />
            {node.type === 'Evo' && node.platformP2PPort != null && node.platformHttpPort != null && (
              <DetailToken
                icon={<WebIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
                label={NODE_DETAIL_COPY.platformPorts}
                value={(
                  <Text size={14} weight={'medium'} color={'brand'} className={'tabular-nums'}>
                    {`${node.platformP2PPort} / ${node.platformHttpPort}`}
                  </Text>
                )}
              />
            )}
          </div>
        </div>
      </div>

      {activeModal === MasternodeDetailModal.UpdateRegistrar && (
        <UpdateRegistrarModal
          walletId={walletId}
          node={node}
          open
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === MasternodeDetailModal.UpdateService && (
        <UpdateServiceModal
          walletId={walletId}
          node={node}
          open
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === MasternodeDetailModal.Revoke && (
        <RevokeMasternodeModal
          walletId={walletId}
          node={node}
          open
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  )
}
