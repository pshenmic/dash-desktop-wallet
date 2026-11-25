import { describe, expect, it } from 'vitest'
import {
  buildKeyRequests,
  convertBudgetDraftUnit,
  formatLocalDateTimeInput,
  isValidContractId,
  isValidDocumentType,
  keyBoundsLabel,
  keyLabel,
  keyLimitsSummaryParts,
  keyRequestLabel,
  keysMatchingVariant,
  nextIdentityKeyId,
  parseKeyBudgetCredits,
  parseLocalDateTimeInput,
  projectedKeyIds,
  validateKeyContractBounds,
  validateKeyLimits,
  validateKeySelection,
  variantOfRequest,
  variantRequest,
} from '../../src/renderer/src/utils/identityKeyRequests'
import { IdentityKeyPurpose, IdentityKeySecurityLevel, IdentityKeyVariant, KeyBudgetUnit } from '../../src/renderer/src/enums/IdentityKeys'
import { DASHPAY_CONTRACT_ID, DASHPAY_KEY_BOUNDS } from '../../src/renderer/src/constants/dashPay'
import {
  IDENTITY_KEY_PURPOSE_LABELS,
  IDENTITY_KEY_VARIANTS,
  KEY_BOUNDS_COPY,
  KEY_LIMITS_COPY,
  MAX_KEY_BUDGET_CREDITS,
} from '../../src/renderer/src/constants/identityKeys'
import { formatTimestamp } from '../../src/renderer/src/utils/date'
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

