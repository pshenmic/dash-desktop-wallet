import { Text } from '@renderer/components/dash-ui-kit-extended'
import { ADDRESS_INPUT, ADDRESS_INPUT_TEXT_SIZES, FIELD_INVALID } from '@renderer/constants/addressField'
import { FIELD_COMPACT } from '@renderer/constants/surfaces'
import type { MasternodeFieldInputProps } from '@renderer/types/MasternodeNodes'

export default function MasternodeFieldInput({
  value,
  onChange,
  ariaLabel,
  placeholder,
  maxLength,
  invalid = false,
  tabular = false,
  disabled = false,
  suffix,
}: MasternodeFieldInputProps): React.JSX.Element {
  return (
    <div className={`w-full min-h-[3.25rem] flex items-center gap-2 ${FIELD_COMPACT} ${invalid ? FIELD_INVALID : ''}`}>
      <div className={'relative flex min-w-0 flex-1 items-center self-stretch'}>
        <input
          type={'text'}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          maxLength={maxLength}
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]} self-stretch ${tabular ? 'tabular-nums' : ''}`}
        />
      </div>
      {suffix != null && (
        <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'shrink-0'}>
          {suffix}
        </Text>
      )}
    </div>
  )
}
