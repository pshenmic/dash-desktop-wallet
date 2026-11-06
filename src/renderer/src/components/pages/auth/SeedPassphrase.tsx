import { useId, useRef, useState } from 'react'
import { ChevronIcon, InfoTooltip, Input, Text } from '@renderer/components/dash-ui-kit-extended'
import { SEED_PASSPHRASE_COPY } from '@renderer/constants/auth'
import { PASSWORD_FIELD_INPUT_CLASS } from '@renderer/constants/password'
import { CHIP_ACTION } from '@renderer/constants/surfaces'
import type { SeedPassphraseFieldProps, SeedPassphraseProps } from '@renderer/types/auth'

function SeedPassphraseInfo({ path }: Pick<SeedPassphraseProps, 'path'>): React.JSX.Element {
  const copy = SEED_PASSPHRASE_COPY
  return (
    <InfoTooltip
      ariaLabel={copy.infoLabel}
      content={(
        <>
          <p>{copy.info}</p>
          <p className={'mt-1.5'}>{path === 'create' ? copy.createHint : copy.importHint}</p>
        </>
      )}
    />
  )
}

export function SeedPassphraseField({ value, onChange, confirm = false, error, inputRef }: SeedPassphraseFieldProps): React.JSX.Element {
  const id = useId()
  const copy = SEED_PASSPHRASE_COPY

  return (
    <div className={'flex w-full max-w-lg flex-col gap-2'}>
      {confirm ? (
        <div className={'flex items-center gap-1.5'}>
          <label htmlFor={id}>
            <Text size={14} weight={'medium'} color={'brand'}>{copy.confirm}</Text>
          </label>
          <SeedPassphraseInfo path={'create'} />
        </div>
      ) : (
        <label htmlFor={id} className={'sr-only'}>{copy.label}</label>
      )}
      <Input
        ref={inputRef}
        id={id}
        type={'password'}
        value={value}
        placeholder={confirm ? copy.confirmPlaceholder : copy.placeholder}
        onChange={event => onChange(event.target.value)}
        autoComplete={'off'}
        autoCorrect={'off'}
        autoCapitalize={'off'}
        spellCheck={false}
        variant={'outlined'}
        colorScheme={error ? 'error' : 'primary'}
        className={`${PASSWORD_FIELD_INPUT_CLASS} ${error ? '' : 'focus-visible:ring-dash-brand/50! dark:focus-visible:ring-dash-mint/50!'}`}
        passwordToggleLabel={copy.show}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-message` : undefined}
      />
      {error && (
        <div id={`${id}-message`} role={'alert'}>
          <Text size={12} weight={'medium'} color={'red'}>{error}</Text>
        </div>
      )}
    </div>
  )
}

export default function SeedPassphrase({ path, value, onChange }: SeedPassphraseProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const statusId = useId()
  const disclosureRef = useRef<HTMLButtonElement>(null)
  const copy = SEED_PASSPHRASE_COPY

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'flex flex-wrap items-center gap-x-2 gap-y-1'}>
        <button
          ref={disclosureRef}
          type={'button'}
          aria-expanded={open}
          aria-controls={panelId}
          aria-describedby={statusId}
          onClick={() => setOpen(!open)}
          className={'inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md text-left transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint'}
        >
          <Text size={14} weight={'medium'} color={'blue-mint'}>{copy[path]}</Text>
          <ChevronIcon size={10} color={'currentColor'} className={`shrink-0 dash-text-primary transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <SeedPassphraseInfo path={path} />
        <span id={statusId}>
          <Text size={12} weight={'medium'} color={value ? 'blue-mint' : 'brand'} opacity={value ? 100 : 60}>
            {value ? copy.added : copy.optional}
          </Text>
        </span>
        {open && value && (
          <button type={'button'} className={`${CHIP_ACTION} focus-visible:ring-2 focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint`} onClick={() => {
            disclosureRef.current?.focus()
            onChange('')
            setOpen(false)
          }}>
            {copy.remove}
          </button>
        )}
      </div>
      <div id={panelId} hidden={!open}>
        {open && <SeedPassphraseField value={value} onChange={onChange} />}
      </div>
    </div>
  )
}
