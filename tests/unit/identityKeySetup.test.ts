import { describe, expect, it } from 'vitest'
import {
  applyKeyExpiryPreset,
  identityKeysCountLabel,
  keysAddedLabel,
  keySelectionLabel,
  keysOnIdentityLabel,
  keyVariantCaption,
  keyVariantTitle,
  presetKeyVariants,
  projectedKeyLabel,
  sortedIdentityKeys,
  toggleKeyBudgetUnit,
  toggleKeyVariant,
  updateKeyBoundsDraft,
  updateKeyLimitsDraft,
} from '../../src/renderer/src/utils/identityKeySetup'
import { IdentityKeyVariant, KeyBudgetUnit } from '../../src/renderer/src/enums/IdentityKeys'
import { DASHPAY_CONTRACT_ID, DASHPAY_KEY_BOUNDS } from '../../src/renderer/src/constants/dashPay'
import { IDENTITY_KEY_VARIANTS, KEY_EXPIRY_PRESETS, KEY_VARIANT_GROUPS } from '../../src/renderer/src/constants/identityKeys'
import { DAY_MS } from '../../src/renderer/src/constants/timeLeft'
import { formatTimestamp } from '../../src/renderer/src/utils/date'
import { formatLocalDateTimeInput, validateKeyLimits } from '../../src/renderer/src/utils/identityKeyRequests'
import type { IdentityKeyDto } from '../../src/renderer/src/api/types'

function key(keyId: number, purpose: string, securityLevel: string, overrides: Partial<IdentityKeyDto> = {}): IdentityKeyDto {
  return { keyId, purpose, securityLevel, keyType: 'ECDSA_SECP256K1', data: '', readOnly: false, disabledAt: null, contractBounds: null, ...overrides }
}

const BASE_KEYS = [
  key(0, 'AUTHENTICATION', 'MASTER'),
  key(1, 'AUTHENTICATION', 'CRITICAL'),
  key(2, 'AUTHENTICATION', 'HIGH'),
  key(3, 'TRANSFER', 'CRITICAL'),
]

describe('key selection copy', () => {
  it('states the per-transaction limit, then how much of it is used', () => {
    expect(keySelectionLabel(0)).toBe('Up to 6 keys per transaction')
    expect(keySelectionLabel(2)).toBe('2 of 6 selected')
    expect(keySelectionLabel(6)).toBe('6 of 6 selected · limit per transaction')
  })

  it('counts keys on an identity', () => {
    expect(identityKeysCountLabel(1)).toBe('1 key')
    expect(identityKeysCountLabel(7)).toBe('7 keys')
  })
})

describe('key table order', () => {
  it('sorts by key id without mutating the input', () => {
    const keys = [key(2, 'AUTHENTICATION', 'HIGH'), key(0, 'AUTHENTICATION', 'MASTER'), key(1, 'VOTING', 'MEDIUM')]
    expect(sortedIdentityKeys(keys).map(entry => entry.keyId)).toEqual([0, 1, 2])
    expect(keys.map(entry => entry.keyId)).toEqual([2, 0, 1])
  })
})

