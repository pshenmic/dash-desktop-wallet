import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import PageHeader from '@renderer/components/ui/PageHeader'
import PageTabs from '@renderer/components/ui/PageTabs'
import { DASHPAY_REFRESH_MS } from '@renderer/constants/dashPay'
import { MASTERNODE_PARAMS, MASTERNODES_PAGE_SIZE, MASTERNODES_TAB_LABELS } from '@renderer/constants/masternodes'
import { CONTESTS_PAGE_SIZE } from '@renderer/constants/nameContests'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { SURFACE_PANEL } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { ContestSegment, ContestSort, MasternodesTab, NodeSegment } from '@renderer/enums/Masternodes'
import { refreshDashPay } from '@renderer/hooks/useDashPayRefresh'
import { useDetailScrollRestore } from '@renderer/hooks/useDetailScrollRestore'
import { useNow } from '@renderer/hooks/useNow'
import type { MasternodesNavigationState } from '@renderer/types/MasternodeNodes'
import type { MasternodesPageProps } from '@renderer/types/MasternodeScreens'
import { enumParam, withParams } from '@renderer/utils/searchParams'
import ContestDetail from './contested-resources/ContestDetail'
import ContestsTab from './contested-resources/ContestsTab'
import NodeDetail from './nodes/NodeDetail'
import NodesTab from './nodes/NodesTab'
import SummaryStrip from './SummaryStrip'

export default function MasternodesPage({ walletId }: MasternodesPageProps): React.JSX.Element {
  const { status } = useAuth()
  const network = status?.network ?? undefined
  const now = useNow()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [nodeQuery, setNodeQuery] = useState('')
  const [nodeVisibleCount, setNodeVisibleCount] = useState(MASTERNODES_PAGE_SIZE)
  const [contestQuery, setContestQuery] = useState('')
  const [contestVisibleCount, setContestVisibleCount] = useState(CONTESTS_PAGE_SIZE)
  const [contestSort, setContestSort] = useState(ContestSort.EndingSoon)
  const tab = enumParam(MasternodesTab, searchParams.get(MASTERNODE_PARAMS.tab), MasternodesTab.Nodes)
  const segment = searchParams.get(MASTERNODE_PARAMS.segment)
  const detailParam = tab === MasternodesTab.Nodes ? MASTERNODE_PARAMS.node : MASTERNODE_PARAMS.contest
  const detail = searchParams.get(detailParam)
  const saveListScroll = useDetailScrollRestore(detail)

  useEffect(() => {
    const timer = setInterval(() => { refreshDashPay(walletId).catch(() => {}) }, DASHPAY_REFRESH_MS)
    return () => clearInterval(timer)
  }, [walletId])

  const selectTab = (next: MasternodesTab, nextSegment: NodeSegment | ContestSegment | null): void => {
    setNodeVisibleCount(MASTERNODES_PAGE_SIZE)
    setContestVisibleCount(CONTESTS_PAGE_SIZE)
    setSearchParams(prev => withParams(prev, {
      [MASTERNODE_PARAMS.tab]: next === MasternodesTab.Nodes ? null : next,
      [MASTERNODE_PARAMS.segment]: nextSegment,
      [MASTERNODE_PARAMS.node]: null,
      [MASTERNODE_PARAMS.contest]: null,
    }), { replace: true })
  }

  const selectNodes = (next: NodeSegment): void => selectTab(MasternodesTab.Nodes, next)
  const selectContests = (next: ContestSegment): void => selectTab(MasternodesTab.ContestedResources, next)

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
      value: MasternodesTab.Nodes,
      label: MASTERNODES_TAB_LABELS[MasternodesTab.Nodes],
      content: (
        <NodesTab
          walletId={walletId}
          segment={enumParam(NodeSegment, segment, NodeSegment.All)}
          onSegmentChange={selectNodes}
          query={nodeQuery}
          onQueryChange={query => { setNodeQuery(query); setNodeVisibleCount(MASTERNODES_PAGE_SIZE) }}
          visibleCount={nodeVisibleCount}
          onShowMore={() => setNodeVisibleCount(count => count + MASTERNODES_PAGE_SIZE)}
          onOpenNode={openDetail}
        />
      ),
    },
    {
      value: MasternodesTab.ContestedResources,
      label: MASTERNODES_TAB_LABELS[MasternodesTab.ContestedResources],
      content: (
        <ContestsTab
          walletId={walletId}
          network={network}
          now={now}
          segment={enumParam(ContestSegment, segment, ContestSegment.Open)}
          onSegmentChange={selectContests}
          query={contestQuery}
          onQueryChange={query => { setContestQuery(query); setContestVisibleCount(CONTESTS_PAGE_SIZE) }}
          sort={contestSort}
          onSortChange={sort => { setContestSort(sort); setContestVisibleCount(CONTESTS_PAGE_SIZE) }}
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
          tab === MasternodesTab.Nodes
            ? <NodeDetail walletId={walletId} proTxHash={detail} onBack={closeDetail} />
            : <ContestDetail key={detail} walletId={walletId} now={now} normalizedLabel={detail} onBack={closeDetail} />
        ) : (
          <>
            <PageHeader title={PAGE_HEADERS.masternodes.title} subtitle={PAGE_HEADERS.masternodes.subtitle} />
            <SummaryStrip walletId={walletId} network={network} now={now} onSelectNodes={selectNodes} onSelectContests={selectContests} />
            <div className={`relative ${SURFACE_PANEL}`}>
              <PageTabs items={items} value={tab} onValueChange={value => selectTab(enumParam(MasternodesTab, value, MasternodesTab.Nodes), null)} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
