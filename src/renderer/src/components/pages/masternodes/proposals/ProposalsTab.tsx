import { useDeferredValue, useMemo } from 'react'
import { Button, Text } from '@renderer/components/dash-ui-kit-extended'
import DropdownField from '@renderer/components/ui/DropdownField'
import NoResults from '@renderer/components/ui/NoResults'
import RetryButton from '@renderer/components/ui/RetryButton'
import SearchField from '@renderer/components/ui/SearchField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import ShowMoreButton from '@renderer/components/ui/ShowMoreButton'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import {
  ENDED_PROPOSAL_SORT_OPTIONS,
  PROPOSAL_SEGMENT_EMPTY,
  PROPOSAL_SEGMENT_LABELS,
  PROPOSAL_SORT_OPTIONS,
  PROPOSAL_TABLE_GRID,
  PROPOSAL_TABLE_HEADINGS,
  PROPOSALS_TAB_COPY,
} from '@renderer/constants/governanceProposals'
import { TOOLBAR_DROPDOWN_CLASS } from '@renderer/constants/listToolbar'
import { CONTEST_LIST_SEPARATOR } from '@renderer/constants/nameContests'
import { SECTION_TABLE_HEADER, SECTION_TABLE_WRAPPER } from '@renderer/constants/sectionTable'
import { ProposalSegment, ProposalSort } from '@renderer/enums/Masternodes'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import { useGovernanceProposals } from '@renderer/hooks/useGovernanceProposals'
import { useScrollEndSentinel } from '@renderer/hooks/useScrollEndSentinel'
import type { ProposalsTabProps } from '@renderer/types/MasternodeScreens'
import { filterProposals, sortProposals } from '@renderer/utils/governanceProposals'
import { windowList } from '@renderer/utils/listWindow'
import { enumParam } from '@renderer/utils/searchParams'
import ProposalTableRow from './ProposalTableRow'

export default function ProposalsTab({
  walletId,
  network,
  now,
  segment,
  onSegmentChange,
  query,
  onQueryChange,
  sort,
  onSortChange,
  visibleCount,
  onShowMore,
  onOpenProposal,
}: ProposalsTabProps): React.JSX.Element {
  const { proposals, loading, err, retry } = useGovernanceProposals(walletId)
  const appliedQuery = useDeferredValue(query)
  const { options, filtered } = useMemo(() => {
    const bySegment = Object.values(ProposalSegment).map(value => ({
      value,
      proposals: filterProposals(proposals, { query: appliedQuery, segment: value, now, network }),
    }))
    return {
      options: bySegment.map(({ value, proposals }) => ({
        value,
        label: `${PROPOSAL_SEGMENT_LABELS[value]}${CONTEST_LIST_SEPARATOR}${proposals.length}`,
      })),
      filtered: sortProposals(bySegment.find(entry => entry.value === segment)?.proposals ?? [], sort, segment),
    }
  }, [proposals, appliedQuery, segment, now, network, sort])
  const view = windowList(filtered, visibleCount)
  const showSkeleton = (loading && proposals.length === 0) || appliedQuery !== query
  const showMoreVisible = view.hasMore && !showSkeleton
  const sentinelRef = useScrollEndSentinel(showMoreVisible, onShowMore, visibleCount)
  const sortOptions = segment === ProposalSegment.Ended ? ENDED_PROPOSAL_SORT_OPTIONS : PROPOSAL_SORT_OPTIONS

  if (err != null && proposals.length === 0 && !loading) {
    return <NoResults tone={NoResultsTone.Error} noResults={err} action={<RetryButton onRetry={retry} />} />
  }

  return (
    <div className={'flex flex-col gap-4 pt-2'}>
      <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{PROPOSALS_TAB_COPY.description}</Text>
      <div className={'flex flex-wrap items-center gap-3'}>
        <SearchField
          value={query}
          onChange={onQueryChange}
          placeholder={PROPOSALS_TAB_COPY.searchPlaceholder}
          ariaLabel={PROPOSALS_TAB_COPY.searchLabel}
          className={'w-full max-w-[22rem]'}
        />
        <DropdownField
          options={sortOptions}
          value={sort}
          onChange={value => onSortChange(enumParam(ProposalSort, value, ProposalSort.EndingSoon))}
          ariaLabel={PROPOSALS_TAB_COPY.sortLabel}
          triggerClassName={TOOLBAR_DROPDOWN_CLASS}
          textSize={12}
        />
      </div>
      <SegmentedControl
        appearance={SegmentedControlAppearance.Pill}
        ariaLabel={PROPOSALS_TAB_COPY.segmentsLabel}
        options={options}
        value={segment}
        onChange={onSegmentChange}
        className={'self-start flex-wrap'}
      />
      <div className={'flex flex-col gap-4'} aria-busy={showSkeleton}>
        {showSkeleton && <ListSkeleton rows={6} rowClassName={'h-[3.625rem] rounded-[.875rem]'} />}
        {!showSkeleton && filtered.length === 0 && (query.trim() === ''
          ? <NoResults noResults={PROPOSAL_SEGMENT_EMPTY[segment]} />
          : <NoResults
              noResults={`${PROPOSALS_TAB_COPY.noMatch} “${query.trim()}”`}
              action={<Button type={'button'} size={'compact'} colorScheme={'primary-light'} onClick={() => onQueryChange('')}>{PROPOSALS_TAB_COPY.clearSearch}</Button>}
            />
        )}
        {!showSkeleton && view.items.length > 0 && (
          <div className={SECTION_TABLE_WRAPPER}>
            <div className={'min-w-[34rem]'}>
              <div className={`${SECTION_TABLE_HEADER} ${PROPOSAL_TABLE_GRID}`}>
                {PROPOSAL_TABLE_HEADINGS.map(heading => (
                  <Text key={heading} size={12} weight={'normal'} color={'brand'} opacity={50}>{heading}</Text>
                ))}
              </div>
              {view.items.map(proposal => (
                <ProposalTableRow key={proposal.hash} proposal={proposal} now={now} network={network} onOpen={onOpenProposal} />
              ))}
            </div>
          </div>
        )}
        {showMoreVisible && <ShowMoreButton ref={sentinelRef} remaining={view.remaining} onClick={onShowMore} />}
      </div>
    </div>
  )
}
