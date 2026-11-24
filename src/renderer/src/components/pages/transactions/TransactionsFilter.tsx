import { useRef, useState } from 'react'
import { Text, FilterIcon } from '@renderer/components/dash-ui-kit-extended'
import { transactionsPage } from '@renderer/constants'
import { TOOLBAR_CONTROL_CLASS } from '@renderer/constants/listToolbar'
import { useClickOutside } from '@renderer/hooks/useClickOutside'
import { changeTxFilterSource, transactionTypeOptions } from '@renderer/utils/transactionFilters'
import type { FilterSectionProps, TransactionsFilterProps } from '@renderer/types/WalletTransaction'
import { TX_BALANCE_CHANGE_OPTIONS, TX_FILTER_LABELS, TX_SOURCE_OPTIONS } from '@renderer/constants/transactionFilters'
import { POPOVER, POPOVER_OPTION } from '@renderer/constants/surfaces'

function FilterSection<T extends string>({ label, options, selected, onSelect }: FilterSectionProps<T>): React.JSX.Element {
  return (
    <div className={"flex flex-col gap-[.125rem]"}>
      <Text size={10} weight={"medium"} color={"brand"} opacity={40} transform={"uppercase"} className={"tracking-[.08em] px-[.625rem] py-1"}>
        {label}
      </Text>
      {options.map((option) => (
        <button
          key={option.value}
          type={"button"}
          aria-pressed={option.value === selected}
          onClick={() => onSelect(option.value)}
          className={`w-full flex items-center text-left ${POPOVER_OPTION} ${option.value === selected ? 'dash-block-accent-5' : ''}`}
        >
          <Text size={12} weight={"medium"} color={"brand"}>{option.label}</Text>
        </button>
      ))}
    </div>
  )
}

export default function TransactionsFilter(props: TransactionsFilterProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const { filter: filterLabel, filters } = transactionsPage.transactions

  return (
    <div className={"relative shrink-0"} ref={ref}>
      <button
        type={"button"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 ${TOOLBAR_CONTROL_CLASS} cursor-pointer hover:opacity-80 transition-opacity duration-200 focus-visible:outline-2 focus-visible:outline-dash-brand dark:focus-visible:outline-dash-mint`}
      >
        <FilterIcon size={12} color={"currentColor"} className={"dash-text-primary"} />
        <Text size={12} weight={"medium"} color={"brand"}>{filterLabel}</Text>
        {props.active && <span className={"size-1.5 rounded-full bg-dash-brand dark:bg-dash-mint"} />}
      </button>

      {open && (
        <div className={`absolute right-0 top-[calc(100%+.375rem)] z-30 w-64 max-h-[65vh] overflow-y-auto flex flex-col gap-2 ${POPOVER}`}>
          <FilterSection
            label={TX_FILTER_LABELS.source}
            options={TX_SOURCE_OPTIONS}
            selected={props.filter.source}
            onSelect={(source) => props.onChange(changeTxFilterSource(props.filter, source))}
          />
          <FilterSection
            label={TX_FILTER_LABELS.balanceChange}
            options={TX_BALANCE_CHANGE_OPTIONS}
            selected={props.filter.balanceChange}
            onSelect={(balanceChange) => props.onChange({ ...props.filter, balanceChange })}
          />
          <FilterSection
            label={filters.type.label}
            options={transactionTypeOptions(props.transactions, props.filter.source)}
            selected={props.filter.type}
            onSelect={(type) => props.onChange({ ...props.filter, type })}
          />
        </div>
      )}
    </div>
  )
}
