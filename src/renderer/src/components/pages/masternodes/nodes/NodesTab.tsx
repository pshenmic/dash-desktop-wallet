import { useDeferredValue, useMemo } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'
import RetryButton from '@renderer/components/ui/RetryButton'
import SearchField from '@renderer/components/ui/SearchField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import ShowMoreButton from '@renderer/components/ui/ShowMoreButton'
import { NODE_SEGMENT_EMPTY, NODE_TABLE_COLUMNS, NODES_TAB_COPY } from '@renderer/constants/masternodeNodes'
import { MASTERNODE_TABLE_GRID } from '@renderer/constants/masternodes'
import { SECTION_TABLE_HEADER, SECTION_TABLE_WRAPPER } from '@renderer/constants/sectionTable'
import { CHIP_ACTION } from '@renderer/constants/surfaces'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import { refreshMasternodes, useMasternodes } from '@renderer/hooks/useMasternodes'
import { useScrollEndSentinel } from '@renderer/hooks/useScrollEndSentinel'
import { windowList } from '@renderer/utils/listWindow'
import { filterNodes, nodeSegmentOptions } from '@renderer/utils/masternodeNodes'
import type { NodesTabProps } from '@renderer/types/MasternodeScreens'
import NodeTableRow from './NodeTableRow'

export default function NodesTab({
  walletId,
  segment,
  onSegmentChange,
  query,
  onQueryChange,
  visibleCount,
  onShowMore,
  onOpenNode,
}: NodesTabProps): React.JSX.Element {
  const { desired } = useConnectionModeContext()
  const { nodes, loading, err } = useMasternodes(walletId)
  const appliedQuery = useDeferredValue(query)
  const options = useMemo(() => nodeSegmentOptions(nodes, appliedQuery), [nodes, appliedQuery])
  const filtered = useMemo(() => filterNodes(nodes, appliedQuery, segment), [nodes, appliedQuery, segment])
  const view = useMemo(() => windowList(filtered, visibleCount), [filtered, visibleCount])
  const hasNodes = nodes.length > 0
  const showSkeleton = loading && !hasNodes
  const sentinelRef = useScrollEndSentinel(view.hasMore && !showSkeleton, onShowMore, visibleCount)

  let body: React.JSX.Element
  if (showSkeleton) {
    body = <ListSkeleton rows={4} rowClassName={'h-[3.625rem] rounded-[.875rem]'} />
  } else if (err && !hasNodes) {
    body = (
      <NoResults
        tone={NoResultsTone.Error}
        noResults={err}
        action={<RetryButton onRetry={() => refreshMasternodes(walletId)} />}
      />
    )
  } else if (!hasNodes) {
    body = (
      <NoResults
        title={NODES_TAB_COPY.emptyTitle}
        description={desired === 'p2p' ? NODES_TAB_COPY.rpcDiscovery : NODES_TAB_COPY.emptyDescription}
      />
    )
  } else {
    body = (
      <div className={'flex flex-col gap-4'}>
        <SearchField
          value={query}
          onChange={onQueryChange}
          placeholder={NODES_TAB_COPY.searchPlaceholder}
          ariaLabel={NODES_TAB_COPY.searchLabel}
          className={'max-w-[22rem]'}
        />
        <SegmentedControl
          appearance={SegmentedControlAppearance.Pill}
          ariaLabel={NODES_TAB_COPY.segmentsLabel}
          options={options}
          value={segment}
          onChange={onSegmentChange}
          className={'flex-wrap'}
        />
        {filtered.length === 0 ? (
          appliedQuery.trim() === '' ? (
            <NoResults noResults={NODE_SEGMENT_EMPTY[segment]} />
          ) : (
            <NoResults
              noResults={`${NODES_TAB_COPY.noMatch} “${appliedQuery.trim()}”`}
              action={<button type={'button'} onClick={() => onQueryChange('')} className={CHIP_ACTION}>{NODES_TAB_COPY.clearSearch}</button>}
            />
          )
        ) : (
          <div className={SECTION_TABLE_WRAPPER}>
            <div className={'min-w-[36rem]'}>
              <div className={`${SECTION_TABLE_HEADER} ${MASTERNODE_TABLE_GRID}`}>
                {NODE_TABLE_COLUMNS.map(label => (
                  <Text key={label} size={12} weight={'normal'} color={'brand'} opacity={50}>{label}</Text>
                ))}
              </div>
              {view.items.map(node => (
                <NodeTableRow key={node.proTxHash} node={node} onOpen={onOpenNode} />
              ))}
            </div>
          </div>
        )}
        {view.hasMore && <ShowMoreButton ref={sentinelRef} remaining={view.remaining} onClick={onShowMore} />}
      </div>
    )
  }

  return (
    <div className={'flex flex-col gap-4 pt-2'}>
      {body}
    </div>
  )
}