describe('key variant selection', () => {
  it('keeps the selection in variant order', () => {
    const first = toggleKeyVariant([], IdentityKeyVariant.Transfer, true)
    const second = toggleKeyVariant(first, IdentityKeyVariant.EncDashPay, true)
    expect(second).toEqual([IdentityKeyVariant.EncDashPay, IdentityKeyVariant.Transfer])
    expect(toggleKeyVariant(second, IdentityKeyVariant.Transfer, false)).toEqual([IdentityKeyVariant.EncDashPay])
  })

  it('ignores a duplicate check', () => {
    expect(toggleKeyVariant([IdentityKeyVariant.Dec], IdentityKeyVariant.Dec, true)).toEqual([IdentityKeyVariant.Dec])
  })

  it('presets exactly the DashPay keys that are missing', () => {
    expect(presetKeyVariants(BASE_KEYS)).toEqual([IdentityKeyVariant.EncDashPay, IdentityKeyVariant.DecDashPay])
    expect(presetKeyVariants([key(0, 'AUTHENTICATION', 'MASTER')]))
      .toEqual([IdentityKeyVariant.EncDashPay, IdentityKeyVariant.DecDashPay, IdentityKeyVariant.AuthHigh])
  })

  it('presets nothing when unbound encryption keys already satisfy DashPay', () => {
    const keys = [...BASE_KEYS, key(4, 'ENCRYPTION', 'MEDIUM'), key(5, 'DECRYPTION', 'MEDIUM')]
    expect(presetKeyVariants(keys)).toEqual([])
  })

  it('presets AUTH HIGH when the only authentication key is a hash160 key', () => {
    const keys = [
      key(0, 'AUTHENTICATION', 'MASTER'),
      key(1, 'AUTHENTICATION', 'HIGH', { keyType: 'ECDSA_HASH160' }),
      key(2, 'ENCRYPTION', 'MEDIUM', { contractBounds: DASHPAY_KEY_BOUNDS }),
      key(3, 'DECRYPTION', 'MEDIUM', { contractBounds: DASHPAY_KEY_BOUNDS }),
    ]
    expect(presetKeyVariants(keys)).toEqual([IdentityKeyVariant.AuthHigh])
  })

  it('groups the eight variants into DashPay and other keys', () => {
    expect(KEY_VARIANT_GROUPS.map(group => group.definitions.map(definition => definition.variant))).toEqual([
      [IdentityKeyVariant.EncDashPay, IdentityKeyVariant.DecDashPay],
      [
        IdentityKeyVariant.AuthCritical,
        IdentityKeyVariant.AuthHigh,
        IdentityKeyVariant.AuthMedium,
        IdentityKeyVariant.Enc,
        IdentityKeyVariant.Dec,
        IdentityKeyVariant.Transfer,
      ],
    ])
  })

  it('titles a variant by purpose and level only', () => {
    expect(keyVariantTitle(IDENTITY_KEY_VARIANTS[IdentityKeyVariant.EncDashPay])).toBe('Encryption · Medium')
    expect(keyVariantTitle(IDENTITY_KEY_VARIANTS[IdentityKeyVariant.Transfer])).toBe('Transfer · Critical')
  })

  it('formats dynamic captions and updates bounds drafts immutably', () => {
    const customContract = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'
    const authHigh = IDENTITY_KEY_VARIANTS[IdentityKeyVariant.AuthHigh]
    expect(keyVariantCaption(authHigh, false, { contractId: customContract, documentType: 'domain' })).toEqual({ text: 'Not bound', mono: false })
    expect(keyVariantCaption(authHigh, true, { contractId: '', documentType: '' })).toEqual({ text: 'Not bound', mono: false })
    expect(keyVariantCaption(authHigh, true, { contractId: 'invalid', documentType: '' })).toEqual({ text: 'Not bound', mono: false })
    expect(keyVariantCaption(authHigh, true, { contractId: customContract, documentType: 'domain' })).toEqual({
      text: `${customContract} · domain`,
      mono: true,
    })
    expect(keyVariantCaption(authHigh, true, { contractId: DASHPAY_CONTRACT_ID, documentType: 'profile' })).toEqual({
      text: 'Bound to DashPay · profile',
      mono: false,
    })

    const added = updateKeyBoundsDraft({}, IdentityKeyVariant.Enc, { contractId: customContract })
    expect(added).toEqual({ [IdentityKeyVariant.Enc]: { contractId: customContract, documentType: '' } })
    const pruned = updateKeyBoundsDraft(added, IdentityKeyVariant.Enc, { contractId: '' })
    expect(pruned).toEqual({})
  })
})

describe('keys copy', () => {
  it('formats counts and names', () => {
    expect(keysOnIdentityLabel(1)).toBe('1 on identity')
    expect(keysAddedLabel(1)).toBe('1 key added')
    expect(keysAddedLabel(3)).toBe('3 keys added')
    expect(projectedKeyLabel(7, 'Encryption · Medium · DashPay')).toBe('#7 Encryption · Medium · DashPay')
  })
})

