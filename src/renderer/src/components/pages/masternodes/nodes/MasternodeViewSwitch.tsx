import { Tooltip } from '@renderer/components/dash-ui-kit-extended'
import { CardsViewIcon, ListViewIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import { NODE_CARD_COPY } from '@renderer/constants/masternodeNodes'
import { MasternodeViewMode } from '@renderer/enums/Masternodes'
import type { MasternodeViewSwitchProps } from '@renderer/types/MasternodeNodes'

const VIEW_MODE_ITEMS = [
  { value: MasternodeViewMode.Cards, label: NODE_CARD_COPY.cardsViewLabel, Icon: CardsViewIcon },
  { value: MasternodeViewMode.List, label: NODE_CARD_COPY.listViewLabel, Icon: ListViewIcon },
] as const

export default function MasternodeViewSwitch({
  value,
  onChange,
}: MasternodeViewSwitchProps): React.JSX.Element {
  return (
    <div
      role={'group'}
      aria-label={NODE_CARD_COPY.viewModeLabel}
      className={'inline-flex items-center gap-1 rounded-[.75rem] bg-dash-control-background p-1 dark:bg-white/5 dash-black-border'}
    >
      {VIEW_MODE_ITEMS.map(({ value: optionValue, label, Icon }) => {
        const active = value === optionValue
        return (
          <Tooltip key={optionValue} label={label}>
            <button
              type={'button'}
              aria-label={label}
              aria-pressed={active}
              onClick={() => onChange(optionValue)}
              className={`flex size-7 items-center justify-center rounded-[.5rem] transition-colors duration-150 cursor-pointer ${
                active
                  ? 'bg-dash-brand text-white dark:bg-dash-mint/20 dark:text-dash-mint'
                  : 'dash-text-default opacity-50 hover:opacity-100 hover:bg-dash-primary-dark-blue/5 dark:hover:bg-white/5'
              }`}
            >
              <Icon size={15} color={'currentColor'} />
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}
