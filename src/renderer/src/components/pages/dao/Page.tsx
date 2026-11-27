import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import PageHeader from '@renderer/components/ui/PageHeader'
import PageTabs from '@renderer/components/ui/PageTabs'
import { CONTESTED_RESOURCES_REFRESH_MS, DAO_PARAMS, DAO_TAB_LABELS } from '@renderer/constants/dao'
import { PROPOSALS_PAGE_SIZE } from '@renderer/constants/governanceProposals'
import { CONTESTS_PAGE_SIZE } from '@renderer/constants/nameContests'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { SURFACE_PANEL } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { DaoTab } from '@renderer/enums/Dao'
import { ContestSegment, ContestSort, ProposalSegment, ProposalSort } from '@renderer/enums/Masternodes'
import { refreshContestedResources } from '@renderer/hooks/useContestedResources'
import { refreshDashPay } from '@renderer/hooks/useDashPayRefresh'
import { useDetailScrollRestore } from '@renderer/hooks/useDetailScrollRestore'
import { refreshGovernanceProposals } from '@renderer/hooks/useGovernanceProposals'
import { useNow } from '@renderer/hooks/useNow'
import type { DaoPageProps } from '@renderer/types/Dao'
import type { MasternodesNavigationState } from '@renderer/types/MasternodeNodes'
import { enumParam, withParams } from '@renderer/utils/searchParams'
import ContestDetail from './contested-resources/ContestDetail'
import ContestsTab from './contested-resources/ContestsTab'
import ProposalDetail from './proposals/ProposalDetail'
import ProposalsTab from './proposals/ProposalsTab'

export default function DaoPage({ walletId }: DaoPageProps): React.JSX.Element {
  const { status } = useAuth()
  const network = status?.network ?? undefined
  const now = useNow()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [proposalQuery, setProposalQuery] = useState('')
  const [proposalVisibleCount, setProposalVisibleCount] = useState(PROPOSALS_PAGE_SIZE)
  const [proposalSort, setProposalSort] = useState(ProposalSort.EndingSoon)
  const [contestQuery, setContestQuery] = useState('')
  const [contestVisibleCount, setContestVisibleCount] = useState(CONTESTS_PAGE_SIZE)
  const [contestSort, setContestSort] = useState(ContestSort.EndingSoon)

  const tab = enumParam(DaoTab, searchParams.get(DAO_PARAMS.tab), DaoTab.Proposals)
  const segment = searchParams.get(DAO_PARAMS.segment)
  const detailParam = tab === DaoTab.Proposals ? DAO_PARAMS.proposal : DAO_PARAMS.contest
  const detail = searchParams.get(detailParam)
  const saveListScroll = useDetailScrollRestore(detail)

  useEffect(() => {
    const timer = setInterval(() => {
      refreshGovernanceProposals(walletId).catch(() => {})
      refreshContestedResources(walletId).catch(() => {})
      refreshDashPay(walletId).catch(() => {})
    }, CONTESTED_RESOURCES_REFRESH_MS)
    return () => clearInterval(timer)
  }, [walletId])

  const selectTab = (next: DaoTab, nextSegment: ProposalSegment | ContestSegment | null): void => {
    setProposalVisibleCount(PROPOSALS_PAGE_SIZE)
    setContestVisibleCount(CONTESTS_PAGE_SIZE)
    setSearchParams(prev => withParams(prev, {
      [DAO_PARAMS.tab]: next === DaoTab.Proposals ? null : next,
      [DAO_PARAMS.segment]: nextSegment,
      [DAO_PARAMS.proposal]: null,
      [DAO_PARAMS.contest]: null,
    }), { replace: true })
  }

  const selectProposals = (next: ProposalSegment): void => selectTab(DaoTab.Proposals, next)
  const selectContests = (next: ContestSegment): void => selectTab(DaoTab.ContestedResources, next)

  const openDetail = (value: string): void => {
    saveListScroll()
    const state: MasternodesNavigationState = { fromList: true }
    setSearchParams(prev => withParams(prev, { [detailParam]: value }), { state })
  }

  const closeDetail = (): void => {
    if ((location.state as MasternodesNavigationState | null)?.fromList === true) {
      navigate(-1)
      return
    }
    setSearchParams(prev => withParams(prev, { [detailParam]: null }), { replace: true })
  }

  const items = [
    {
      value: DaoTab.Proposals,
      label: DAO_TAB_LABELS[DaoTab.Proposals],
      content: (
        <ProposalsTab
          walletId={walletId}
          network={network}
          now={now}
          segment={enumParam(ProposalSegment, segment, ProposalSegment.Active)}
          onSegmentChange={selectProposals}
          query={proposalQuery}
          onQueryChange={(query) => { setProposalQuery(query); setProposalVisibleCount(PROPOSALS_PAGE_SIZE) }}
          sort={proposalSort}
          onSortChange={(sort) => { setProposalSort(sort); setProposalVisibleCount(PROPOSALS_PAGE_SIZE) }}
          visibleCount={proposalVisibleCount}
          onShowMore={() => setProposalVisibleCount(count => count + PROPOSALS_PAGE_SIZE)}
          onOpenProposal={openDetail}
        />
      ),
    },
    {
      value: DaoTab.ContestedResources,
      label: DAO_TAB_LABELS[DaoTab.ContestedResources],
      content: (
        <ContestsTab
          walletId={walletId}
          network={network}
          now={now}
          segment={enumParam(ContestSegment, segment, ContestSegment.Open)}
          onSegmentChange={selectContests}
          query={contestQuery}
          onQueryChange={(query) => { setContestQuery(query); setContestVisibleCount(CONTESTS_PAGE_SIZE) }}
          sort={contestSort}
          onSortChange={(sort) => { setContestSort(sort); setContestVisibleCount(CONTESTS_PAGE_SIZE) }}
          visibleCount={contestVisibleCount}
          onShowMore={() => setContestVisibleCount(count => count + CONTESTS_PAGE_SIZE)}
          onOpenContest={openDetail}
        />
      ),
    },
  ]

  return (
    <div className={'relative flex flex-col pb-12'}>
      <div className={'px-12'}>
        {detail != null ? (
          tab === DaoTab.Proposals
            ? <ProposalDetail key={detail} walletId={walletId} now={now} proposalHash={detail} onBack={closeDetail} />
            : <ContestDetail key={detail} walletId={walletId} now={now} normalizedLabel={detail} onBack={closeDetail} />
        ) : (
          <>
            <PageHeader title={PAGE_HEADERS.dao.title} subtitle={PAGE_HEADERS.dao.subtitle} />
            <div className={`relative ${SURFACE_PANEL}`}>
              <PageTabs items={items} value={tab} onValueChange={value => selectTab(enumParam(DaoTab, value, DaoTab.Proposals), null)} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