describe('key limits drafts and captions', () => {
  const CUSTOM_CONTRACT = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'
  const NOW = new Date(2026, 10, 24, 10, 30, 0, 0).getTime()
  const FUTURE = NOW + 7 * DAY_MS
  const FUTURE_STR = formatLocalDateTimeInput(FUTURE)

  it('updates and prunes limits drafts while keeping non-default budgetUnit', () => {
    const withBudget = updateKeyLimitsDraft({}, IdentityKeyVariant.AuthHigh, { totalBudget: '0.5' })
    expect(withBudget).toEqual({
      [IdentityKeyVariant.AuthHigh]: { totalBudget: '0.5', budgetUnit: KeyBudgetUnit.Dash, expiresAt: '' },
    })
    expect(updateKeyLimitsDraft(withBudget, IdentityKeyVariant.AuthHigh, { totalBudget: '' })).toEqual({})

    const creditsEmpty = updateKeyLimitsDraft({}, IdentityKeyVariant.AuthHigh, { budgetUnit: KeyBudgetUnit.Credits })
    expect(creditsEmpty).toEqual({
      [IdentityKeyVariant.AuthHigh]: { totalBudget: '', budgetUnit: KeyBudgetUnit.Credits, expiresAt: '' },
    })
    expect(updateKeyLimitsDraft(creditsEmpty, IdentityKeyVariant.AuthHigh, { budgetUnit: KeyBudgetUnit.Dash })).toEqual({})
  })

  it('toggles budget units cleanly and preserves expiresAt and unparseable values', () => {
    const initial = updateKeyLimitsDraft({}, IdentityKeyVariant.AuthMedium, { totalBudget: '0.1', expiresAt: FUTURE_STR })
    const inCredits = toggleKeyBudgetUnit(initial, IdentityKeyVariant.AuthMedium)
    expect(inCredits[IdentityKeyVariant.AuthMedium]).toEqual({
      totalBudget: '10000000000',
      budgetUnit: KeyBudgetUnit.Credits,
      expiresAt: FUTURE_STR,
    })
    expect(toggleKeyBudgetUnit(inCredits, IdentityKeyVariant.AuthMedium)).toEqual(initial)

    const emptyToggled = toggleKeyBudgetUnit({}, IdentityKeyVariant.AuthHigh)
    expect(emptyToggled[IdentityKeyVariant.AuthHigh]?.budgetUnit).toBe(KeyBudgetUnit.Credits)
    expect(toggleKeyBudgetUnit(emptyToggled, IdentityKeyVariant.AuthHigh)).toEqual({})

    const wrongUnitTyped = updateKeyLimitsDraft({}, IdentityKeyVariant.AuthHigh, { totalBudget: '0.5', budgetUnit: KeyBudgetUnit.Credits })
    expect(toggleKeyBudgetUnit(wrongUnitTyped, IdentityKeyVariant.AuthHigh)[IdentityKeyVariant.AuthHigh]).toEqual({
      totalBudget: '0.5',
      budgetUnit: KeyBudgetUnit.Dash,
      expiresAt: '',
    })
  })

  it('applies expiry presets relative to now and passes validation', () => {
    expect(KEY_EXPIRY_PRESETS.map(preset => preset.label)).toEqual(['24h', '7d', '30d', '90d'])
    for (const preset of KEY_EXPIRY_PRESETS) {
      const next = applyKeyExpiryPreset({}, IdentityKeyVariant.AuthCritical, preset.durationMs, NOW)
      const draft = next[IdentityKeyVariant.AuthCritical]!
      expect(draft.expiresAt).toBe(formatLocalDateTimeInput(NOW + preset.durationMs))
      expect(validateKeyLimits(draft, NOW).valid).toBe(true)
    }
  })

  it('renders dynamic captions with limits alongside bounds or default caption', () => {
    const authHigh = IDENTITY_KEY_VARIANTS[IdentityKeyVariant.AuthHigh]
    const enc = IDENTITY_KEY_VARIANTS[IdentityKeyVariant.Enc]
    const validLimits = { totalBudget: '0.1', budgetUnit: KeyBudgetUnit.Dash, expiresAt: FUTURE_STR }
    const expiredLimits = { totalBudget: '', budgetUnit: KeyBudgetUnit.Dash, expiresAt: formatLocalDateTimeInput(NOW) }
    const until = `Until ${formatTimestamp(new Date(FUTURE))}`

    expect(keyVariantCaption(authHigh, true, undefined, validLimits, NOW)).toEqual({
      text: `Not bound · Max 0.1 Dash · ${until}`,
      mono: false,
    })
    expect(keyVariantCaption(authHigh, true, { contractId: CUSTOM_CONTRACT, documentType: 'domain' }, validLimits, NOW)).toEqual({
      text: `${CUSTOM_CONTRACT} · domain · Max 0.1 Dash · ${until}`,
      mono: true,
    })
    expect(keyVariantCaption(authHigh, true, { contractId: DASHPAY_CONTRACT_ID, documentType: 'profile' }, validLimits, NOW)).toEqual({
      text: `Bound to DashPay · profile · Max 0.1 Dash · ${until}`,
      mono: false,
    })
    expect(keyVariantCaption(authHigh, true, undefined, expiredLimits, NOW)).toEqual({
      text: 'Not bound',
      mono: false,
    })
    expect(keyVariantCaption(authHigh, false, undefined, validLimits, NOW)).toEqual({
      text: 'Not bound',
      mono: false,
    })
    expect(keyVariantCaption(enc, true, undefined, validLimits, NOW)).toEqual({
      text: 'Not bound',
      mono: false,
    })
  })

  it('recommends replacements when existing DashPay keys are expired at now', () => {
    const keys = [
      ...BASE_KEYS.filter(entry => entry.keyId !== 2),
      key(2, 'AUTHENTICATION', 'HIGH', { expiresAt: NOW }),
      key(4, 'ENCRYPTION', 'MEDIUM', { contractBounds: DASHPAY_KEY_BOUNDS, expiresAt: NOW + 1_000 }),
      key(5, 'DECRYPTION', 'MEDIUM', { contractBounds: DASHPAY_KEY_BOUNDS, expiresAt: NOW - 1 }),
    ]
    expect(presetKeyVariants(keys, NOW)).toEqual([IdentityKeyVariant.DecDashPay, IdentityKeyVariant.AuthHigh])
  })
})
