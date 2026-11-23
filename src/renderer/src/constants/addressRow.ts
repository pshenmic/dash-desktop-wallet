import { HIGHLIGHTED_IDENTIFIER_CLASS } from './identifier'
import { CHIP_VALUE } from './surfaces'

export const ADDRESS_ROW_IDENTIFIER_CLASS = `min-w-0 text-xs! font-medium! ${HIGHLIGHTED_IDENTIFIER_CLASS}`

export const ADDRESS_ROW_FIAT_CLASS = `${CHIP_VALUE} dash-text-primary font-medium whitespace-nowrap`

export const ADDRESS_ROW_EXPLORER_LABEL = 'Open in explorer'

export const ADDRESS_ROW_EXPORT_KEY_LABEL = 'Export private key'

export const ADDRESS_ROW_ADD_LABEL = 'Add label'

export const ADDRESS_ROW_EDIT_LABEL = 'Edit label'

export const ADDRESS_ROW_LABEL_LOCKED_TOOLTIP = 'Label is managed by a Receive payment request'

export const ADDRESS_ROW_LABEL_PLACEHOLDER = 'Enter label (empty to clear)'

export const ADDRESS_ROW_LABEL_SAVE_ERROR = 'Could not save address label'

export const ADDRESS_ROW_ICON_BUTTON_CLASS = 'size-5 shrink-0 rounded-[.3125rem] flex items-center justify-center dash-block-5 hover:opacity-80 transition-opacity duration-200 cursor-pointer'

export const ADDRESS_ROW_DISABLED_ICON_BUTTON_CLASS = 'size-5 shrink-0 rounded-[.3125rem] flex items-center justify-center dash-block-5 opacity-35 cursor-not-allowed'
