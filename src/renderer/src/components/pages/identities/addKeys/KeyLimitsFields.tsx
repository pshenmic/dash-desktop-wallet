import { useId, useRef } from 'react'
import { CloseIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import {
  KEY_BOUNDS_CLEAR_BUTTON_CLASS,
  KEY_BOUNDS_FIELD_INVALID_CLASS,
  KEY_BOUNDS_FIELD_SHELL_CLASS,
  KEY_BOUNDS_FIELD_VALID_CLASS,
  KEY_BUDGET_INPUT_NO_CLEAR_CLASS,
  KEY_BUDGET_INPUT_WITH_CLEAR_CLASS,
  KEY_BUDGET_MAX_LENGTH,
  KEY_EXPIRY_PRESETS,
  KEY_LIMITS_COPY,
  KEY_LIMITS_DATETIME_INPUT_CLASS,
  KEY_LIMITS_GRID_CLASS,
  KEY_LIMITS_PRESET_BUTTON_CLASS,
  KEY_LIMITS_UNIT_BUTTON_CLASS,
} from '@renderer/constants/identityKeys'
import { KeyBudgetUnit } from '@renderer/enums/IdentityKeys'
import type { KeyLimitsFieldsProps } from '@renderer/types/IdentityKeys'
import { creditsToDash, formatCredits } from '@renderer/utils/balance'

export default function KeyLimitsFields({
  variantLabel,
  draft,
  validation,
  onChange,
  onSelectExpiryPreset,
  onToggleBudgetUnit,
}: KeyLimitsFieldsProps): React.JSX.Element {
  const baseId = useId()
  const budgetInputId = `${baseId}-budget`
  const expiresInputId = `${baseId}-expires`
  const budgetRef = useRef<HTMLInputElement>(null)
  const expiresRef = useRef<HTMLInputElement>(null)
  const isDash = draft.budgetUnit === KeyBudgetUnit.Dash

  let budgetHint: string | null = null
  if (validation.limits?.totalBudget != null) {
    budgetHint = isDash
      ? `${formatCredits(validation.limits.totalBudget)} ${KEY_LIMITS_COPY.unitCredits}`
      : `${creditsToDash(validation.limits.totalBudget)} ${KEY_LIMITS_COPY.unitDash}`
  }

  return (
    <div className={KEY_LIMITS_GRID_CLASS}>
      <div className={'flex min-w-0 flex-col gap-1'}>
        <div className={'flex min-h-5 items-center justify-between gap-2'}>
          <label htmlFor={budgetInputId}>
            <Text size={10} weight={'medium'} color={'brand'} opacity={50}>{KEY_LIMITS_COPY.budgetLabel}</Text>
          </label>
          {budgetHint != null && (
            <Text size={10} weight={'medium'} color={'brand'} opacity={50} className={'text-right tabular-nums'}>
              {budgetHint}
            </Text>
          )}
        </div>
        <div className={`${KEY_BOUNDS_FIELD_SHELL_CLASS} ${validation.totalBudgetError != null ? KEY_BOUNDS_FIELD_INVALID_CLASS : KEY_BOUNDS_FIELD_VALID_CLASS}`}>
          <div className={'relative h-full min-w-0 flex-1'}>
            <input
              ref={budgetRef}
              id={budgetInputId}
              type={'text'}
              inputMode={isDash ? 'decimal' : 'numeric'}
              maxLength={KEY_BUDGET_MAX_LENGTH}
              value={draft.totalBudget}
              onChange={event => onChange({ totalBudget: event.target.value })}
              placeholder={isDash ? KEY_LIMITS_COPY.budgetDashPlaceholder : KEY_LIMITS_COPY.budgetCreditsPlaceholder}
              spellCheck={false}
              autoComplete={'off'}
              aria-label={`${variantLabel} ${KEY_LIMITS_COPY.budgetLabel}`}
              aria-invalid={validation.totalBudgetError != null}
              className={draft.totalBudget !== '' ? KEY_BUDGET_INPUT_WITH_CLEAR_CLASS : KEY_BUDGET_INPUT_NO_CLEAR_CLASS}
            />
            {draft.totalBudget !== '' && (
              <button
                type={'button'}
                aria-label={KEY_LIMITS_COPY.clearBudget}
                title={KEY_LIMITS_COPY.clearBudget}
                onClick={() => {
                  onChange({ totalBudget: '' })
                  budgetRef.current?.focus()
                }}
                className={KEY_BOUNDS_CLEAR_BUTTON_CLASS}
              >
                <CloseIcon size={10} />
              </button>
            )}
          </div>
          <button
            type={'button'}
            onClick={onToggleBudgetUnit}
            aria-label={KEY_LIMITS_COPY.toggleBudgetUnit}
            title={KEY_LIMITS_COPY.toggleBudgetUnit}
            className={KEY_LIMITS_UNIT_BUTTON_CLASS}
          >
            {isDash ? KEY_LIMITS_COPY.unitDash : KEY_LIMITS_COPY.unitCredits}
          </button>
        </div>
        {validation.totalBudgetError != null && (
          <Text size={10} weight={'medium'} color={'red'}>{validation.totalBudgetError}</Text>
        )}
      </div>
      <div className={'flex min-w-0 flex-col gap-1'}>
        <div className={'flex min-h-5 items-center justify-between gap-2'}>
          <label htmlFor={expiresInputId}>
            <Text size={10} weight={'medium'} color={'brand'} opacity={50}>{KEY_LIMITS_COPY.expiresAtLabel}</Text>
          </label>
          <div className={'flex flex-wrap items-center gap-1'}>
            {KEY_EXPIRY_PRESETS.map(preset => (
              <button
                key={preset.label}
                type={'button'}
                aria-label={`${variantLabel} ${KEY_LIMITS_COPY.expiresAtLabel} ${preset.label}`}
                onClick={() => onSelectExpiryPreset(preset.durationMs)}
                className={KEY_LIMITS_PRESET_BUTTON_CLASS}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div className={`${KEY_BOUNDS_FIELD_SHELL_CLASS} ${validation.expiresAtError != null ? KEY_BOUNDS_FIELD_INVALID_CLASS : KEY_BOUNDS_FIELD_VALID_CLASS}`}>
          <input
            ref={expiresRef}
            id={expiresInputId}
            type={'datetime-local'}
            value={draft.expiresAt}
            onChange={event => onChange({ expiresAt: event.target.value })}
            aria-label={`${variantLabel} ${KEY_LIMITS_COPY.expiresAtLabel}`}
            aria-invalid={validation.expiresAtError != null}
            className={KEY_LIMITS_DATETIME_INPUT_CLASS}
          />
          {draft.expiresAt !== '' && (
            <button
              type={'button'}
              aria-label={KEY_LIMITS_COPY.clearExpiresAt}
              title={KEY_LIMITS_COPY.clearExpiresAt}
              onClick={() => {
                onChange({ expiresAt: '' })
                expiresRef.current?.focus()
              }}
              className={'mr-1.5 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md dash-text-default opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-dash-brand dark:focus-visible:outline-dash-mint'}
            >
              <CloseIcon size={10} />
            </button>
          )}
        </div>
        {validation.expiresAtError != null && (
          <Text size={10} weight={'medium'} color={'red'}>{validation.expiresAtError}</Text>
        )}
      </div>
    </div>
  )
}
