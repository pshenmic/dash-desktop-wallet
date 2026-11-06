import { HIGHLIGHTED_IDENTIFIER_CLASS } from './identifier'
import { FIELD_CONTROL_HEIGHT, POPOVER, POPOVER_OPTION } from './surfaces'

const ADDRESS_SELECT_TRIGGER_BASE = 'px-4 flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity'

export const ADDRESS_SELECT_TRIGGER = `w-max rounded-[.875rem] dash-block py-3.5 ${ADDRESS_SELECT_TRIGGER_BASE}`

export const RECEIVE_ADDRESS_SELECT_TRIGGER = `min-w-0 flex-1 ${FIELD_CONTROL_HEIGHT} rounded-l-[.875rem] text-left ${ADDRESS_SELECT_TRIGGER_BASE}`

export const ADDRESS_SELECT_MENU = `absolute left-0 top-[calc(100%+.375rem)] z-30 w-max min-w-full max-h-60 overflow-y-auto ${POPOVER}`

export const ADDRESS_SELECT_OPTION = `w-full flex items-center gap-2.5 text-left ${POPOVER_OPTION}`

export const ADDRESS_SELECT_IDENTIFIER_CLASS = `whitespace-nowrap font-medium! ${HIGHLIGHTED_IDENTIFIER_CLASS}`

export const ADDRESS_SELECT_WRAPPING_IDENTIFIER_CLASS = `min-w-0 text-left font-medium! ${HIGHLIGHTED_IDENTIFIER_CLASS}`

export const ADDRESS_SELECT_SHRINKING = 'min-w-0 max-w-full'
