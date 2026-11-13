import { describe, expect, it } from 'vitest'
import {
  buildKeyRequests,
  isValidContractId,
  isValidDocumentType,
  keyBoundsLabel,
  keyLabel,
  keyRequestLabel,
  keysMatchingVariant,
  nextIdentityKeyId,
  projectedKeyIds,
  validateKeyContractBounds,
  validateKeySelection,
  variantOfRequest,
  variantRequest,
} from '../../src/renderer/src/utils/identityKeyRequests'
import { IdentityKeyPurpose, IdentityKeySecurityLevel, IdentityKeyVariant } from '../../src/renderer/src/enums/IdentityKeys'
import { DASHPAY_CONTRACT_ID, DASHPAY_KEY_BOUNDS } from '../../src/renderer/src/constants/dashPay'
import { IDENTITY_KEY_PURPOSE_LABELS, IDENTITY_KEY_VARIANTS, KEY_BOUNDS_COPY } from '../../src/renderer/src/constants/identityKeys'
import type { IdentityKeyDto } from '../../src/renderer/src/api/types'

const CUSTOM_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'
const ZERO_CONTRACT_ID = '11111111111111111111111111111111'

const DISABLED_AT = 1_700_000_000_000

function key(keyId: number, purpose: string, securityLevel: string, overrides: Partial<IdentityKeyDto> = {}): IdentityKeyDto {
  return { keyId, purpose, securityLevel, keyType: 'ECDSA_SECP256K1', data: '', readOnly: false, disabledAt: null, contractBounds: null, ...overrides }
}

const DEFAULT_KEYS = [
  key(0, 'AUTHENTICATION', 'MASTER'),
  key(1, 'AUTHENTICATION', 'CRITICAL'),
  key(2, 'AUTHENTICATION', 'HIGH'),
  key(3, 'ENCRYPTION', 'MEDIUM', { contractBounds: DASHPAY_KEY_BOUNDS }),
  key(4, 'DECRYPTION', 'MEDIUM', { contractBounds: DASHPAY_KEY_BOUNDS }),
  key(5, 'TRANSFER', 'CRITICAL'),
]

const VALID_PAIRINGS = new Set([
  'AUTHENTICATION:CRITICAL',
  'AUTHENTICATION:HIGH',
  'AUTHENTICATION:MEDIUM',
  'ENCRYPTION:MEDIUM',
  'DECRYPTION:MEDIUM',
  'TRANSFER:CRITICAL',
])

describe('identity key variants', () => {
  it('offers only pairings Drive accepts and never a MASTER key', () => {
    for (const variant of Object.values(IdentityKeyVariant)) {
      const request = variantRequest(variant)
      expect(VALID_PAIRINGS.has(`${request.purpose}:${request.securityLevel}`)).toBe(true)
    }
  })

  it('binds only the DashPay variants to the contactRequest document', () => {
    expect(variantRequest(IdentityKeyVariant.EncDashPay)).toEqual({
      purpose: IdentityKeyPurpose.Encryption,
      securityLevel: IdentityKeySecurityLevel.Medium,
      contractBounds: DASHPAY_KEY_BOUNDS,
    })
    expect(variantRequest(IdentityKeyVariant.Enc).contractBounds).toBeNull()
    expect(variantRequest(IdentityKeyVariant.AuthHigh)).toEqual({
      purpose: IdentityKeyPurpose.Authentication,
      securityLevel: IdentityKeySecurityLevel.High,
      contractBounds: null,
    })
  })

  it('lists eight distinct variants with the DashPay ones first', () => {
    const definitions = Object.values(IDENTITY_KEY_VARIANTS)
    expect(definitions).toHaveLength(8)
    expect(definitions.slice(0, 2).map(entry => entry.variant)).toEqual([IdentityKeyVariant.EncDashPay, IdentityKeyVariant.DecDashPay])
    expect(new Set(definitions.map(entry => JSON.stringify(variantRequest(entry.variant)))).size).toBe(8)
  })

  it('maps a request back to its variant', () => {
    for (const variant of Object.values(IdentityKeyVariant)) {
      expect(variantOfRequest(variantRequest(variant))).toBe(variant)
    }
    expect(variantOfRequest({
      purpose: IdentityKeyPurpose.Encryption,
      securityLevel: IdentityKeySecurityLevel.Medium,
      contractBounds: { contractId: DASHPAY_CONTRACT_ID, documentType: 'profile' },
    })).toBe(IdentityKeyVariant.Enc)
    expect(variantOfRequest({ purpose: IdentityKeyPurpose.Transfer, securityLevel: IdentityKeySecurityLevel.Medium, contractBounds: null })).toBeNull()
  })

  it('applies custom contract bounds to bindable variants and ignores them on non-bindable variants', () => {
    const customBounds = { contractId: CUSTOM_CONTRACT_ID, documentType: 'domain' }
    expect(variantRequest(IdentityKeyVariant.AuthHigh, customBounds).contractBounds).toEqual(customBounds)
    expect(variantRequest(IdentityKeyVariant.Enc, customBounds).contractBounds).toEqual(customBounds)
    expect(variantRequest(IdentityKeyVariant.Dec, customBounds).contractBounds).toEqual(customBounds)
    expect(variantRequest(IdentityKeyVariant.Transfer, customBounds).contractBounds).toBeNull()
    expect(variantRequest(IdentityKeyVariant.EncDashPay, customBounds).contractBounds).toEqual(DASHPAY_KEY_BOUNDS)
    expect(variantRequest(IdentityKeyVariant.DecDashPay, customBounds).contractBounds).toEqual(DASHPAY_KEY_BOUNDS)
  })

  it('counts the enabled keys an identity already has of a variant', () => {
    const keys = [...DEFAULT_KEYS, key(6, 'ENCRYPTION', 'MEDIUM'), key(7, 'AUTHENTICATION', 'HIGH', { disabledAt: DISABLED_AT })]
    expect(keysMatchingVariant(keys, IdentityKeyVariant.EncDashPay)).toBe(1)
    expect(keysMatchingVariant(keys, IdentityKeyVariant.Enc)).toBe(1)
    expect(keysMatchingVariant(keys, IdentityKeyVariant.AuthHigh)).toBe(1)
    expect(keysMatchingVariant(keys, IdentityKeyVariant.AuthMedium)).toBe(0)
  })
})

