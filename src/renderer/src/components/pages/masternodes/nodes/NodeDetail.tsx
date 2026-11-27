import { useMemo, useState, type ReactNode } from 'react'
import { Button, DeleteIcon, HighlightedIdentifier, Text, Tooltip } from '@renderer/components/dash-ui-kit-extended'
import {
  BoxIcon,
  CalendarIconHighlighted,
  CheckIcon,
  ContactsIcon,
  DocumentIcon,
  EditIcon,
  InfoCircleIcon,
  KeyIcon,
  ServerIcon,
  SignIcon,
  TurnOffIcon,
  WalletIcon,
  WebIcon,
} from '@renderer/components/dash-ui-kit-extended/icons'
import DetailToken from '@renderer/components/pages/transactions/TransactionDetailToken'
import Alert from '@renderer/components/ui/Alert'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'
import PageHeader from '@renderer/components/ui/PageHeader'
import RetryButton from '@renderer/components/ui/RetryButton'
import StatusPill from '@renderer/components/ui/StatusPill'
import { EVO_MASTERNODE_TYPE, REGISTERING_MASTERNODE_STATUS } from '@renderer/constants/masternodes'
import { NODE_DETAIL_COPY, NODE_DETAIL_ICON_CLASS, NODE_DETAIL_ROW_CLASS, REMOVE_IMPORTED_KEYS_COPY } from '@renderer/constants/masternodeNodes'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { ICON_CHIP, SURFACE_PANEL } from '@renderer/constants/surfaces'
import { TRANSACTION_DETAIL_CARD_CLASS } from '@renderer/constants/transactionsPage'
import { AlertTone } from '@renderer/enums/AlertTone'
import { MasternodeDetailModal } from '@renderer/enums/Masternodes'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { refreshMasternodes, useImportedMasternodeKeys, useMasternodes } from '@renderer/hooks/useMasternodes'
import type { CustomBadgeProps } from '@renderer/types/CustomBadge'
import type { NodeDetailProps } from '@renderer/types/MasternodeScreens'
import {
  canRevokeNode,
  canUpdateNodeRegistrar,
  canUpdateNodeService,
  formatBlockHeight,
  formatServiceAddress,
  isSharedNode,
  keyOriginBadge,
  masternodeChainBadge,
  masternodeStatus,
  masternodeType,
  nodeImportedKeys,
  nodeVotingAccessLabel,
  revokeNodeDisabledReason,
  shortProTxHash,
  updateRegistrarDisabledReason,
  updateServiceDisabledReason,
} from '@renderer/utils/masternodeNodes'
import NodeSharesCard from './NodeSharesCard'
import RemoveImportedKeysModal from './RemoveImportedKeysModal'
import RevokeMasternodeModal from './RevokeMasternodeModal'
import UpdateRegistrarModal from './UpdateRegistrarModal'
import UpdateServiceModal from './UpdateServiceModal'

