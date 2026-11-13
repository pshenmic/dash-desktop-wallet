import { base58 } from '@scure/base'
import type { IdentityKeyBoundsDto, IdentityKeyDto, IdentityKeyRequestDto } from '@renderer/api/types'
import { DASHPAY_CONTRACT_ID, DASHPAY_KEY_BOUNDS } from '@renderer/constants/dashPay'
import {
  CONTRACT_ID_BYTE_LENGTH,
  DASHPAY_BOUNDS_LABEL,
  DOCUMENT_TYPE_PATTERN,
  EMPTY_KEY_BOUNDS_DRAFT,
  IDENTITY_KEY_LABEL_SEPARATOR,
  IDENTITY_KEY_LEVEL_LABELS,
  IDENTITY_KEY_PURPOSE_LABELS,
  IDENTITY_KEY_VARIANTS,
  IDENTITY_KEYS_PER_TRANSITION,
  KEY_BOUNDS_COPY,
  KEY_COUNT_COPY,
} from '@renderer/constants/identityKeys'
import type { IdentityKeyVariant } from '@renderer/enums/IdentityKeys'
import type {
  KeyBoundsDraftMap,
  KeyBoundsLabel,
  KeyContractBoundsDraft,
  KeyContractBoundsValidation,
  KeySelectionCheck,
} from '@renderer/types/IdentityKeys'
import { isIdentityKeyActive } from './identities'

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

export function keyLabel(value: string, labels: Record<string, string>): string {
  return labels[value.toUpperCase()] ?? value
}

export function variantRequest(variant: IdentityKeyVariant, customBounds: IdentityKeyBoundsDto | null = null): IdentityKeyRequestDto {
  const definition = IDENTITY_KEY_VARIANTS[variant]
  let contractBounds: IdentityKeyBoundsDto | null = null
  if (definition.dashPayBound) contractBounds = { ...DASHPAY_KEY_BOUNDS }
  else if (definition.canBind && customBounds != null) contractBounds = { ...customBounds }
  return {
    purpose: definition.purpose,
    securityLevel: definition.securityLevel,
    contractBounds,
  }
}

export function buildKeyRequests(
  selected: IdentityKeyVariant[],
  drafts: KeyBoundsDraftMap,
): { requests: IdentityKeyRequestDto[]; valid: boolean } {
  let valid = true
  const requests = selected.map(variant => {
    const definition = IDENTITY_KEY_VARIANTS[variant]
    if (!definition.canBind) return variantRequest(variant)
    const validation = validateKeyContractBounds(drafts[variant])
    if (!validation.valid) {
      valid = false
      return variantRequest(variant, null)
    }
    return variantRequest(variant, validation.bounds)
  })
  return { requests, valid }
}

export function variantOfRequest(request: IdentityKeyRequestDto): IdentityKeyVariant | null {
  const definition = Object.values(IDENTITY_KEY_VARIANTS).find(entry => entry.purpose === request.purpose
    && entry.securityLevel === request.securityLevel
    && entry.dashPayBound === isDashPayKeyBounds(request.contractBounds))
  return definition?.variant ?? null
}

export function keysMatchingVariant(existing: IdentityKeyDto[], variant: IdentityKeyVariant): number {
  const definition = IDENTITY_KEY_VARIANTS[variant]
  return existing.filter(key => isIdentityKeyActive(key)
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
  return parts.join(IDENTITY_KEY_LABEL_SEPARATOR)
}

export function projectedKeyIds(existing: IdentityKeyDto[], count: number): number[] {
  const first = nextIdentityKeyId(existing)
  return Array.from({ length: count }, (_, offset) => first + offset)
}
