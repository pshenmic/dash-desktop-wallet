import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, KeyIcon } from '@renderer/components/dash-ui-kit-extended'
import Alert from '@renderer/components/ui/Alert'
import PageHeader from '@renderer/components/ui/PageHeader'
import PageTabs from '@renderer/components/ui/PageTabs'
import { UNMATCHED_IMPORTED_KEYS_COPY } from '@renderer/constants/masternodeNodes'
import {
  MASTERNODE_PARAMS,
  MASTERNODES_HEADER_COPY,
  MASTERNODES_PAGE_SIZE,
  MASTERNODES_TAB_LABELS,
} from '@renderer/constants/masternodes'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { SURFACE_PANEL } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { AlertTone } from '@renderer/enums/AlertTone'
import { MasternodesTab } from '@renderer/enums/Masternodes'
import { prefetchAddresses } from '@renderer/hooks/useAdresses'
import { useDetailScrollRestore } from '@renderer/hooks/useDetailScrollRestore'
import { useUnmatchedImportedMasternodeKeys } from '@renderer/hooks/useMasternodes'
import { prefetchReceiveRequests } from '@renderer/hooks/useReceiveRequests'
import type { MasternodesNavigationState } from '@renderer/types/MasternodeNodes'
import type { MasternodesPageProps } from '@renderer/types/MasternodeScreens'
import { unmatchedImportedKeysTitle } from '@renderer/utils/masternodeNodes'
import { getOrCreateRegisterWizardState, setRegisterWizardActive } from '@renderer/utils/masternodeRegistrationDraft'
import { enumParam, withParams } from '@renderer/utils/searchParams'
import ManageMasternodeKeysModal from './nodes/ManageMasternodeKeysModal'
import NodeDetail from './nodes/NodeDetail'
import NodesTab from './nodes/NodesTab'
import RegisterMasternodeWizard from './nodes/RegisterMasternodeWizard'
import UnmatchedImportedKeysModal from './nodes/UnmatchedImportedKeysModal'
import ParticipateSharedWizard from './shared/ParticipateSharedWizard'
import SharedTab from './shared/SharedTab'

