import { base58 } from '@scure/base'
import type { IdentityKeyBoundsDto, IdentityKeyDto, IdentityKeyRequestDto } from '@renderer/api/types'
import { DASH_UNIT } from '@renderer/constants/balance'
import { DASHPAY_CONTRACT_ID, DASHPAY_KEY_BOUNDS } from '@renderer/constants/dashPay'
import {
  CONTRACT_ID_BYTE_LENGTH,
  DASHPAY_BOUNDS_LABEL,
  DOCUMENT_TYPE_PATTERN,
  EMPTY_KEY_BOUNDS_DRAFT,
  EMPTY_KEY_LIMITS_DRAFT,
  IDENTITY_KEY_LABEL_SEPARATOR,
  IDENTITY_KEY_LEVEL_LABELS,
  IDENTITY_KEY_PURPOSE_LABELS,
  IDENTITY_KEY_VARIANTS,
  IDENTITY_KEYS_PER_TRANSITION,
  KEY_BOUNDS_COPY,
  KEY_BUDGET_CREDITS_PATTERN,
  KEY_BUDGET_DASH_PATTERN,
  KEY_COUNT_COPY,
  KEY_LIMITS_COPY,
  LOCAL_DATETIME_PATTERN,
  MAX_KEY_BUDGET_CREDITS,
} from '@renderer/constants/identityKeys'
import { KeyBudgetUnit, type IdentityKeyVariant } from '@renderer/enums/IdentityKeys'
import type {
  IdentityKeyLimits,
  KeyBoundsDraftMap,
  KeyBoundsLabel,
  KeyContractBoundsDraft,
  KeyContractBoundsValidation,
  KeyLimitsDraft,
  KeyLimitsDraftMap,
  KeyLimitsValidation,
  KeySelectionCheck,
} from '@renderer/types/IdentityKeys'
import { creditsToDash, dashToCredits } from './balance'
import { formatTimestamp } from './date'
import { isIdentityKeyUsable } from './identities'

function isDashPayContract(bounds: IdentityKeyBoundsDto | null): boolean {
  return bounds?.contractId === DASHPAY_CONTRACT_ID
}

function isDashPayKeyBounds(bounds: IdentityKeyBoundsDto | null): boolean {
  return bounds?.contractId === DASHPAY_KEY_BOUNDS.contractId
    && bounds.documentType === DASHPAY_KEY_BOUNDS.documentType
}

export function isValidContractId(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return false
  try {
    return base58.decode(trimmed).length === CONTRACT_ID_BYTE_LENGTH
  } catch {
    return false
  }
}

export function isValidDocumentType(value: string): boolean {
  return DOCUMENT_TYPE_PATTERN.test(value.trim())
}

export function validateKeyContractBounds(draft: KeyContractBoundsDraft = EMPTY_KEY_BOUNDS_DRAFT): KeyContractBoundsValidation {
  const contractId = draft.contractId.trim()
  const documentType = draft.documentType.trim()
  if (contractId === '' && documentType === '') {
    return { bounds: null, contractIdError: null, documentTypeError: null, valid: true }
  }
  let contractIdError: string | null = null
  if (contractId === '') contractIdError = KEY_BOUNDS_COPY.contractIdRequired
  else if (!isValidContractId(contractId)) contractIdError = KEY_BOUNDS_COPY.invalidContractId
  const documentTypeError = documentType !== '' && !isValidDocumentType(documentType) ? KEY_BOUNDS_COPY.invalidDocumentType : null
  const valid = contractIdError == null && documentTypeError == null
  return {
    bounds: valid ? { contractId, documentType: documentType === '' ? null : documentType } : null,
    contractIdError,
    documentTypeError,
    valid,
  }
}