describe('validateKeySelection', () => {
  const variants = Object.values(IdentityKeyVariant)

  it('allows up to six keys in one transaction', () => {
    expect(validateKeySelection(variants.slice(0, 2))).toEqual({ count: 2, atLimit: false, overLimit: false, empty: false })
    expect(validateKeySelection(variants.slice(0, 6))).toEqual({ count: 6, atLimit: true, overLimit: false, empty: false })
  })

  it('flags a selection over the limit and an empty one', () => {
    expect(validateKeySelection(variants.slice(0, 7))).toMatchObject({ count: 7, overLimit: true })
    expect(validateKeySelection([])).toMatchObject({ count: 0, empty: true, atLimit: false })
  })
})

describe('nextIdentityKeyId', () => {
  it('continues after the highest key id, with no cap', () => {
    expect(nextIdentityKeyId([])).toBe(0)
    expect(nextIdentityKeyId(DEFAULT_KEYS)).toBe(6)
    expect(nextIdentityKeyId([key(0, 'AUTHENTICATION', 'MASTER'), key(41, 'AUTHENTICATION', 'MEDIUM')])).toBe(42)
  })
})

describe('key labels', () => {
  it('labels known values case-insensitively and falls back to the raw string', () => {
    expect(keyLabel('encryption', IDENTITY_KEY_PURPOSE_LABELS)).toBe('Encryption')
    expect(keyLabel('VOTING', IDENTITY_KEY_PURPOSE_LABELS)).toBe('VOTING')
  })

  it('names a request with its bound contract', () => {
    expect(keyRequestLabel(variantRequest(IdentityKeyVariant.EncDashPay))).toBe('Encryption · Medium · DashPay')
    expect(keyRequestLabel(variantRequest(IdentityKeyVariant.AuthHigh))).toBe('Authentication · High')
  })

  it('names a request with its bound contract and optional document type', () => {
    const contractOnly = { contractId: CUSTOM_CONTRACT_ID, documentType: null }
    const withDocumentType = { contractId: CUSTOM_CONTRACT_ID, documentType: 'domain' }
    const dashPayOtherDoc = { contractId: DASHPAY_CONTRACT_ID, documentType: 'profile' }
    expect(keyRequestLabel({ ...variantRequest(IdentityKeyVariant.AuthHigh), contractBounds: contractOnly }))
      .toBe(`Authentication · High · ${CUSTOM_CONTRACT_ID}`)
    expect(keyRequestLabel({ ...variantRequest(IdentityKeyVariant.AuthHigh), contractBounds: withDocumentType }))
      .toBe(`Authentication · High · ${CUSTOM_CONTRACT_ID} · domain`)
    expect(keyRequestLabel({ ...variantRequest(IdentityKeyVariant.Enc), contractBounds: dashPayOtherDoc }))
      .toBe('Encryption · Medium · DashPay · profile')
  })

  it('labels DashPay bounds, other contracts by full id, and no bounds as null', () => {
    expect(keyBoundsLabel(DASHPAY_KEY_BOUNDS)).toEqual({ text: 'DashPay · contactRequest', isDashPay: true })
    expect(keyBoundsLabel({ contractId: CUSTOM_CONTRACT_ID, documentType: 'domain' }))
      .toEqual({ text: `${CUSTOM_CONTRACT_ID} · domain`, isDashPay: false })
    expect(keyBoundsLabel({ contractId: CUSTOM_CONTRACT_ID, documentType: null }))
      .toEqual({ text: CUSTOM_CONTRACT_ID, isDashPay: false })
    expect(keyBoundsLabel(null)).toBeNull()
  })
})

