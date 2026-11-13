import { useImperativeHandle, useRef } from 'react'
import { CloseIcon, Input, SearchIcon } from '@renderer/components/dash-ui-kit-extended'
import { SEARCH_CLEAR_LABEL } from '@renderer/constants/listToolbar'
import type { SearchFieldProps } from '@renderer/types/SearchField'

export default function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  autoFocus = false,
  className = '',
  inputClassName = 'h-9 py-0! rounded-[.625rem]! dash-block',
  onKeyDown,
  ref,
}: SearchFieldProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => inputRef.current!, [])

  return (
    <div className={`relative ${className}`}>
      <Input
        ref={inputRef}
        type={'search'}
        size={'sm'}
        variant={'filled'}
        colorScheme={'light'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        className={`${inputClassName} pr-10! focus-visible:ring-2! focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint [&::-webkit-search-cancel-button]:hidden`}
        prefix={<SearchIcon size={14} color={'currentColor'} className={'dash-text-default'} />}
      />
      {value !== '' && (
        <button
          type={'button'}
          aria-label={SEARCH_CLEAR_LABEL}
          title={SEARCH_CLEAR_LABEL}
          onClick={() => {
            inputRef.current?.focus()
            onChange('')
          }}
          className={'absolute right-2 top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md dash-text-default opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-dash-brand dark:focus-visible:outline-dash-mint'}
        >
          <CloseIcon size={10} />
        </button>
      )}
    </div>
  )
}
