import { TxBalanceChangeFilter } from '../enums/TxBalanceChangeFilter'
import { TxTypeFilter } from '../enums/TxTypeFilter'
import { BALANCE_CHANGE_BY_DIRECTION, TX_BALANCE_CHANGE_OPTIONS, TX_CORE_TYPE_OPTIONS, TX_FILTER_CHIP_FIELDS, TX_FILTER_LABELS, TX_SOURCE_OPTIONS, TX_STATUS_OPTIONS } from '../constants/transactionFilters'
import type { PlatformTransaction } from '../api/types'
import type { FilterOption, TxFilter, TxFilterChip, TxTotals, WalletHistoryItem, WalletTxItem } from '../types/WalletTransaction'
import { duffsToCredits } from './balance'
import { matchesDpnsLabel, stripDpnsInput } from './dpnsLabel'
import { platformTransactionTitle } from './platformTransactions'

export function txType(tx: Pick<WalletTxItem, 'vout'>): Exclude<TxTypeFilter, TxTypeFilter.All> {
  return tx.vout.some((output) => !output.address) ? TxTypeFilter.AssetLock : TxTypeFilter.Transfer
}

export function transactionTypeOptions(transactions: PlatformTransaction[], source: TxFilter['source'] = 'all'): FilterOption<TxFilter['type']>[] {
  const options: FilterOption<TxFilter['type']>[] = [
    ...TX_CORE_TYPE_OPTIONS,
    ...Array.from(new Set(transactions.map((tx) => tx.type))).sort()
      .map((type) => ({ value: `platform:${type}` as const, label: `Evo: ${platformTransactionTitle(type)}` })),
  ]
  return options.filter((option) => source === 'all' || option.value === 'all' || option.value.startsWith(`${source}:`))
}

export function changeTxFilterSource(filter: TxFilter, source: TxFilter['source']): TxFilter {
  const type = source === 'all' || filter.type.startsWith(`${source}:`) ? filter.type : 'all'
  return { ...filter, source, type }
}

export function activeTxFilterChips(filter: TxFilter): TxFilterChip[] {
  const options = {
    source: TX_SOURCE_OPTIONS,
    balanceChange: TX_BALANCE_CHANGE_OPTIONS,
    type: TX_CORE_TYPE_OPTIONS,
    status: TX_STATUS_OPTIONS,
  }
  const chips: TxFilterChip[] = []
  for (const field of TX_FILTER_CHIP_FIELDS) {
    const value = filter[field]
    if (value === 'all') continue
    const label = options[field].find((option) => option.value === value)?.label
      ?? `Evo: ${platformTransactionTitle(value.slice('platform:'.length))}`
    chips.push({ field, label: `${TX_FILTER_LABELS[field]}: ${label}` })
  }
  return chips
}

export function matchesTxFilter(tx: WalletHistoryItem, filter: TxFilter): boolean {
  if (filter.source !== 'all' && tx.kind !== filter.source) return false
  const balanceChange = tx.amount === 0n || (tx.kind === 'core' && tx.status === 'failed')
    ? TxBalanceChangeFilter.Unchanged
    : BALANCE_CHANGE_BY_DIRECTION[tx.direction]
  if (filter.balanceChange !== TxBalanceChangeFilter.All && balanceChange !== filter.balanceChange) return false
  if (filter.type !== 'all' && tx.type !== filter.type) return false
  if (filter.status !== 'all' && tx.status !== filter.status) return false
  const search = filter.search.trim().toLowerCase()
  const label = stripDpnsInput(search)
  return label === '' || tx.searchValues.some((value) => value?.toLowerCase().includes(search))
    || (tx.searchNames !== undefined && matchesDpnsLabel(tx.searchNames, label))
}

export function filterTransactions(transactions: WalletHistoryItem[], filter: TxFilter): WalletHistoryItem[] {
  return transactions.filter((tx) => matchesTxFilter(tx, filter))
}

export function computeTxTotals(transactions: WalletHistoryItem[]): TxTotals {
  const totals: TxTotals = { receivedCredits: 0n, sentCredits: 0n }
  for (const tx of transactions) {
    if (tx.kind === 'core' && tx.status === 'failed') continue
    const credits = tx.kind === 'core' ? duffsToCredits(tx.amount) : tx.amount
    if (tx.direction === 'in') totals.receivedCredits += credits
    if (tx.direction === 'out') totals.sentCredits += credits
  }
  return totals
}