describe('contract bounds validation', () => {
  it('validates 32-byte Base58 contract IDs', () => {
    expect(isValidContractId(DASHPAY_CONTRACT_ID)).toBe(true)
    expect(isValidContractId(`  ${CUSTOM_CONTRACT_ID}  `)).toBe(true)
    expect(isValidContractId(ZERO_CONTRACT_ID)).toBe(true)
    expect(isValidContractId('')).toBe(false)
    expect(isValidContractId('not-base58-0OIl')).toBe(false)
    expect(isValidContractId('2gR9w')).toBe(false)
  })

  it('validates document types against the Platform identifier pattern', () => {
    expect(isValidDocumentType('domain')).toBe(true)
    expect(isValidDocumentType('contact_request-v1')).toBe(true)
    expect(isValidDocumentType('a'.repeat(64))).toBe(true)
    expect(isValidDocumentType('a'.repeat(65))).toBe(false)
    expect(isValidDocumentType('bad doc')).toBe(false)
    expect(isValidDocumentType('bad.doc')).toBe(false)
  })

  it('normalizes empty document type to null and validates partial or invalid drafts', () => {
    expect(validateKeyContractBounds()).toEqual({ bounds: null, contractIdError: null, documentTypeError: null, valid: true })
    expect(validateKeyContractBounds({ contractId: `  ${CUSTOM_CONTRACT_ID} `, documentType: '   ' })).toEqual({
      bounds: { contractId: CUSTOM_CONTRACT_ID, documentType: null },
      contractIdError: null,
      documentTypeError: null,
      valid: true,
    })
    expect(validateKeyContractBounds({ contractId: CUSTOM_CONTRACT_ID, documentType: '  domain  ' })).toEqual({
      bounds: { contractId: CUSTOM_CONTRACT_ID, documentType: 'domain' },
      contractIdError: null,
      documentTypeError: null,
      valid: true,
    })
    expect(validateKeyContractBounds({ contractId: '', documentType: 'domain' })).toEqual({
      bounds: null,
      contractIdError: KEY_BOUNDS_COPY.contractIdRequired,
      documentTypeError: null,
      valid: false,
    })
    expect(validateKeyContractBounds({ contractId: 'invalid', documentType: 'bad doc' })).toEqual({
      bounds: null,
      contractIdError: KEY_BOUNDS_COPY.invalidContractId,
      documentTypeError: KEY_BOUNDS_COPY.invalidDocumentType,
      valid: false,
    })
  })

  it('builds requests with custom bounds and ignores invalid drafts on unchecked variants', () => {
    const drafts = {
      [IdentityKeyVariant.AuthHigh]: { contractId: CUSTOM_CONTRACT_ID, documentType: 'domain' },
      [IdentityKeyVariant.Enc]: { contractId: 'bad', documentType: '' },
    }
    expect(buildKeyRequests([IdentityKeyVariant.EncDashPay, IdentityKeyVariant.AuthHigh], drafts)).toEqual({
      valid: true,
      requests: [
        variantRequest(IdentityKeyVariant.EncDashPay),
        { ...variantRequest(IdentityKeyVariant.AuthHigh), contractBounds: { contractId: CUSTOM_CONTRACT_ID, documentType: 'domain' } },
      ],
    })
    expect(buildKeyRequests([IdentityKeyVariant.AuthHigh, IdentityKeyVariant.Enc], drafts).valid).toBe(false)
  })
})

describe('projectedKeyIds', () => {
  it('continues after the highest existing key id', () => {
    expect(projectedKeyIds(DEFAULT_KEYS, 2)).toEqual([6, 7])
    expect(projectedKeyIds([key(0, 'AUTHENTICATION', 'MASTER'), key(9, 'TRANSFER', 'CRITICAL')], 2)).toEqual([10, 11])
    expect(projectedKeyIds([], 0)).toEqual([])
  })
})