describe('key budget and expiry limits', () => {
  const NOW = new Date(2026, 10, 24, 10, 30, 0, 0).getTime()
  const FUTURE = new Date(2026, 10, 25, 10, 30, 0, 0).getTime()
  const FUTURE_STR = formatLocalDateTimeInput(FUTURE)
  const NOW_STR = formatLocalDateTimeInput(NOW)

  it('allows limits only on non-MASTER authentication variants', () => {
    expect(IDENTITY_KEY_VARIANTS[IdentityKeyVariant.AuthCritical].canLimit).toBe(true)
    expect(IDENTITY_KEY_VARIANTS[IdentityKeyVariant.AuthHigh].canLimit).toBe(true)
    expect(IDENTITY_KEY_VARIANTS[IdentityKeyVariant.AuthMedium].canLimit).toBe(true)
    expect(IDENTITY_KEY_VARIANTS[IdentityKeyVariant.EncDashPay].canLimit).toBe(false)
    expect(IDENTITY_KEY_VARIANTS[IdentityKeyVariant.DecDashPay].canLimit).toBe(false)
    expect(IDENTITY_KEY_VARIANTS[IdentityKeyVariant.Enc].canLimit).toBe(false)
    expect(IDENTITY_KEY_VARIANTS[IdentityKeyVariant.Dec].canLimit).toBe(false)
    expect(IDENTITY_KEY_VARIANTS[IdentityKeyVariant.Transfer].canLimit).toBe(false)
  })

  it('formats and parses local datetime strings while rejecting calendar rollover', () => {
    const formatted = formatLocalDateTimeInput(new Date(2026, 0, 5, 9, 7, 45).getTime())
    expect(formatted).toBe('2026-01-05T09:07')
    expect(parseLocalDateTimeInput(formatted)).toBe(new Date(2026, 0, 5, 9, 7, 0, 0).getTime())
    expect(parseLocalDateTimeInput(`  ${formatted}  `)).toBe(new Date(2026, 0, 5, 9, 7, 0, 0).getTime())
    expect(formatLocalDateTimeInput(Number.NaN)).toBe('')
    expect(formatLocalDateTimeInput(Number.POSITIVE_INFINITY)).toBe('')

    expect(parseLocalDateTimeInput('2024-02-29T12:00')).toBe(new Date(2024, 1, 29, 12, 0, 0, 0).getTime())
    for (const bad of [
      '',
      '2026-11-24',
      '2026-11-24 10:00',
      '2026-11-24T10:00:00',
      '2026-02-29T12:00',
      '2026-02-30T12:00',
      '2026-04-31T12:00',
      '2026-00-10T12:00',
      '2026-13-01T12:00',
      '2026-01-32T12:00',
      '2026-01-10T24:00',
      '2026-01-10T12:60',
      '0050-01-10T12:00',
    ]) {
      expect(parseLocalDateTimeInput(bad), bad).toBeNull()
    }
  })

  it('parses Dash and Credits budgets with zero, negative, precision, and u64 max checks', () => {
    expect(parseKeyBudgetCredits('', KeyBudgetUnit.Dash)).toEqual({ credits: null, error: null })
    expect(parseKeyBudgetCredits('   ', KeyBudgetUnit.Credits)).toEqual({ credits: null, error: null })
    expect(parseKeyBudgetCredits('0.1', KeyBudgetUnit.Dash)).toEqual({ credits: 10_000_000_000n, error: null })
    expect(parseKeyBudgetCredits('.5', KeyBudgetUnit.Dash)).toEqual({ credits: 50_000_000_000n, error: null })
    expect(parseKeyBudgetCredits('0.00000000001', KeyBudgetUnit.Dash)).toEqual({ credits: 1n, error: null })
    expect(parseKeyBudgetCredits('184467440.73709551615', KeyBudgetUnit.Dash)).toEqual({ credits: MAX_KEY_BUDGET_CREDITS, error: null })

    for (const badDash of ['0', '0.0', '.0', '1.', '.', '-1', '0.000000000001', '1e5', 'abc']) {
      expect(parseKeyBudgetCredits(badDash, KeyBudgetUnit.Dash), badDash).toEqual({
        credits: null,
        error: KEY_LIMITS_COPY.invalidBudgetDash,
      })
    }
    expect(parseKeyBudgetCredits('184467440.73709551616', KeyBudgetUnit.Dash)).toEqual({
      credits: null,
      error: KEY_LIMITS_COPY.budgetTooLarge,
    })

    expect(parseKeyBudgetCredits('1', KeyBudgetUnit.Credits)).toEqual({ credits: 1n, error: null })
    expect(parseKeyBudgetCredits('18446744073709551615', KeyBudgetUnit.Credits)).toEqual({ credits: MAX_KEY_BUDGET_CREDITS, error: null })
    for (const badCredits of ['0', '000', '1.5', '-1', '1e5', 'abc']) {
      expect(parseKeyBudgetCredits(badCredits, KeyBudgetUnit.Credits), badCredits).toEqual({
        credits: null,
        error: KEY_LIMITS_COPY.invalidBudgetCredits,
      })
    }
    expect(parseKeyBudgetCredits('18446744073709551616', KeyBudgetUnit.Credits)).toEqual({
      credits: null,
      error: KEY_LIMITS_COPY.budgetTooLarge,
    })
  })

  it('converts budget strings between Dash and Credits losslessly and preserves unparseable text', () => {
    expect(convertBudgetDraftUnit('0.1', KeyBudgetUnit.Dash, KeyBudgetUnit.Dash)).toBe('0.1')
    expect(convertBudgetDraftUnit('   ', KeyBudgetUnit.Dash, KeyBudgetUnit.Credits)).toBe('')
    expect(convertBudgetDraftUnit('0.1', KeyBudgetUnit.Dash, KeyBudgetUnit.Credits)).toBe('10000000000')
    expect(convertBudgetDraftUnit('.5', KeyBudgetUnit.Dash, KeyBudgetUnit.Credits)).toBe('50000000000')
    expect(convertBudgetDraftUnit('1', KeyBudgetUnit.Credits, KeyBudgetUnit.Dash)).toBe('0.00000000001')
    expect(convertBudgetDraftUnit('18446744073709551615', KeyBudgetUnit.Credits, KeyBudgetUnit.Dash)).toBe('184467440.73709551615')
    expect(convertBudgetDraftUnit('0.5', KeyBudgetUnit.Credits, KeyBudgetUnit.Dash)).toBe('0.5')
    expect(convertBudgetDraftUnit('0', KeyBudgetUnit.Dash, KeyBudgetUnit.Credits)).toBe('0')
  })

  it('validates key limits including past and equal-to-now expiry boundary', () => {
    expect(validateKeyLimits(undefined, NOW)).toEqual({
      limits: null,
      totalBudgetError: null,
      expiresAtError: null,
      valid: true,
    })
    expect(validateKeyLimits({ totalBudget: '0.25', budgetUnit: KeyBudgetUnit.Dash, expiresAt: '' }, NOW)).toEqual({
      limits: { totalBudget: 25_000_000_000n, expiresAt: null },
      totalBudgetError: null,
      expiresAtError: null,
      valid: true,
    })
    expect(validateKeyLimits({ totalBudget: '', budgetUnit: KeyBudgetUnit.Dash, expiresAt: FUTURE_STR }, NOW)).toEqual({
      limits: { totalBudget: null, expiresAt: FUTURE },
      totalBudgetError: null,
      expiresAtError: null,
      valid: true,
    })
    expect(validateKeyLimits({ totalBudget: '500', budgetUnit: KeyBudgetUnit.Credits, expiresAt: FUTURE_STR }, NOW)).toEqual({
      limits: { totalBudget: 500n, expiresAt: FUTURE },
      totalBudgetError: null,
      expiresAtError: null,
      valid: true,
    })
    expect(validateKeyLimits({ totalBudget: '', budgetUnit: KeyBudgetUnit.Dash, expiresAt: NOW_STR }, NOW)).toEqual({
      limits: null,
      totalBudgetError: null,
      expiresAtError: KEY_LIMITS_COPY.expiredExpiresAt,
      valid: false,
    })
    expect(validateKeyLimits({ totalBudget: '', budgetUnit: KeyBudgetUnit.Dash, expiresAt: formatLocalDateTimeInput(NOW - 60_000) }, NOW)).toEqual({
      limits: null,
      totalBudgetError: null,
      expiresAtError: KEY_LIMITS_COPY.expiredExpiresAt,
      valid: false,
    })
    expect(validateKeyLimits({ totalBudget: '0', budgetUnit: KeyBudgetUnit.Dash, expiresAt: '2026-02-30T10:00' }, NOW)).toEqual({
      limits: null,
      totalBudgetError: KEY_LIMITS_COPY.invalidBudgetDash,
      expiresAtError: KEY_LIMITS_COPY.invalidExpiresAt,
      valid: false,
    })
  })

  it('formats limit summary parts and includes them in request labels', () => {
    expect(keyLimitsSummaryParts(null)).toEqual([])
    expect(keyLimitsSummaryParts(undefined)).toEqual([])
    expect(keyLimitsSummaryParts({})).toEqual([])
    expect(keyLimitsSummaryParts({ totalBudget: 10_000_000_000n, expiresAt: FUTURE })).toEqual([
      'Max 0.1 Dash',
      `Until ${formatTimestamp(new Date(FUTURE))}`,
    ])
    const request = variantRequest(
      IdentityKeyVariant.AuthHigh,
      { contractId: CUSTOM_CONTRACT_ID, documentType: 'domain' },
      { totalBudget: 10_000_000_000n, expiresAt: FUTURE },
    )
    expect(keyRequestLabel(request)).toBe(
      `Authentication · High · ${CUSTOM_CONTRACT_ID} · domain · Max 0.1 Dash · Until ${formatTimestamp(new Date(FUTURE))}`,
    )
  })

  it('applies limits only to limitable variants and omits unset limit fields', () => {
    const limits = { totalBudget: 1_000n, expiresAt: FUTURE }
    const auth = variantRequest(IdentityKeyVariant.AuthMedium, null, limits)
    expect(auth).toEqual({
      purpose: IdentityKeyPurpose.Authentication,
      securityLevel: IdentityKeySecurityLevel.Medium,
      contractBounds: null,
      totalBudget: 1_000n,
      expiresAt: FUTURE,
    })
    expect(variantOfRequest(auth)).toBe(IdentityKeyVariant.AuthMedium)

    const budgetOnly = variantRequest(IdentityKeyVariant.AuthCritical, null, { totalBudget: 50n, expiresAt: null })
    expect(budgetOnly).toEqual({
      purpose: IdentityKeyPurpose.Authentication,
      securityLevel: IdentityKeySecurityLevel.Critical,
      contractBounds: null,
      totalBudget: 50n,
    })
    expect('expiresAt' in budgetOnly).toBe(false)

    for (const nonLimitable of [
      IdentityKeyVariant.EncDashPay,
      IdentityKeyVariant.DecDashPay,
      IdentityKeyVariant.Enc,
      IdentityKeyVariant.Dec,
      IdentityKeyVariant.Transfer,
    ]) {
      const req = variantRequest(nonLimitable, null, limits)
      expect('totalBudget' in req).toBe(false)
      expect('expiresAt' in req).toBe(false)
    }
  })

  it('builds key requests with bounds and limits while ignoring invalid limits on non-limitable or unchecked variants', () => {
    const built = buildKeyRequests(
      [IdentityKeyVariant.AuthHigh, IdentityKeyVariant.Enc],
      { [IdentityKeyVariant.AuthHigh]: { contractId: CUSTOM_CONTRACT_ID, documentType: '' } },
      {
        [IdentityKeyVariant.AuthHigh]: { totalBudget: '0.1', budgetUnit: KeyBudgetUnit.Dash, expiresAt: FUTURE_STR },
        [IdentityKeyVariant.Enc]: { totalBudget: 'bad', budgetUnit: KeyBudgetUnit.Credits, expiresAt: NOW_STR },
        [IdentityKeyVariant.AuthMedium]: { totalBudget: '0', budgetUnit: KeyBudgetUnit.Dash, expiresAt: '' },
      },
      NOW,
    )
    expect(built).toEqual({
      valid: true,
      requests: [
        {
          purpose: IdentityKeyPurpose.Authentication,
          securityLevel: IdentityKeySecurityLevel.High,
          contractBounds: { contractId: CUSTOM_CONTRACT_ID, documentType: null },
          totalBudget: 10_000_000_000n,
          expiresAt: FUTURE,
        },
        variantRequest(IdentityKeyVariant.Enc),
      ],
    })

    const invalid = buildKeyRequests(
      [IdentityKeyVariant.AuthHigh],
      {},
      { [IdentityKeyVariant.AuthHigh]: { totalBudget: '1', budgetUnit: KeyBudgetUnit.Dash, expiresAt: NOW_STR } },
      NOW,
    )
    expect(invalid.valid).toBe(false)
  })

  it('excludes expired keys at expiresAt <= now in keysMatchingVariant', () => {
    const keys = [
      key(0, 'AUTHENTICATION', 'HIGH', { expiresAt: NOW }),
      key(1, 'AUTHENTICATION', 'HIGH', { expiresAt: NOW - 1 }),
      key(2, 'AUTHENTICATION', 'HIGH', { expiresAt: NOW + 1 }),
      key(3, 'AUTHENTICATION', 'HIGH', { disabledAt: DISABLED_AT, expiresAt: NOW + 10_000 }),
    ]
    expect(keysMatchingVariant(keys, IdentityKeyVariant.AuthHigh, NOW)).toBe(1)
  })
})
