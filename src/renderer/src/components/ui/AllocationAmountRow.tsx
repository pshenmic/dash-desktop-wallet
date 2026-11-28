import { DashLogo } from 'dash-ui-kit/react'
import { Tooltip } from '@renderer/components/dash-ui-kit-extended/tooltip'
import { ALLOCATION_EMPTY_VALUE, ALLOCATION_MAX_CHIP_CLASS, ALLOCATION_MAX_LABEL, SLIDER_STOPS } from '@renderer/constants/allocationAmountRow'
import { useFiat } from '@renderer/hooks/useFiat'
import type { AllocationAmountRowProps } from '@renderer/types/AllocationAmountRow'
import { fiatFieldParts } from '@renderer/utils/fiatField'

export default function AllocationAmountRow({
  id, value, onChange, fiatDuffs, ariaLabel, amountTooltip, invalid = false, disabled = false, centered = false, slider,
}: AllocationAmountRowProps): React.JSX.Element {
  const {format, rateReady, currency} = useFiat()
  const fiat = fiatFieldParts(fiatDuffs > 0n ? format(fiatDuffs) : null, currency)
  const textAlign = centered ? 'text-center' : 'text-left'

  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5">
      <div className={`flex min-w-0 items-center gap-3 rounded-xl border dash-block-5 px-3.5 py-2.5 transition-colors ${invalid ? 'border-dash-red' : 'border-transparent focus-within:border-dash-brand dark:focus-within:border-dash-mint'}`}>
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <Tooltip label={amountTooltip}>
            <input
              id={id}
              type="text"
              inputMode="decimal"
              aria-label={ariaLabel}
              aria-invalid={invalid}
              value={value}
              onChange={event => onChange(event.target.value)}
              disabled={disabled}
              placeholder={ALLOCATION_EMPTY_VALUE}
              className={`w-full min-w-0 bg-transparent ${textAlign} text-base font-bold tabular-nums dash-text-default outline-none placeholder:opacity-30 disabled:cursor-default`}
            />
          </Tooltip>
          <DashLogo size={14} color="currentColor" containerClassName="shrink-0 dash-text-default" />
        </label>
        {rateReady && (
          <span className="flex min-w-[5.25rem] shrink-0 items-center justify-end gap-1 rounded-lg dash-block px-2.5 py-1">
            <span className={`flex-1 ${textAlign} text-xs tabular-nums dash-text-default opacity-60`}>{fiat.value}</span>
            <span className="shrink-0 text-xs font-bold dash-text-default">{fiat.symbol}</span>
          </span>
        )}
        {slider && (
          <button type="button" onClick={slider.onMax} disabled={slider.maxDisabled} title={slider.maxTitle} className={ALLOCATION_MAX_CHIP_CLASS}>
            {ALLOCATION_MAX_LABEL}
          </button>
        )}
      </div>
      {slider && (
        <div className="flex min-w-0 flex-col gap-1 px-0.5" title={slider.title}>
          <div className="relative flex h-5 min-w-0 w-full items-center">
            <progress
              aria-hidden="true"
              value={slider.percent}
              max={100}
              className="pointer-events-none absolute h-1.5 w-full appearance-none overflow-hidden rounded-full border-0 [&::-webkit-progress-bar]:bg-dash-primary-dark-blue/10 dark:[&::-webkit-progress-bar]:bg-white/10 [&::-webkit-progress-value]:bg-dash-brand dark:[&::-webkit-progress-value]:bg-dash-mint"
            />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={slider.percent}
              onChange={event => slider.onPercentChange(Number(event.target.value))}
              disabled={slider.disabled}
              aria-label={slider.label}
              aria-valuetext={slider.valueText}
              className="relative h-5 w-full appearance-none bg-transparent cursor-pointer focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40 disabled:cursor-default disabled:opacity-50 [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-dash-brand [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm dark:[&::-webkit-slider-thumb]:border-dash-mint dark:[&::-webkit-slider-thumb]:bg-dash-primary-dark-blue"
            />
          </div>
          <div className="flex items-center justify-between gap-1">
            {SLIDER_STOPS.map(stop => (
              <button
                key={stop}
                type="button"
                onClick={() => slider.onPercentChange(stop)}
                disabled={slider.disabled}
                className={`rounded-md px-2 py-0.5 text-[.625rem] font-medium tabular-nums transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${slider.percent === stop ? 'dash-block-accent-15 dash-text-primary' : 'dash-text-default opacity-50 hover:opacity-100 hover:dash-block-5'}`}
              >
                {stop}%
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
