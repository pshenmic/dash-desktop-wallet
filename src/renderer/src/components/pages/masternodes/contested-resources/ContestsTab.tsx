import { useDeferredValue, useMemo } from 'react'
import { Button, Text } from '@renderer/components/dash-ui-kit-extended'
import DropdownField from '@renderer/components/ui/DropdownField'
import NoResults from '@renderer/components/ui/NoResults'
import RetryButton from '@renderer/components/ui/RetryButton'
import SearchField from '@renderer/components/ui/SearchField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import ShowMoreButton from '@renderer/components/ui/ShowMoreButton'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import { TOOLBAR_DROPDOWN_CLASS } from '@renderer/constants/listToolbar'
import {
  CONTEST_LIST_SEPARATOR,
  CONTEST_SEGMENT_EMPTY,
  CONTEST_SEGMENT_LABELS,
  CONTEST_SORT_OPTIONS,
  CONTEST_TABLE_GRID,
  CONTEST_TABLE_HEADINGS,
  CONTESTS_TAB_COPY,
  ENDED_CONTEST_SORT_OPTIONS,
} from '@renderer/constants/nameContests'
import { SECTION_TABLE_HEADER, SECTION_TABLE_WRAPPER } from '@renderer/constants/sectionTable'
import { ContestSegment, ContestSort } from '@renderer/enums/Masternodes'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import { useNameContests } from '@renderer/hooks/useNameContests'
import { useScrollEndSentinel } from '@renderer/hooks/useScrollEndSentinel'
import type { ContestsTabProps } from '@renderer/types/MasternodeScreens'
import { windowList } from '@renderer/utils/listWindow'
import { filterContests, sortContests } from '@renderer/utils/nameContests'
import { enumParam } from '@renderer/utils/searchParams'
import ContestTableRow from './ContestTableRow'

export default function ContestsTab({
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
  onOpenContest,
}: ContestsTabProps): React.JSX.Element {
  const { contests, loading, err, retry } = useNameContests(walletId)
  const appliedQuery = useDeferredValue(query)
  const { options, filtered } = useMemo(() => {
    const bySegment = Object.values(ContestSegment).map(value => ({
      value,
      contests: filterContests(contests, { query: appliedQuery, segment: value, now, network }),
    }))
    return {
      options: bySegment.map(({ value, contests }) => ({
        value,
        label: `${CONTEST_SEGMENT_LABELS[value]}${CONTEST_LIST_SEPARATOR}${contests.length}`,
      })),
      filtered: sortContests(bySegment.find(entry => entry.value === segment)?.contests ?? [], sort, segment),
    }
  }, [contests, appliedQuery, segment, now, network, sort])
  const view = windowList(filtered, visibleCount)
  const showSkeleton = (loading && contests.length === 0) || appliedQuery !== query
  const showMoreVisible = view.hasMore && !showSkeleton
  const sentinelRef = useScrollEndSentinel(showMoreVisible, onShowMore, visibleCount)
  const sortOptions = segment === ContestSegment.Ended ? ENDED_CONTEST_SORT_OPTIONS : CONTEST_SORT_OPTIONS

  if (err != null && contests.length === 0 && !loading) {
    return <NoResults tone={NoResultsTone.Error} noResults={err} action={<RetryButton onRetry={retry} />} />
  }

  return (
    <div className={'flex flex-col gap-4 pt-2'}>
      <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{CONTESTS_TAB_COPY.description}</Text>
      <div className={'flex flex-wrap items-center gap-3'}>
        <SearchField
          value={query}
          onChange={onQueryChange}
          placeholder={CONTESTS_TAB_COPY.searchPlaceholder}
          ariaLabel={CONTESTS_TAB_COPY.searchLabel}
          className={'w-full max-w-[22rem]'}
        />
        <DropdownField
          options={sortOptions}
          value={sort}
          onChange={value => onSortChange(enumParam(ContestSort, value, ContestSort.EndingSoon))}
          ariaLabel={CONTESTS_TAB_COPY.sortLabel}
          triggerClassName={TOOLBAR_DROPDOWN_CLASS}
          textSize={12}
        />
      </div>
      <SegmentedControl
        appearance={SegmentedControlAppearance.Pill}
        ariaLabel={CONTESTS_TAB_COPY.segmentsLabel}
        options={options}
        value={segment}
        onChange={onSegmentChange}
        className={'self-start flex-wrap'}
      />
      <div className={'flex flex-col gap-4'} aria-busy={showSkeleton}>
        {showSkeleton && <ListSkeleton rows={6} rowClassName={'h-[3.625rem] rounded-[.875rem]'} />}
        {!showSkeleton && filtered.length === 0 && (query.trim() === ''
          ? <NoResults noResults={CONTEST_SEGMENT_EMPTY[segment]} />
          : <NoResults
              noResults={`${CONTESTS_TAB_COPY.noMatch} “${query.trim()}”`}
              action={<Button type={'button'} size={'compact'} colorScheme={'primary-light'} onClick={() => onQueryChange('')}>{CONTESTS_TAB_COPY.clearSearch}</Button>}
            />
        )}
        {!showSkeleton && view.items.length > 0 && (
          <div className={SECTION_TABLE_WRAPPER}>
            <div className={'min-w-[34rem]'}>
              <div className={`${SECTION_TABLE_HEADER} ${CONTEST_TABLE_GRID}`}>
                {CONTEST_TABLE_HEADINGS.map(heading => (
                  <Text key={heading} size={12} weight={'normal'} color={'brand'} opacity={50}>{heading}</Text>
                ))}
              </div>
              {view.items.map(contest => (
                <ContestTableRow key={contest.normalizedLabel} contest={contest} now={now} network={network} onOpen={onOpenContest} />
              ))}
            </div>
          </div>
        )}
        {showMoreVisible && <ShowMoreButton ref={sentinelRef} remaining={view.remaining} onClick={onShowMore} />}
      </div>
    </div>
  )
}
