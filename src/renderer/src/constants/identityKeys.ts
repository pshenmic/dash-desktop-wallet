import type { IdentityKeyRequestDto } from '@renderer/api/types'
import { IdentityKeyAction, IdentityKeyDashPayImpact, IdentityKeyPurpose, IdentityKeySecurityLevel, IdentityKeyVariant, KeyBudgetUnit } from '@renderer/enums/IdentityKeys'
import type { IdentityKeyNotice, IdentityKeyUpdateCopy, IdentityKeyVariantDefinition, KeyLimitsDraft, KeyLimitsPreset, KeyVariantGroup } from '@renderer/types/IdentityKeys'
import { DAY_MS } from './timeLeft'

export const IDENTITY_KEY_TYPE_ECDSA = 'ECDSA_SECP256K1'

export const IDENTITY_KEY_LABEL_SEPARATOR = ' · '

export const DASHPAY_BOUNDS_LABEL = 'DashPay'

const DASHPAY_BOUND_CAPTION = 'Bound to DashPay contact requests'

const UNBOUND_CAPTION = 'Not bound'

// Platform v14 forbids budget/expiry limits on MASTER, ENCRYPTION, DECRYPTION, and TRANSFER keys.
export const IDENTITY_KEY_VARIANTS: Record<IdentityKeyVariant, IdentityKeyVariantDefinition> = {
  [IdentityKeyVariant.EncDashPay]: { variant: IdentityKeyVariant.EncDashPay, purpose: IdentityKeyPurpose.Encryption, securityLevel: IdentityKeySecurityLevel.Medium, dashPayBound: true, canBind: false, canLimit: false, caption: DASHPAY_BOUND_CAPTION },
  [IdentityKeyVariant.DecDashPay]: { variant: IdentityKeyVariant.DecDashPay, purpose: IdentityKeyPurpose.Decryption, securityLevel: IdentityKeySecurityLevel.Medium, dashPayBound: true, canBind: false, canLimit: false, caption: DASHPAY_BOUND_CAPTION },
  [IdentityKeyVariant.AuthCritical]: { variant: IdentityKeyVariant.AuthCritical, purpose: IdentityKeyPurpose.Authentication, securityLevel: IdentityKeySecurityLevel.Critical, dashPayBound: false, canBind: true, canLimit: true, caption: UNBOUND_CAPTION },
  [IdentityKeyVariant.AuthHigh]: { variant: IdentityKeyVariant.AuthHigh, purpose: IdentityKeyPurpose.Authentication, securityLevel: IdentityKeySecurityLevel.High, dashPayBound: false, canBind: true, canLimit: true, caption: UNBOUND_CAPTION },
  [IdentityKeyVariant.AuthMedium]: { variant: IdentityKeyVariant.AuthMedium, purpose: IdentityKeyPurpose.Authentication, securityLevel: IdentityKeySecurityLevel.Medium, dashPayBound: false, canBind: true, canLimit: true, caption: UNBOUND_CAPTION },
  [IdentityKeyVariant.Enc]: { variant: IdentityKeyVariant.Enc, purpose: IdentityKeyPurpose.Encryption, securityLevel: IdentityKeySecurityLevel.Medium, dashPayBound: false, canBind: true, canLimit: false, caption: UNBOUND_CAPTION },
  [IdentityKeyVariant.Dec]: { variant: IdentityKeyVariant.Dec, purpose: IdentityKeyPurpose.Decryption, securityLevel: IdentityKeySecurityLevel.Medium, dashPayBound: false, canBind: true, canLimit: false, caption: UNBOUND_CAPTION },
  [IdentityKeyVariant.Transfer]: { variant: IdentityKeyVariant.Transfer, purpose: IdentityKeyPurpose.Transfer, securityLevel: IdentityKeySecurityLevel.Critical, dashPayBound: false, canBind: false, canLimit: false, caption: 'Credit transfers and withdrawals' },
}

