import { useDeferredValue, useMemo, useState } from 'react'
import { Button, PlusIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'
import RetryButton from '@renderer/components/ui/RetryButton'
import SearchField from '@renderer/components/ui/SearchField'
import ShowMoreButton from '@renderer/components/ui/ShowMoreButton'
import {
  MASTERNODE_CARDS_GRID,
  NODE_TABLE_COLUMNS,
  NODES_TAB_COPY,
} from '@renderer/constants/masternodeNodes'
import { MASTERNODE_TABLE_GRID } from '@renderer/constants/masternodes'
import { SECTION_TABLE_HEADER, SECTION_TABLE_WRAPPER } from '@renderer/constants/sectionTable'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { MasternodeViewMode } from '@renderer/enums/Masternodes'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { refreshMasternodes, useMasternodes } from '@renderer/hooks/useMasternodes'
import { useMasternodeViewMode } from '@renderer/hooks/useMasternodeViewMode'
import { useReceiveRequests } from '@renderer/hooks/useReceiveRequests'
import { useScrollEndSentinel } from '@renderer/hooks/useScrollEndSentinel'
import { windowList } from '@renderer/utils/listWindow'
import { emptyNodesDescription, filterNodes, soloMasternodes } from '@renderer/utils/masternodeNodes'
import type { NodesTabProps } from '@renderer/types/MasternodeScreens'
import AddMasternodeModal from './AddMasternodeModal'
import MasternodeViewSwitch from './MasternodeViewSwitch'
import NodeCard from './NodeCard'
import NodeTableRow from './NodeTableRow'

export default function NodesTab({
  walletId,
  query,
  onQueryChange,
  visibleCount,
  onShowMore,
  onOpenNode,
  onRegister,
  onImportKeys,
}: NodesTabProps): React.JSX.Element {
  const { desired, setDesired } = useConnectionModeContext()
  const { nodes, discovered, loading, err } = useMasternodes(walletId)
  const [viewMode, setViewMode] = useMasternodeViewMode()
  const { labelsByAddress } = useReceiveRequests(walletId)
  const [addOpen, setAddOpen] = useState(false)
  const appliedQuery = useDeferredValue(query)
  const soloNodes = useMemo(() => soloMasternodes(nodes), [nodes])
  const filtered = useMemo(() => filterNodes(soloNodes, appliedQuery), [soloNodes, appliedQuery])
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
    body = viewMode === MasternodeViewMode.Cards
      ? <ListSkeleton rows={4} className={MASTERNODE_CARDS_GRID} rowClassName={'h-[14.5rem] rounded-[.9375rem]'} />
      : <ListSkeleton rows={4} rowClassName={'h-[3.625rem] rounded-[.875rem]'} />
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
            className={'flex-1 min-w-[14rem] max-w-[22rem]'}
          />
          <MasternodeViewSwitch value={viewMode} onChange={setViewMode} />
        </div>
        {filtered.length === 0 ? (
          <NoResults
            noResults={`${NODES_TAB_COPY.noMatch} “${appliedQuery.trim()}”`}
            action={<Button type={'button'} size={'compact'} colorScheme={'primary-light'} onClick={() => onQueryChange('')}>{NODES_TAB_COPY.clearSearch}</Button>}
          />
        ) : viewMode === MasternodeViewMode.Cards ? (
          <div className={MASTERNODE_CARDS_GRID}>
            {view.items.map(node => (
              <NodeCard key={node.proTxHash} node={node} labelsByAddress={labelsByAddress} onOpen={onOpenNode} />
            ))}
          </div>
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
          onSelectImport={onImportKeys}
        />
      )}
    </div>
  )
}
