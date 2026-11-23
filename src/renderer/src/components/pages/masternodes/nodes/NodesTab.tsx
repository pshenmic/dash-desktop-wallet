import { useDeferredValue, useMemo, useState } from 'react'
import { Button, PlusIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'
import RetryButton from '@renderer/components/ui/RetryButton'
import SearchField from '@renderer/components/ui/SearchField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import ShowMoreButton from '@renderer/components/ui/ShowMoreButton'
import { NODE_SEGMENT_EMPTY, NODE_TABLE_COLUMNS, NODES_TAB_COPY } from '@renderer/constants/masternodeNodes'
import { MASTERNODE_TABLE_GRID } from '@renderer/constants/masternodes'
import { SECTION_TABLE_HEADER, SECTION_TABLE_WRAPPER } from '@renderer/constants/sectionTable'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import { refreshMasternodes, useMasternodes } from '@renderer/hooks/useMasternodes'
import { useScrollEndSentinel } from '@renderer/hooks/useScrollEndSentinel'
import { windowList } from '@renderer/utils/listWindow'
import { emptyNodesDescription, filterNodes, nodeSegmentOptions, soloMasternodes } from '@renderer/utils/masternodeNodes'
import type { NodesTabProps } from '@renderer/types/MasternodeScreens'
import AddMasternodeModal from './AddMasternodeModal'
import ManageMasternodeKeysModal from './ManageMasternodeKeysModal'
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
  onRegister,
}: NodesTabProps): React.JSX.Element {
  const { desired, setDesired } = useConnectionModeContext()
  const { nodes, discovered, loading, err } = useMasternodes(walletId)
  const [addOpen, setAddOpen] = useState(false)
  const [keysOpen, setKeysOpen] = useState(false)
  const appliedQuery = useDeferredValue(query)
  const soloNodes = useMemo(() => soloMasternodes(nodes), [nodes])
  const options = useMemo(() => nodeSegmentOptions(soloNodes, appliedQuery), [soloNodes, appliedQuery])
  const filtered = useMemo(() => filterNodes(soloNodes, appliedQuery, segment), [soloNodes, appliedQuery, segment])
  const view = useMemo(() => windowList(filtered, visibleCount), [filtered, visibleCount])
  const hasNodes = soloNodes.length > 0
  const showSkeleton = loading && !discovered && !hasNodes
  const sentinelRef = useScrollEndSentinel(view.hasMore && !showSkeleton, onShowMore, visibleCount)

  const actionButtons = (
    <Button
      type={'button'}
      size={'compact'}
      colorScheme={'primary'}
      onClick={() => setAddOpen(true)}
      className={'inline-flex items-center gap-1.5 rounded-[.75rem]'}
    >
      <PlusIcon size={12} color={'currentColor'} />
      {NODES_TAB_COPY.addMasternodeButton}
    </Button>
  )

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
        description={emptyNodesDescription(desired, discovered)}
        action={(
          <div className={'flex flex-wrap items-center justify-center gap-2'}>
            {actionButtons}
            {desired === 'rpc' && (
              <Button
                type={'button'}
                size={'compact'}
                colorScheme={'lightBlue-mint'}
                onClick={() => setDesired('p2p')}
                className={'rounded-[.75rem]'}
              >
                {NODES_TAB_COPY.switchToP2P}
              </Button>
            )}
          </div>
        )}
      />
    )
  } else {
    body = (
      <div className={'flex flex-col gap-4'}>
        <div className={'flex flex-wrap items-center justify-between gap-3'}>
          <SearchField
            value={query}
            onChange={onQueryChange}
            placeholder={NODES_TAB_COPY.searchPlaceholder}
            ariaLabel={NODES_TAB_COPY.searchLabel}
            className={'flex-1 max-w-[22rem]'}
          />
          {actionButtons}
        </div>
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
              action={<Button type={'button'} size={'compact'} colorScheme={'primary-light'} onClick={() => onQueryChange('')}>{NODES_TAB_COPY.clearSearch}</Button>}
            />
          )
        ) : (
          <div className={SECTION_TABLE_WRAPPER}>
            <div className={'min-w-[40rem]'}>
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
      {addOpen && (
        <AddMasternodeModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSelectRegister={onRegister}
          onSelectImport={() => setKeysOpen(true)}
        />
      )}
      {keysOpen && (
        <ManageMasternodeKeysModal
          walletId={walletId}
          open={keysOpen}
          onClose={() => setKeysOpen(false)}
        />
      )}
    </div>
  )
}