export default function MasternodesPage({ walletId }: MasternodesPageProps): React.JSX.Element {
  const { status } = useAuth()
  const network = status?.network ?? undefined
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [nodeQuery, setNodeQuery] = useState('')
  const [nodeVisibleCount, setNodeVisibleCount] = useState(MASTERNODES_PAGE_SIZE)
  const [sharedQuery, setSharedQuery] = useState('')
  const [sharedVisibleCount, setSharedVisibleCount] = useState(MASTERNODES_PAGE_SIZE)
  const [keysOpen, setKeysOpen] = useState(false)
  const [unmatchedOpen, setUnmatchedOpen] = useState(false)
  const { unmatchedKeys } = useUnmatchedImportedMasternodeKeys(walletId)
  const tab = enumParam(MasternodesTab, searchParams.get(MASTERNODE_PARAMS.tab), MasternodesTab.Nodes)
  const detail = searchParams.get(MASTERNODE_PARAMS.node)
  const persistedWizard = getOrCreateRegisterWizardState(walletId, network ?? null)
  const registering = tab === MasternodesTab.Nodes
    && detail == null
    && (searchParams.get(MASTERNODE_PARAMS.register) === '1'
      || (searchParams.get(MASTERNODE_PARAMS.tab) == null && persistedWizard.active))
  const participating = tab === MasternodesTab.Shared
    && detail == null
    && searchParams.get(MASTERNODE_PARAMS.participate) === '1'
  const saveListScroll = useDetailScrollRestore(detail ?? (registering ? 'register' : participating ? 'participate' : null))

  useEffect(() => {
    prefetchAddresses(walletId).catch(() => {})
    prefetchReceiveRequests(walletId).catch(() => {})
  }, [walletId])

  const selectTab = (next: MasternodesTab): void => {
    setNodeVisibleCount(MASTERNODES_PAGE_SIZE)
    setSharedVisibleCount(MASTERNODES_PAGE_SIZE)
    setSearchParams(prev => withParams(prev, {
      [MASTERNODE_PARAMS.tab]: next === MasternodesTab.Nodes ? null : next,
      [MASTERNODE_PARAMS.node]: null,
      [MASTERNODE_PARAMS.register]: null,
      [MASTERNODE_PARAMS.participate]: null,
    }), { replace: true })
  }

  const openDetail = (value: string): void => {
    saveListScroll()
    const state: MasternodesNavigationState = { fromList: true }
    setSearchParams(prev => withParams(prev, {
      [MASTERNODE_PARAMS.node]: value,
      [MASTERNODE_PARAMS.register]: null,
      [MASTERNODE_PARAMS.participate]: null,
    }), { state })
  }

  const closeDetail = (): void => {
    if ((location.state as MasternodesNavigationState | null)?.fromList === true) {
      navigate(-1)
      return
    }
    setSearchParams(prev => withParams(prev, { [MASTERNODE_PARAMS.node]: null }), { replace: true })
  }

  const openRegister = (): void => {
    saveListScroll()
    setRegisterWizardActive(walletId, network ?? null, true)
    const state: MasternodesNavigationState = { fromList: true }
    setSearchParams(prev => withParams(prev, {
      [MASTERNODE_PARAMS.tab]: null,
      [MASTERNODE_PARAMS.node]: null,
      [MASTERNODE_PARAMS.participate]: null,
      [MASTERNODE_PARAMS.register]: '1',
    }), { state })
  }

  const closeRegister = (): void => {
    setRegisterWizardActive(walletId, network ?? null, false)
    if ((location.state as MasternodesNavigationState | null)?.fromList === true) {
      navigate(-1)
      return
    }
    setSearchParams(prev => withParams(prev, { [MASTERNODE_PARAMS.register]: null }), { replace: true })
  }

  const openParticipate = (): void => {
    saveListScroll()
    const state: MasternodesNavigationState = { fromList: true }
    setSearchParams(prev => withParams(prev, {
      [MASTERNODE_PARAMS.tab]: MasternodesTab.Shared,
      [MASTERNODE_PARAMS.node]: null,
      [MASTERNODE_PARAMS.register]: null,
      [MASTERNODE_PARAMS.participate]: '1',
    }), { state })
  }

  const closeParticipate = (): void => {
    if ((location.state as MasternodesNavigationState | null)?.fromList === true) {
      navigate(-1)
      return
    }
    setSearchParams(prev => withParams(prev, { [MASTERNODE_PARAMS.participate]: null }), { replace: true })
  }

  const openNodeFromRegister = (proTxHash: string): void => {
    setRegisterWizardActive(walletId, network ?? null, false)
    setSearchParams(prev => withParams(prev, {
      [MASTERNODE_PARAMS.tab]: null,
      [MASTERNODE_PARAMS.register]: null,
      [MASTERNODE_PARAMS.node]: proTxHash,
    }), { replace: true })
  }

  const items = [
    {
      value: MasternodesTab.Nodes,
      label: MASTERNODES_TAB_LABELS[MasternodesTab.Nodes],
      content: (
        <NodesTab
          walletId={walletId}
          query={nodeQuery}
          onQueryChange={(query) => { setNodeQuery(query); setNodeVisibleCount(MASTERNODES_PAGE_SIZE) }}
          visibleCount={nodeVisibleCount}
          onShowMore={() => setNodeVisibleCount(count => count + MASTERNODES_PAGE_SIZE)}
          onOpenNode={openDetail}
          onRegister={openRegister}
          onImportKeys={() => setKeysOpen(true)}
        />
      ),
    },
    {
      value: MasternodesTab.Shared,
      label: MASTERNODES_TAB_LABELS[MasternodesTab.Shared],
      content: (
        <SharedTab
          walletId={walletId}
          query={sharedQuery}
          onQueryChange={(query) => { setSharedQuery(query); setSharedVisibleCount(MASTERNODES_PAGE_SIZE) }}
          visibleCount={sharedVisibleCount}
          onShowMore={() => setSharedVisibleCount(count => count + MASTERNODES_PAGE_SIZE)}
          onOpenNode={openDetail}
          onRegister={openParticipate}
          onImportKeys={() => setKeysOpen(true)}
        />
      ),
    },
  ]

  return (
    <div className={'relative flex flex-col pb-12'}>
      <div className={'px-12'}>
        {detail != null ? (
          <NodeDetail walletId={walletId} proTxHash={detail} onBack={closeDetail} />
        ) : registering ? (
          <RegisterMasternodeWizard
            key={walletId}
            walletId={walletId}
            onBack={closeRegister}
            onOpenNode={openNodeFromRegister}
          />
        ) : participating ? (
          <ParticipateSharedWizard
            key={walletId}
            walletId={walletId}
            onBack={closeParticipate}
          />
        ) : (
          <>
            <PageHeader
              title={PAGE_HEADERS.masternodes.title}
              subtitle={PAGE_HEADERS.masternodes.subtitle}
              actions={(
                <div className={'flex flex-wrap items-center gap-2'}>
                  <Button
                    type={'button'}
                    size={'compact'}
                    colorScheme={'primary-light'}
                    onClick={() => setKeysOpen(true)}
                    className={'inline-flex items-center gap-1.5 rounded-[.75rem]'}
                  >
                    <KeyIcon size={12} color={'currentColor'} />
                    {MASTERNODES_HEADER_COPY.importButton}
                  </Button>
                  <Button
                    type={'button'}
                    size={'compact'}
                    colorScheme={'primary'}
                    onClick={tab === MasternodesTab.Shared ? openParticipate : openRegister}
                    className={'rounded-[.75rem]'}
                  >
                    {MASTERNODES_HEADER_COPY.registerButton}
                  </Button>
                </div>
              )}
            />
            {unmatchedKeys.length > 0 && (
              <Alert
                tone={AlertTone.Info}
                icon={<KeyIcon size={16} color={'currentColor'} />}
                title={unmatchedImportedKeysTitle(unmatchedKeys.length)}
                description={UNMATCHED_IMPORTED_KEYS_COPY.bannerDescription}
                className={'mb-4'}
                actions={(
                  <Button
                    type={'button'}
                    size={'compact'}
                    colorScheme={'lightBlue-mint'}
                    onClick={() => setUnmatchedOpen(true)}
                    className={'rounded-[.75rem]'}
                  >
                    {UNMATCHED_IMPORTED_KEYS_COPY.bannerAction}
                  </Button>
                )}
              />
            )}
            <div className={`relative ${SURFACE_PANEL}`}>
              <PageTabs
                items={items}
                value={tab}
                onValueChange={value => selectTab(enumParam(MasternodesTab, value, MasternodesTab.Nodes))}
              />
            </div>
          </>
        )}
      </div>
      {keysOpen && <ManageMasternodeKeysModal walletId={walletId} open={keysOpen} onClose={() => setKeysOpen(false)} />}
      {unmatchedOpen && unmatchedKeys.length > 0 && (
        <UnmatchedImportedKeysModal
          walletId={walletId}
          unmatchedKeys={unmatchedKeys}
          open={unmatchedOpen}
          onClose={() => setUnmatchedOpen(false)}
        />
      )}
    </div>
  )
}