export const CONTRACT_ID_BYTE_LENGTH = 32

export const CONTRACT_ID_MAX_LENGTH = 44

export const DOCUMENT_TYPE_MAX_LENGTH = 64

export const DOCUMENT_TYPE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export const EMPTY_KEY_BOUNDS_DRAFT = {
  contractId: '',
  documentType: '',
} as const

export const KEY_BOUNDS_COPY = {
  boundPrefix: 'Bound to',
  contractIdLabel: 'Contract ID (optional)',
  contractIdPlaceholder: 'All contracts if empty',
  documentTypeLabel: 'Document type (optional)',
  documentTypePlaceholder: 'All document types',
  clearContractId: 'Clear contract ID',
  clearDocumentType: 'Clear document type',
  contractIdRequired: 'Enter a contract ID to bind a document type',
  invalidContractId: 'Enter a valid 32-byte Base58 contract ID',
  invalidDocumentType: 'Use letters, numbers, hyphens, or underscores (max 64)',
} as const

export const KEY_BOUNDS_GRID_CLASS = 'ml-8 grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]'

export const KEY_BOUNDS_FIELD_SHELL_CLASS = 'relative flex h-9 min-w-0 items-center rounded-[.625rem] border bg-white dark:bg-white/6 transition-colors'

export const KEY_BOUNDS_FIELD_VALID_CLASS = 'border-dash-primary-dark-blue/12 dark:border-white/14 focus-within:border-dash-brand dark:focus-within:border-dash-mint'

export const KEY_BOUNDS_FIELD_INVALID_CLASS = 'border-dash-red'

export const KEY_BOUNDS_INPUT_CLASS = 'h-full w-full min-w-0 bg-transparent pl-3 pr-8 text-xs dash-text-default outline-none placeholder:opacity-40'

export const KEY_BOUNDS_CLEAR_BUTTON_CLASS = 'absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md dash-text-default opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-dash-brand dark:focus-visible:outline-dash-mint'

export const MAX_KEY_BUDGET_CREDITS = 18_446_744_073_709_551_615n

export const KEY_BUDGET_MAX_LENGTH = 24

export const KEY_BUDGET_DASH_PATTERN = /^(?:\d+(?:\.\d{1,11})?|\.\d{1,11})$/

export const KEY_BUDGET_CREDITS_PATTERN = /^\d+$/

export const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

export const EMPTY_KEY_LIMITS_DRAFT: KeyLimitsDraft = {
  totalBudget: '',
  budgetUnit: KeyBudgetUnit.Dash,
  expiresAt: '',
} as const

export const KEY_EXPIRY_PRESETS: KeyLimitsPreset[] = [
  { label: '24h', durationMs: DAY_MS },
  { label: '7d', durationMs: 7 * DAY_MS },
  { label: '30d', durationMs: 30 * DAY_MS },
  { label: '90d', durationMs: 90 * DAY_MS },
]

export const KEY_LIMITS_COPY = {
  budgetLabel: 'Total budget (optional)',
  budgetDashPlaceholder: 'Unlimited (e.g. 0.1)',
  budgetCreditsPlaceholder: 'Unlimited credits',
  expiresAtLabel: 'Expires at (optional)',
  unitDash: 'Dash',
  unitCredits: 'credits',
  toggleBudgetUnit: 'Switch budget unit',
  clearBudget: 'Clear total budget',
  clearExpiresAt: 'Clear expiration',
  invalidBudgetDash: 'Enter a positive Dash amount (up to 11 decimals)',
  invalidBudgetCredits: 'Enter a positive whole number of credits',
  budgetTooLarge: 'Exceeds maximum 64-bit credit budget',
  invalidExpiresAt: 'Enter a valid expiration date and time',
  expiredExpiresAt: 'Expiration must be in the future',
  maxPrefix: 'Max',
  untilPrefix: 'Until',
} as const