export function formatLocalDateTimeInput(timestampMs: number): string {
  if (!Number.isFinite(timestampMs)) return ''
  const date = new Date(timestampMs)
  const year = date.getFullYear()
  if (!Number.isFinite(date.getTime()) || year < 0 || year > 9999) return ''
  const pad2 = (value: number): string => String(value).padStart(2, '0')
  return `${String(year).padStart(4, '0')}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function parseLocalDateTimeInput(value: string): number | null {
  const match = LOCAL_DATETIME_PATTERN.exec(value.trim())
  if (match == null) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hours = Number(match[4])
  const minutes = Number(match[5])
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0)
  if (
    !Number.isFinite(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== hours
    || date.getMinutes() !== minutes
  ) {
    return null
  }
  return date.getTime()
}

export function parseKeyBudgetCredits(value: string, unit: KeyBudgetUnit): { credits: bigint | null; error: string | null } {
  const trimmed = value.trim()
  if (trimmed === '') return { credits: null, error: null }
  if (unit === KeyBudgetUnit.Dash) {
    if (!KEY_BUDGET_DASH_PATTERN.test(trimmed)) return { credits: null, error: KEY_LIMITS_COPY.invalidBudgetDash }
    const credits = dashToCredits(trimmed)
    if (credits == null || credits <= 0n) return { credits: null, error: KEY_LIMITS_COPY.invalidBudgetDash }
    if (credits > MAX_KEY_BUDGET_CREDITS) return { credits: null, error: KEY_LIMITS_COPY.budgetTooLarge }
    return { credits, error: null }
  }
  if (!KEY_BUDGET_CREDITS_PATTERN.test(trimmed)) return { credits: null, error: KEY_LIMITS_COPY.invalidBudgetCredits }
  const credits = BigInt(trimmed)
  if (credits <= 0n) return { credits: null, error: KEY_LIMITS_COPY.invalidBudgetCredits }
  if (credits > MAX_KEY_BUDGET_CREDITS) return { credits: null, error: KEY_LIMITS_COPY.budgetTooLarge }
  return { credits, error: null }
}

export function convertBudgetDraftUnit(value: string, fromUnit: KeyBudgetUnit, toUnit: KeyBudgetUnit): string {
  if (fromUnit === toUnit) return value
  const trimmed = value.trim()
  if (trimmed === '') return ''
  const { credits } = parseKeyBudgetCredits(trimmed, fromUnit)
  if (credits == null) return value
  return toUnit === KeyBudgetUnit.Dash ? creditsToDash(credits) : credits.toString()
}

export function validateKeyLimits(draft: KeyLimitsDraft = EMPTY_KEY_LIMITS_DRAFT, now: number = Date.now()): KeyLimitsValidation {
  const totalBudgetText = draft.totalBudget.trim()
  const expiresAtText = draft.expiresAt.trim()
  if (totalBudgetText === '' && expiresAtText === '') {
    return { limits: null, totalBudgetError: null, expiresAtError: null, valid: true }
  }
  const budget = parseKeyBudgetCredits(totalBudgetText, draft.budgetUnit)
  let expiresAt: number | null = null
  let expiresAtError: string | null = null
  if (expiresAtText !== '') {
    const parsedExpiresAt = parseLocalDateTimeInput(expiresAtText)
    if (parsedExpiresAt == null) expiresAtError = KEY_LIMITS_COPY.invalidExpiresAt
    else if (parsedExpiresAt <= now) expiresAtError = KEY_LIMITS_COPY.expiredExpiresAt
    else expiresAt = parsedExpiresAt
  }
  const valid = budget.error == null && expiresAtError == null
  const limits = valid && (budget.credits != null || expiresAt != null)
    ? { totalBudget: budget.credits, expiresAt }
    : null
  return {
    limits,
    totalBudgetError: budget.error,
    expiresAtError,
    valid,
  }
}

export function keyLimitsSummaryParts(keyOrRequest: { totalBudget?: bigint | null; expiresAt?: number | null } | null | undefined): string[] {
  if (keyOrRequest == null) return []
  const parts: string[] = []
  if (keyOrRequest.totalBudget != null) {
    parts.push(`${KEY_LIMITS_COPY.maxPrefix} ${creditsToDash(keyOrRequest.totalBudget)} ${DASH_UNIT}`)
  }
  if (keyOrRequest.expiresAt != null) {
    parts.push(`${KEY_LIMITS_COPY.untilPrefix} ${formatTimestamp(new Date(keyOrRequest.expiresAt))}`)
  }
  return parts
}

export function keyLabel(value: string, labels: Record<string, string>): string {
  return labels[value.toUpperCase()] ?? value
}

export function variantRequest(
  variant: IdentityKeyVariant,
  customBounds: IdentityKeyBoundsDto | null = null,
  customLimits: IdentityKeyLimits | null = null,
): IdentityKeyRequestDto {
  const definition = IDENTITY_KEY_VARIANTS[variant]
  let contractBounds: IdentityKeyBoundsDto | null = null
  if (definition.dashPayBound) contractBounds = { ...DASHPAY_KEY_BOUNDS }
  else if (definition.canBind && customBounds != null) contractBounds = { ...customBounds }
  const request: IdentityKeyRequestDto = {
    purpose: definition.purpose,
    securityLevel: definition.securityLevel,
    contractBounds,
  }
  if (definition.canLimit && customLimits != null) {
    if (customLimits.totalBudget != null) request.totalBudget = customLimits.totalBudget
    if (customLimits.expiresAt != null) request.expiresAt = customLimits.expiresAt
  }
  return request
}

export function buildKeyRequests(
  selected: IdentityKeyVariant[],
  boundsDrafts: KeyBoundsDraftMap,
  limitsDrafts: KeyLimitsDraftMap = {},
  now: number = Date.now(),
): { requests: IdentityKeyRequestDto[]; valid: boolean } {
  let valid = true
  const requests = selected.map(variant => {
    const definition = IDENTITY_KEY_VARIANTS[variant]
    let bounds: IdentityKeyBoundsDto | null = null
    if (definition.canBind) {
      const boundsValidation = validateKeyContractBounds(boundsDrafts[variant])
      if (!boundsValidation.valid) valid = false
      else bounds = boundsValidation.bounds
    }
    let limits: IdentityKeyLimits | null = null
    if (definition.canLimit) {
      const limitsValidation = validateKeyLimits(limitsDrafts[variant], now)
      if (!limitsValidation.valid) valid = false
      else limits = limitsValidation.limits
    }
    return variantRequest(variant, bounds, limits)
  })
  return { requests, valid }
}

export function variantOfRequest(request: IdentityKeyRequestDto): IdentityKeyVariant | null {
  const definition = Object.values(IDENTITY_KEY_VARIANTS).find(entry => entry.purpose === request.purpose
    && entry.securityLevel === request.securityLevel
    && entry.dashPayBound === isDashPayKeyBounds(request.contractBounds))
  return definition?.variant ?? null
}

export function keysMatchingVariant(existing: IdentityKeyDto[], variant: IdentityKeyVariant, now: number = Date.now()): number {
  const definition = IDENTITY_KEY_VARIANTS[variant]
  return existing.filter(key => isIdentityKeyUsable(key, now)
    && key.purpose.toUpperCase() === definition.purpose
    && key.securityLevel.toUpperCase() === definition.securityLevel
    && isDashPayKeyBounds(key.contractBounds) === definition.dashPayBound).length
}

export function validateKeySelection(selected: IdentityKeyVariant[]): KeySelectionCheck {
  return {
    count: selected.length,
    atLimit: selected.length >= IDENTITY_KEYS_PER_TRANSITION,
    overLimit: selected.length > IDENTITY_KEYS_PER_TRANSITION,
    empty: selected.length === 0,
  }
}

export function nextIdentityKeyId(keys: IdentityKeyDto[]): number {
  return keys.reduce((next, key) => Math.max(next, key.keyId + 1), 0)
}

export function keyBoundsLabel(bounds: IdentityKeyBoundsDto | null): KeyBoundsLabel | null {
  if (bounds == null) return null
  const isDashPay = isDashPayContract(bounds)
  const owner = isDashPay ? DASHPAY_BOUNDS_LABEL : bounds.contractId
  return {
    text: bounds.documentType == null ? owner : `${owner}${IDENTITY_KEY_LABEL_SEPARATOR}${bounds.documentType}`,
    isDashPay,
  }
}

export function identityKeyLabel(key: Pick<IdentityKeyDto, 'keyId' | 'purpose' | 'securityLevel'>): string {
  const label = [keyLabel(key.purpose, IDENTITY_KEY_PURPOSE_LABELS), keyLabel(key.securityLevel, IDENTITY_KEY_LEVEL_LABELS)].join(IDENTITY_KEY_LABEL_SEPARATOR)
  return `${KEY_COUNT_COPY.idPrefix}${key.keyId} ${label}`
}

export function keyRequestLabel(request: IdentityKeyRequestDto): string {
  const parts = [keyLabel(request.purpose, IDENTITY_KEY_PURPOSE_LABELS), keyLabel(request.securityLevel, IDENTITY_KEY_LEVEL_LABELS)]
  if (request.contractBounds != null) {
    parts.push(isDashPayKeyBounds(request.contractBounds) ? DASHPAY_BOUNDS_LABEL : keyBoundsLabel(request.contractBounds)!.text)
  }
  parts.push(...keyLimitsSummaryParts(request))
  return parts.join(IDENTITY_KEY_LABEL_SEPARATOR)
}

export function projectedKeyIds(existing: IdentityKeyDto[], count: number): number[] {
  const first = nextIdentityKeyId(existing)
  return Array.from({ length: count }, (_, offset) => first + offset)
}
