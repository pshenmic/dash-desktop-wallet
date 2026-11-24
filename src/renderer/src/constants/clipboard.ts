import { FIELD_CONTROL_HEIGHT } from './surfaces'

export const CLIPBOARD_COPY = {
  copied: 'Copied to clipboard',
} as const

export const COPY_BUTTON_SIZES = {
  compact: { button: 'size-5 rounded-[.3125rem] dash-block-5', icon: 10, opacity: 'opacity-50' },
  field: {
    button: `${FIELD_CONTROL_HEIGHT} relative aspect-square shrink-0 rounded-r-[.875rem] hover:dash-block-5 before:pointer-events-none before:absolute before:inset-y-3 before:left-0 before:border-l before:border-dash-primary-dark-blue/10 dark:before:border-white/12`,
    icon: 16,
    opacity: 'opacity-60',
  },
} as const