export const KEY_BELOW_STACK_CLASS = 'flex flex-col gap-2.5'

export const KEY_LIMITS_GRID_CLASS = 'ml-8 grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]'

export const KEY_BUDGET_INPUT_WITH_CLEAR_CLASS = 'h-full w-full min-w-0 bg-transparent pl-3 pr-8 text-xs tabular-nums dash-text-default outline-none placeholder:opacity-40'

export const KEY_BUDGET_INPUT_NO_CLEAR_CLASS = 'h-full w-full min-w-0 bg-transparent pl-3 pr-2 text-xs tabular-nums dash-text-default outline-none placeholder:opacity-40'

export const KEY_LIMITS_DATETIME_INPUT_CLASS = 'h-full w-full min-w-0 bg-transparent pl-3 pr-2 text-xs tabular-nums dash-text-default outline-none dark:scheme-dark'

export const KEY_LIMITS_UNIT_BUTTON_CLASS = 'mr-1.5 shrink-0 cursor-pointer rounded-md dash-block-accent-10 px-2 py-1 text-[.6875rem] font-medium leading-none dash-text-primary transition-colors hover:dash-block-accent-15 focus-visible:outline-2 focus-visible:outline-dash-brand dark:focus-visible:outline-dash-mint'

export const KEY_LIMITS_PRESET_BUTTON_CLASS = 'cursor-pointer rounded-md dash-block-5 px-2 py-0.5 text-[.625rem] font-medium dash-text-default opacity-75 transition-colors hover:dash-block-accent-10 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-dash-brand dark:focus-visible:outline-dash-mint'

export const IDENTITY_KEY_PURPOSE_LABELS: Record<string, string> = {
  AUTHENTICATION: 'Authentication',
  ENCRYPTION: 'Encryption',
  DECRYPTION: 'Decryption',
  TRANSFER: 'Transfer',
}

export const IDENTITY_KEY_LEVEL_LABELS: Record<string, string> = {
  MASTER: 'Master',
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
}

export const IDENTITY_KEY_TYPE_LABELS: Record<string, string> = {
  ECDSA_SECP256K1: 'ECDSA secp256k1',
  BLS12_381: 'BLS12-381',
  ECDSA_HASH160: 'ECDSA hash160',
  BIP13_SCRIPT_HASH: 'BIP13 script hash',
  EDDSA_25519_HASH160: 'EdDSA 25519 hash160',
}

export const IDENTITY_KEY_TABLE_GRID = 'grid-cols-[2.5rem_minmax(0,1.05fr)_minmax(0,.75fr)_minmax(0,.95fr)_minmax(0,1.45fr)_minmax(0,1.15fr)_5.5rem_5rem]'

export const KEYS_TABLE_MIN_WIDTH_CLASS = 'min-w-[52rem]'

export const IDENTITY_KEYS_PER_TRANSITION = 6

export const KEY_COUNT_COPY = {
  of: 'of',
  selected: 'selected',
  upTo: 'Up to',
  perTransition: 'keys per transaction',
  limitReached: '· limit per transaction',
  onIdentity: 'on identity',
  key: 'key',
  keys: 'keys',
  keyAdded: 'key added',
  keysAdded: 'keys added',
  idPrefix: '#',
} as const

export const IDENTITY_KEYS_COPY = {
  title: 'Keys',
  addKeys: 'Add keys',
  active: 'Active',
  expired: 'Expired',
  disabled: 'Disabled',
  unbound: '—',
  empty: 'No keys on this identity',
  privateKeys: 'Private keys',
} as const

export const KEYS_TABLE_HEADERS = ['#', 'Purpose', 'Level', 'Type', 'Bound to', 'Limits', 'Status', '']

export const KEYS_FACT_ROW_CLASS = 'flex items-center justify-between gap-4'

export const KEYS_FACT_DIVIDER_CLASS = 'h-px bg-dash-primary-dark-blue/8 dark:bg-white/8'