export default function NodeDetail({ walletId, proTxHash, onBack }: NodeDetailProps): React.JSX.Element {
  const { nodes, discovered, loading, err } = useMasternodes(walletId)
  const { importedKeys } = useImportedMasternodeKeys(walletId)
  const [activeModal, setActiveModal] = useState<MasternodeDetailModal | null>(null)
  const node = nodes.find(candidate => candidate.proTxHash === proTxHash) ?? null
  const matchedImportedKeys = useMemo(
    () => (node == null ? [] : nodeImportedKeys(node, importedKeys)),
    [node, importedKeys],
  )

  if (node === null) {
    return (
      <div className={'pt-2'}>
        <PageHeader title={NODE_DETAIL_COPY.typeTitle} onBack={onBack} backLabel={PAGE_HEADERS.masternodeDetail.back} />
        {loading && !discovered ? (
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

  const shared = isSharedNode(node)
  const pendingRegistration = node.status === REGISTERING_MASTERNODE_STATUS
  const status = masternodeStatus(node.status)
  const typeBadge = masternodeType(node.type)
  const chainBadge = masternodeChainBadge(node.type)
  const isEvo = node.type === EVO_MASTERNODE_TYPE
  const serviceLabel = formatServiceAddress(node.serviceAddress)
  const canUpdateRegistrar = canUpdateNodeRegistrar(node)
  const registrarDisabledReason = updateRegistrarDisabledReason(node)
  const canUpdateService = canUpdateNodeService(node)
  const serviceDisabledReason = updateServiceDisabledReason(node)
  const canRevoke = canRevokeNode(node)
  const revokeDisabledReason = revokeNodeDisabledReason(node)

  const identifierRows: {
    key: string
    icon: ReactNode
    label: string
    badge?: Pick<CustomBadgeProps, 'variant' | 'text'>
    value: string | null
    fallback?: string
  }[] = [
    {
      key: 'proTxHash',
      icon: <DocumentIcon size={14} color={'currentColor'} />,
      label: NODE_DETAIL_COPY.proTxHash,
      value: node.proTxHash,
    },
    {
      key: 'payout',
      icon: <WalletIcon size={14} color={'currentColor'} />,
      label: NODE_DETAIL_COPY.payoutAddress,
      value: node.payeeAddress,
      fallback: shared ? NODE_DETAIL_COPY.sharedPayoutValue : NODE_DETAIL_COPY.pendingIndex,
    },
    ...(!shared ? [{
      key: 'owner',
      icon: <ContactsIcon size={14} color={'currentColor'} />,
      label: NODE_DETAIL_COPY.ownerAddress,
      badge: pendingRegistration ? undefined : keyOriginBadge(node, 'owner'),
      value: node.ownerAddress,
      fallback: NODE_DETAIL_COPY.pendingIndex,
    }] : []),
    {
      key: 'voting',
      icon: <SignIcon size={14} color={'currentColor'} />,
      label: NODE_DETAIL_COPY.votingAddress,
      badge: pendingRegistration ? undefined : keyOriginBadge(node, 'voting'),
      value: node.votingAddress || null,
      fallback: NODE_DETAIL_COPY.pendingIndex,
    },
    {
      key: 'operator',
      icon: <KeyIcon size={14} color={'currentColor'} />,
      label: NODE_DETAIL_COPY.operatorPublicKey,
      badge: pendingRegistration ? undefined : keyOriginBadge(node, 'operator'),
      value: node.operatorPublicKey || null,
      fallback: NODE_DETAIL_COPY.pendingIndex,
    },
    ...(isEvo && node.platformNodeId != null ? [{
      key: 'platformNodeId',
      icon: <ServerIcon size={14} color={'currentColor'} />,
      label: NODE_DETAIL_COPY.platformNodeId,
      value: node.platformNodeId,
    }] : []),
  ]

  const lastPaidValue = node.lastPaidBlock == null
    ? NODE_DETAIL_COPY.unavailable
    : node.lastPaidBlock <= 0
      ? NODE_DETAIL_COPY.neverPaid
      : formatBlockHeight(node.lastPaidBlock)

  return (
    <>
      <PageHeader
        title={shortProTxHash(node.proTxHash)}
        subtitle={serviceLabel}
        onBack={onBack}
        backLabel={PAGE_HEADERS.masternodeDetail.back}
        titleAddon={(
          <>
            <Tooltip label={chainBadge.label}>
              <span className={'inline-flex shrink-0'} title={''}>
                <CustomBadge text={chainBadge.text} size={'s'} className={`w-11 shrink-0 ${chainBadge.className}`} />
              </span>
            </Tooltip>
            {shared && <CustomBadge variant={'default'} text={NODE_DETAIL_COPY.sharedBadge} className={'shrink-0'} />}
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
              title={registrarDisabledReason}
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
              disabled={!canUpdateService}
              title={serviceDisabledReason}
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
              disabled={!canRevoke}
              title={revokeDisabledReason}
              onClick={() => setActiveModal(MasternodeDetailModal.Revoke)}
              className={'inline-flex items-center gap-1.5 rounded-[.75rem]'}
            >
              <TurnOffIcon size={12} color={'currentColor'} />
              {NODE_DETAIL_COPY.revoke}
            </Button>
            {matchedImportedKeys.length > 0 && (
              <Button
                type={'button'}
                size={'compact'}
                colorScheme={'danger-light'}
                onClick={() => setActiveModal(MasternodeDetailModal.RemoveImportedKeys)}
                className={'inline-flex items-center gap-1.5 rounded-[.75rem]'}
              >
                <DeleteIcon size={12} color={'currentColor'} />
                {matchedImportedKeys.length > 1 ? REMOVE_IMPORTED_KEYS_COPY.triggerPlural : REMOVE_IMPORTED_KEYS_COPY.triggerSingle}
              </Button>
            )}
          </div>
        )}
      />

      <div className={'flex flex-col gap-4'}>
        {pendingRegistration && (
          <Alert
            tone={AlertTone.Info}
            icon={<InfoCircleIcon size={16} color={'currentColor'} />}
            title={NODE_DETAIL_COPY.pendingRegistrationNoticeTitle}
            description={NODE_DETAIL_COPY.pendingRegistrationNoticeDescription}
          />
        )}
        <div className={TRANSACTION_DETAIL_CARD_CLASS}>
          <div className={'flex flex-col gap-3'}>
            {identifierRows.map(row => (
              <div key={row.key} className={NODE_DETAIL_ROW_CLASS}>
                <span className={ICON_CHIP}>{row.icon}</span>
                <Text size={14} weight={'medium'} color={'brand'} className={'shrink-0'}>{row.label}</Text>
                {row.badge && <CustomBadge {...row.badge} className={'shrink-0'} />}
                {row.value != null ? (
                  <>
                    <HighlightedIdentifier className={'min-w-0 font-medium!'}>{row.value}</HighlightedIdentifier>
                    <CopyButton text={row.value} className={'shrink-0'} />
                  </>
                ) : (
                  <Text size={14} weight={'medium'} color={'brand'} opacity={50}>{row.fallback}</Text>
                )}
              </div>
            ))}
          </div>
          <div className={'grid grid-cols-1 lg:grid-cols-2 gap-3'}>
            <DetailToken
              icon={<ServerIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.type}
              value={<Text size={14} weight={'extrabold'} color={'brand'}>{typeBadge.text}</Text>}
              subValue={shared ? NODE_DETAIL_COPY.sharedRegistration : NODE_DETAIL_COPY.soloRegistration}
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
              value={<Text size={14} weight={'medium'} color={'brand'} className={'tabular-nums'}>{serviceLabel}</Text>}
              subValue={isEvo && node.platformP2PPort != null && node.platformHttpPort != null
                ? `${NODE_DETAIL_COPY.platformPorts} ${node.platformP2PPort} / ${node.platformHttpPort}`
                : undefined}
            />
            <DetailToken
              icon={<KeyIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.votingKey}
              value={<Text size={14} weight={'medium'} color={'brand'}>{pendingRegistration ? NODE_DETAIL_COPY.pendingIndex : nodeVotingAccessLabel(node)}</Text>}
            />
            <DetailToken
              icon={<BoxIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.collateral}
              value={node.collateralAddress != null
                ? <HighlightedIdentifier className={'min-w-0 font-medium!'}>{node.collateralAddress}</HighlightedIdentifier>
                : <Text size={14} weight={'medium'} color={'brand'} opacity={50}>{NODE_DETAIL_COPY.pendingIndex}</Text>}
              subValue={node.collateralTxid != null && node.collateralVout != null
                ? `${node.collateralTxid.slice(0, 10)}…:${node.collateralVout}`
                : undefined}
            />
            <DetailToken
              icon={<CalendarIconHighlighted size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
              label={NODE_DETAIL_COPY.lastPaid}
              value={(
                <Text size={14} weight={'medium'} color={'brand'} className={'tabular-nums'}>
                  {lastPaidValue}
                </Text>
              )}
              subValue={node.registeredHeight != null
                ? `${NODE_DETAIL_COPY.registeredHeight} ${formatBlockHeight(node.registeredHeight)}`
                : undefined}
            />
          </div>
        </div>
        {shared && <NodeSharesCard node={node} />}
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
      {activeModal === MasternodeDetailModal.RemoveImportedKeys && matchedImportedKeys.length > 0 && (
        <RemoveImportedKeysModal
          walletId={walletId}
          node={node}
          matchedKeys={matchedImportedKeys}
          open
          onClose={() => setActiveModal(null)}
          onNodeRemoved={onBack}
        />
      )}
    </>
  )
}
