import { useDeferredValue, useMemo, useRef } from 'react'
import { DateBlock } from 'dash-ui-kit/react'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import { CloseIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import { transactionsPage } from '@renderer/constants'
import { SEARCH_CLEAR_LABEL, TOOLBAR_SEARCH_CLASS } from '@renderer/constants/listToolbar'
import { DEFAULT_TX_FILTER } from '@renderer/constants/transactionFilters'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { CHIP_ACTION } from '@renderer/constants/surfaces'
import TransactionCard from './TransactionCard'
import TransactionsFilter from './TransactionsFilter'
import PageHeader from '@renderer/components/ui/PageHeader'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'
import PartialDataNotice from '@renderer/components/ui/PartialDataNotice'
import SearchField from '@renderer/components/ui/SearchField'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import { useAuth } from '@renderer/contexts/AuthContext'
import { creditsToDash } from '@renderer/utils/balance'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { useIdentities } from '@renderer/hooks/useIdentities'
import { useScrollEndSentinel } from '@renderer/hooks/useScrollEndSentinel'
import { activeTxFilterChips, computeTxTotals, filterTransactions } from '@renderer/utils/transactionFilters'
import { mergeWalletTransactions, windowWalletHistory } from '@renderer/utils/walletTransactions'
import type { TransactionsListProps } from '@renderer/types/WalletTransaction'

export default function TransactionsList({
  filter,
  onFilterChange,
  onTransactionClick,
  visibleCount,
  onShowMore,
  groups,
  platform,
  platformFailed,
  loading,
  err,
}: TransactionsListProps): React.JSX.Element {
  const { filters, showMore } = transactionsPage.transactions
  const { isBalanceVisible } = useBalanceVisibility()
  const { status } = useAuth()
  const { identities } = useIdentities(status?.selectedWalletId ?? undefined)
  const appliedFilter = useDeferredValue(filter)
  const isFiltering = appliedFilter !== filter
  const transactions = useMemo(
    () => mergeWalletTransactions(groups.flatMap((group) => group.transactions), platform, identities),
    [groups, platform, identities],
  )
  const filtered = useMemo(() => filterTransactions(transactions, appliedFilter), [transactions, appliedFilter])
  const view = useMemo(() => windowWalletHistory(filtered, visibleCount), [filtered, visibleCount])
  const totals = useMemo(() => computeTxTotals(filtered), [filtered])
  const hasData = transactions.length > 0
  const showSkeleton = loading && !hasData
  const showMoreVisible = view.hasMore && !showSkeleton && !isFiltering
  const sentinelRef = useScrollEndSentinel(showMoreVisible, onShowMore, visibleCount)
  const activeFilters = activeTxFilterChips(filter)
  const searchRef = useRef<HTMLInputElement>(null)
  const changeSearch = (search: string): void => onFilterChange({ ...filter, search })

  return (
    <div className={'px-12 pb-8'}>
      <PageHeader title={PAGE_HEADERS.transactions.title} subtitle={PAGE_HEADERS.transactions.subtitle} />
      <div className={'flex flex-col gap-6 p-[.9375rem] rounded-3xl dash-card-base shadow-[0_0_32px_0_rgba(12,28,51,0.08)]'}>
        {(hasData || activeFilters.length > 0 || filter.search !== '') && (
          <div className={'flex flex-wrap items-center justify-between gap-4'}>
            <div className={'flex flex-wrap items-center gap-3'}>
              <div className={'flex items-center gap-1.5'}>
                <Text size={12} weight={'medium'} color={'brand'} opacity={40}>
                  {filters.totals.received}:
                </Text>
                <Text size={12} weight={'medium'} color={'blue-mint'}>
                  <SensitiveValue hidden={!isBalanceVisible} size={'compact'} tone={'accent'}>
                    +{creditsToDash(totals.receivedCredits)} Dash
                  </SensitiveValue>
                </Text>
              </div>
              <div className={'flex items-center gap-1.5'}>
                <Text size={12} weight={'medium'} color={'brand'} opacity={40}>
                  {filters.totals.sent}:
                </Text>
                <Text size={12} weight={'medium'} color={'brand'}>
                  <SensitiveValue hidden={!isBalanceVisible} size={'compact'}>
                    -{creditsToDash(totals.sentCredits)} Dash
                  </SensitiveValue>
                </Text>
              </div>
            </div>
            <div className={'ml-auto flex min-w-[min(100%,20rem)] flex-1 items-center justify-end gap-3'}>
              <SearchField
                ref={searchRef}
                value={filter.search}
                onChange={changeSearch}
                placeholder={filters.search.placeholder}
                ariaLabel={filters.search.label}
                className={TOOLBAR_SEARCH_CLASS}
              />
              <TransactionsFilter active={activeFilters.length > 0} filter={filter} onChange={onFilterChange} transactions={platform} />
            </div>
          </div>
        )}
        {activeFilters.length > 0 && (
          <div aria-label={'Active transaction filters'} className={'flex flex-wrap items-center gap-2'}>
            {activeFilters.map(({ field, label }) => (
              <button
                key={field}
                type={'button'}
                onClick={() => onFilterChange({ ...filter, [field]: DEFAULT_TX_FILTER[field] })}
                aria-label={`Remove ${label}`}
                className={'flex min-w-0 max-w-full items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block-accent-5 cursor-pointer hover:opacity-80'}
              >
                <Text size={12} weight={'medium'} color={'brand'} className={'min-w-0 break-all text-left'}>{label}</Text>
                <CloseIcon size={10} className={'shrink-0 dash-text-primary'} />
              </button>
            ))}
            <button
              type={'button'}
              onClick={() => onFilterChange({ ...DEFAULT_TX_FILTER, search: filter.search })}
              className={'px-2 py-1.5 cursor-pointer hover:opacity-80'}
            >
              <Text size={12} weight={'medium'} color={'blue-mint'}>Clear filters</Text>
            </button>
          </div>
        )}
        <div className="flex flex-col gap-5" aria-busy={showSkeleton || isFiltering}>
          <PartialDataNotice platformFailed={platformFailed} />
          {showSkeleton && <ListSkeleton rows={3} rowClassName={'h-[4.25rem] rounded-[.875rem]'} />}
          {err && <NoResults noResults={'Failed to load transactions'} />}
          {!showSkeleton && !loading && !err && !hasData && <NoResults noResults={'No transactions found'} />}
          {!loading && !isFiltering && hasData && filtered.length === 0 && (
            <NoResults
              title={filters.noMatch}
              action={filter.search.trim() !== '' && (
                <button type={'button'} className={CHIP_ACTION} onClick={() => {
                  searchRef.current?.focus()
                  changeSearch('')
                }}>
                  {SEARCH_CLEAR_LABEL}
                </button>
              )}
            />
          )}
          {!showSkeleton && view.groups.map((group) => (
            <div key={group.date?.getTime() ?? 'unknown'} className={'flex flex-col gap-[.9375rem]'}>
              {group.date ? <DateBlock timestamp={group.date} format={'dateOnly'} /> : (
                <Text size={12} weight={'medium'} color={'brand'} opacity={40}>Date unavailable</Text>
              )}
              {group.transactions.map((transaction) => (
                <div
                  key={`${transaction.kind}:${transaction.id}`}
                  onClick={() => onTransactionClick(transaction.selection)}
                  className={'cursor-pointer'}
                >
                  <TransactionCard {...transaction} />
                </div>
              ))}
            </div>
          ))}
          {showMoreVisible && (
            <button
              ref={sentinelRef}
              type={'button'}
              onClick={onShowMore}
              className={`self-center ${CHIP_ACTION} font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40`}
            >
              {showMore} · {view.remaining}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
