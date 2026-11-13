import { useRef, useState } from 'react'
import { Avatar } from 'dash-ui-kit/react'
import { ChevronIcon, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import { useClickOutside } from '@renderer/hooks/useClickOutside'
import {
  ADDRESS_AVATAR_SIZES,
  ADDRESS_BADGED_HIGHLIGHT_CLASSES,
  ADDRESS_HIGHLIGHT_CLASSES,
  ADDRESS_INPUT,
  ADDRESS_INPUT_TEXT_SIZES,
} from '@renderer/constants/addressField'
import { POPOVER, POPOVER_OPTION } from '@renderer/constants/surfaces'
import type { DropdownFieldProps } from '@renderer/types/DropdownField'
import { matchingOptionsByLabel } from '@renderer/utils/ownRecipients'

export default function DropdownField({
  options,
  value,
  onChange,
  ariaLabel,
  triggerClassName,
  textSize = 14,
  renderIcon,
  editable = false,
  placeholder,
  inputInvalid = false,
  inputSuffix,
  menuHeading,
  highlightValue = false,
  valueAvatar = false,
  valueBadge,
  hasExtraMatches,
  toggleIcon,
  onOpenChange,
  children,
}: DropdownFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const trimmedValue = value.trim()
  const selected = options.find((option) => option.value === value || (editable && option.value === trimmedValue))
  const exactMatch = editable && trimmedValue !== '' && options.some((option) => option.value === trimmedValue)
  const labelMatches = editable && !exactMatch ? matchingOptionsByLabel(options, trimmedValue) : []
  const extraMatches = editable && trimmedValue !== '' && !exactMatch && Boolean(hasExtraMatches?.(value))
  const activeBadge = !inputInvalid
    ? (valueBadge?.trim() || selected?.badge?.trim() || undefined)
    : undefined
  const showValue = highlightValue && !focused && trimmedValue !== ''

  let visibleOptions = options
  if (editable && trimmedValue !== '' && !exactMatch) {
    if (labelMatches.length > 0) visibleOptions = labelMatches
    else if (extraMatches) visibleOptions = []
  }

  const changeOpen = (next: boolean): void => {
    setOpen(next)
    onOpenChange?.(next)
  }
  const closeMenu = (): void => {
    if (open) changeOpen(false)
  }

  useClickOutside(ref, closeMenu)

  return (
    <div className="relative" ref={ref} onKeyDown={event => { if (editable && event.key === 'Escape') closeMenu() }}>
      {editable ? <div className={`w-full flex items-center gap-3 ${triggerClassName}`}>
        <div className="relative flex min-w-0 flex-1 items-center gap-2 self-stretch">
          <input
            ref={inputRef}
            type="text"
            aria-label={ariaLabel}
            aria-invalid={inputInvalid}
            value={value}
            onChange={event => {
              const nextValue = event.target.value
              onChange(nextValue)
              const nextTrimmed = nextValue.trim()
              const nextExact = nextTrimmed !== '' && options.some(option => option.value === nextTrimmed)
              const nextLabelMatches = nextExact ? [] : matchingOptionsByLabel(options, nextTrimmed)
              const nextExtraMatches = nextTrimmed !== '' && !nextExact && Boolean(hasExtraMatches?.(nextValue))
              if (nextLabelMatches.length > 0 || nextExtraMatches) {
                if (!open) changeOpen(true)
              } else if (open) {
                changeOpen(false)
              }
            }}
            onFocus={() => {
              setFocused(true)
              if (!exactMatch && (labelMatches.length > 0 || extraMatches) && !open) {
                changeOpen(true)
              }
            }}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[textSize]} ${showValue ? 'absolute inset-0 opacity-0' : ''}`}
          />
          {!showValue && activeBadge && (
            <CustomBadge text={activeBadge} variant="accent" size="xs" className="shrink-0 max-w-40 truncate" />
          )}
          {showValue && <span aria-hidden="true" className="pointer-events-none flex min-w-0 flex-1 items-center gap-2 py-2">
            {valueAvatar && !inputInvalid && <Avatar username={trimmedValue} className={ADDRESS_AVATAR_SIZES[textSize]} />}
            {inputInvalid
              ? <span className={`min-w-0 flex-1 break-all font-normal leading-[1rem] dash-text-default ${ADDRESS_INPUT_TEXT_SIZES[textSize]}`}>{trimmedValue}</span>
              : <>
                  <HighlightedIdentifier className={activeBadge ? ADDRESS_BADGED_HIGHLIGHT_CLASSES[textSize] : ADDRESS_HIGHLIGHT_CLASSES[textSize]}>{trimmedValue}</HighlightedIdentifier>
                  {activeBadge && <CustomBadge text={activeBadge} variant="accent" size="xs" className="shrink-0 max-w-40 truncate" />}
                </>}
          </span>}
        </div>
        {inputSuffix != null && <span className="shrink-0 whitespace-nowrap">{inputSuffix}</span>}
        <button
          type="button"
          aria-label={`Choose ${ariaLabel.toLowerCase()}`}
          aria-expanded={open}
          onClick={() => changeOpen(!open)}
          className="shrink-0 flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
        >
          {toggleIcon ? toggleIcon(open) : <ChevronIcon size={12} color="currentColor" className={`dash-text-default transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />}
        </button>
      </div> : <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => changeOpen(!open)}
        className={`w-full flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity ${triggerClassName}`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {renderIcon?.(value)}
          <Text size={textSize} weight="medium" color="brand" className="truncate">{selected?.label ?? value}</Text>
        </div>
        <ChevronIcon size={12} color="currentColor" className={`dash-text-default shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>}

      {open && (
        <div className={`absolute left-0 right-0 top-[calc(100%+.375rem)] z-30 max-h-60 overflow-y-auto scrollbar-custom ${POPOVER}`}>
          {children}
          {menuHeading && visibleOptions.length > 0 && <div role="heading" aria-level={3} className="px-[.625rem] pt-1.5 pb-2">
            <Text size={12} weight="medium" color="brand" opacity={50}>{menuHeading}</Text>
          </div>}
          {visibleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setFocused(false)
                inputRef.current?.blur()
                closeMenu()
              }}
              className={`w-full flex items-center gap-2.5 text-left ${POPOVER_OPTION} ${option.metadata ? 'flex-wrap' : ''} ${option.value === value ? 'dash-block-accent-5' : ''}`}
            >
              {renderIcon?.(option.value)}
              <div className={`min-w-0 flex flex-col gap-0.5 ${option.metadata ? 'flex-1 basis-56' : ''}`}>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <Text size={textSize} weight="medium" color="brand" className="break-all">{option.label}</Text>
                  {option.badge && <CustomBadge text={option.badge} variant="accent" size="xs" className="shrink-0 max-w-40 truncate" />}
                </div>
                {option.description && <Text size={12} weight="medium" color="brand" opacity={50} className="wrap-anywhere">{option.description}</Text>}
              </div>
              {option.metadata && <div className="ml-auto max-w-full flex flex-col gap-0.5 text-right break-all">
                {option.metadata.map(detail => <Text key={detail} size={12} weight="medium" color="brand" opacity={70}>{detail}</Text>)}
              </div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