export const KEYS_SIGNED_COPY = {
  identityBalance: 'Identity balance',
  balanceAfter: 'Balance after',
  hashLabel: 'State transition hash',
  pending: 'Adding keys…',
} as const

export const ADD_KEYS_COPY = {
  identityLabel: 'For identity',
  keysStep: 'Keys',
  confirmStep: 'Confirm',
  submit: 'Create keys',
  recommended: 'Recommended',
  fee: 'Fee',
  identity: 'Identity',
  keys: 'Keys',
  modalTitle: 'Create identity keys',
  missingIdentity: 'This identity is no longer in this wallet',
  backToIdentities: 'Back to identities',
} as const

export const KEY_VARIANT_GROUPS: KeyVariantGroup[] = [
  { dashPayBound: true, label: 'DashPay', definitions: Object.values(IDENTITY_KEY_VARIANTS).filter(definition => definition.dashPayBound) },
  { dashPayBound: false, label: 'Other keys', definitions: Object.values(IDENTITY_KEY_VARIANTS).filter(definition => !definition.dashPayBound) },
]

export const KEY_VARIANT_ORDER = Object.keys(IDENTITY_KEY_VARIANTS) as IdentityKeyVariant[]

export const MASTER_KEY_REQUEST: IdentityKeyRequestDto = {
  purpose: IdentityKeyPurpose.Authentication,
  securityLevel: IdentityKeySecurityLevel.Master,
  contractBounds: null,
}

export const IDENTITY_KEY_UPDATE_COPY: Record<IdentityKeyAction, IdentityKeyUpdateCopy> = {
  [IdentityKeyAction.Disable]: {
    action: 'Disable',
    title: 'Disable identity key',
    submit: 'Disable key',
    pending: 'Disabling key…',
    done: 'Key disabled',
    warningTitle: 'Disabling is permanent',
    warning: 'Platform can’t enable a disabled key again.',
  },
  [IdentityKeyAction.ReplaceMaster]: {
    action: 'Replace',
    title: 'Replace master key',
    submit: 'Replace key',
    pending: 'Replacing master key…',
    done: 'Master key replaced',
    warningTitle: 'The current master key is disabled for good',
    warning: 'A new master key from this wallet takes its place and signs the identity’s future updates.',
  },
}

export const IDENTITY_KEY_UPDATE_LABELS = {
  changes: 'Changes',
  disable: 'Disable',
  add: 'Add',
  fee: 'Fee',
} as const

export const DASHPAY_RECIPIENT_KEY_PURPOSES: string[] = [
  IdentityKeyPurpose.Decryption,
  IdentityKeyPurpose.Encryption,
  IdentityKeyPurpose.Authentication,
  IdentityKeyPurpose.Transfer,
]

export const IDENTITY_KEY_DASHPAY_IMPACT_COPY: Record<IdentityKeyDashPayImpact, IdentityKeyNotice> = {
  [IdentityKeyDashPayImpact.StopsDashPay]: {
    title: 'DashPay will stop working for this identity',
    description: 'DashPay needs a key like this one. Contacts whose requests were encrypted to it can’t pay you until they send a new request.',
  },
  [IdentityKeyDashPayImpact.ContactRequests]: {
    title: 'Some contacts may no longer pay you',
    description: 'Contact requests encrypted to this key stop working once it’s disabled. Those contacts need to send you a new request.',
  },
}

export const PRIVATE_KEYS_COPY = {
  title: 'Identity private keys',
  warningTitle: 'Anyone with these keys controls this identity',
  warning: 'Never share them or paste them into a website.',
  reveal: 'Reveal keys',
  revealing: 'Revealing…',
  cancel: 'Cancel',
  close: 'Close',
  wif: 'WIF',
  hex: 'Hex',
  notDerived: 'Added by another wallet — this wallet can’t derive it',
} as const
